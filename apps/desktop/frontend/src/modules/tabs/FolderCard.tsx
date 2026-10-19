import type { TFunction } from 'i18next'
import type { ContextMenuItem } from '~/components/ContextMenu'
import * as stylex from '@stylexjs/stylex'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseRegular from '~icons/mingcute/close-line'
import ExternalLinkRegular from '~icons/mingcute/external-link-line'
import FolderDeleteRegular from '~icons/mingcute/folder-delete-line'
import { ContextMenu } from '~/components/ContextMenu'
import { useIsICloudFolder } from '~/hooks/useIsICloudFolder'
import { useOpenOnHover } from '~/hooks/useOpenOnHover'
import { useThumbnail } from '~/hooks/useThumbnail'
import { listSubfolders, scanFolderPage } from '~/lib/backend'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { motion as motionTokens } from '~/theme/layout.stylex'
import { text, utility } from '~/theme/text'

import { card } from './card'
import { cardMarker } from './markers.stylex'
import { pathMenuItems } from './pathMenuItems'

/**
 * Candidates read for the cover photo: the first few, in case the first ones
 * are undownloaded iCloud placeholders with nothing to show.
 */
const COVER_CANDIDATES = 6
/**
 * Subfolders looked into, in order, for a folder with no photos of its own,
 * so a folder that only groups others still shows what it holds.
 */
const SUBFOLDER_CANDIDATES = 6
/** Thumbnail edge for the previews: small, and shared with nothing else. */
const PREVIEW_EDGE = 256

// The icon's coordinate space; the SVG renders at this size in CSS px.
const W = 104
const H = 84

/**
 * How far the front overhangs the back on each side along its top. Its
 * bottom edge is the back's bottom edge, so this is also how far each side
 * of the front slants in.
 */
const FRONT_TAPER = 10
/** How much higher the right part of the front's top edge sits than the left. */
const FRONT_RISE = 5
const CORNER = 5
/** How much of a masonry tile's width its folder icon takes. */
const TILE_ICON_SHARE = 0.56
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2

/** The back panel: a rectangle (plus its tab) exactly as wide as the front's bottom edge. */
const BACK = { left: FRONT_TAPER, right: W - FRONT_TAPER, top: 8 }

/**
 * Where the front's top edge (its higher, right part) sits. Closed, the front
 * covers half the back; hovered, the folder opens and the front drops to the
 * golden ratio, so 0.618 of the back - most of the photo - shows above it.
 */
const FRONT_HIGH_CLOSED = BACK.top + (H - BACK.top) / 2
const FRONT_HIGH_OPEN = BACK.top + (H - BACK.top) / GOLDEN_RATIO

/** The cover photo's frame (a white border around the picture), inside the back. */
const PHOTO = {
  x: BACK.left + 5,
  y: BACK.top + 4,
  width: BACK.right - BACK.left - 10,
  height: 60,
  radius: CORNER,
  border: 1.5,
}

/**
 * The cloud an iCloud Drive folder has pressed into its front, as in Finder:
 * three circles on a flat base, in units around (0, 0).
 */
const CLOUD_SHAPES = {
  circles: [
    { cx: 1, cy: -1, r: 6 },
    { cx: 6, cy: 2, r: 4 },
    { cx: -5, cy: 2.5, r: 3.5 },
  ],
  base: { left: -5, right: 6, top: 0.5, bottom: 6 },
}

/**
 * The cloud's outline as points, found by casting rays from a point inside
 * it to where the shapes' union ends. Points, unlike arcs, can be bent into
 * the front's perspective.
 */
const CLOUD_OUTLINE = (() => {
  const origin = { x: 0.5, y: 2 }
  const { circles, base } = CLOUD_SHAPES
  const points: { x: number, y: number }[] = []
  const steps = 120
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    // Each shape covers a stretch of the ray; the outline is where the
    // stretches, chained from the origin, run out.
    const spans: [number, number][] = circles.flatMap(({ cx, cy, r }) => {
      const ox = origin.x - cx
      const oy = origin.y - cy
      const b = dx * ox + dy * oy
      const disc = b * b - (ox * ox + oy * oy - r * r)
      return disc < 0 ? [] : [[-b - Math.sqrt(disc), -b + Math.sqrt(disc)] as [number, number]]
    })
    const slab = (lo: number, hi: number, o: number, d: number): [number, number] =>
      d === 0 ? (o >= lo && o <= hi ? [-Infinity, Infinity] : [Infinity, -Infinity]) : [Math.min((lo - o) / d, (hi - o) / d), Math.max((lo - o) / d, (hi - o) / d)]
    const sx = slab(base.left, base.right, origin.x, dx)
    const sy = slab(base.top, base.bottom, origin.y, dy)
    spans.push([Math.max(sx[0], sy[0]), Math.min(sx[1], sy[1])])
    let end = 0
    // The span that carries the ray on past `end`, until none does.
    const reaching = () => spans.find(([from, to]) => from <= end + 1e-6 && to > end + 1e-6)
    for (let next = reaching(); next; next = reaching())
      end = next[1]
    points.push({ x: origin.x + dx * end, y: origin.y + dy * end })
  }
  return points
})()

const FRONT_LOW_CLOSED = FRONT_HIGH_CLOSED + FRONT_RISE
/** Where on the closed front the cloud's center sits, 0 at its top edge to 1 at its bottom. */
const CLOUD_DEPTH = (H - 15 - FRONT_LOW_CLOSED) / (H - FRONT_LOW_CLOSED)
/** Px per cloud unit, across the front's full top width and down the closed front. */
const CLOUD_SCALE = 1.2

/**
 * The cloud laid on the front at `high`: narrowing toward the bottom with
 * the front's taper, and squashed as the front tips open. `dy` shifts it
 * down the front, in cloud units.
 */
function cloudOnFront(high: number, dy = 0) {
  const low = high + FRONT_RISE
  const depth = H - low
  const closedDepth = H - FRONT_LOW_CLOSED
  return `${CLOUD_OUTLINE.map(({ x, y }, i) => {
    const v = CLOUD_DEPTH + ((y + dy) * CLOUD_SCALE) / closedDepth
    const halfWidth = W / 2 - FRONT_TAPER * v
    const px = W / 2 + x * CLOUD_SCALE * (halfWidth / (W / 2))
    const py = low + v * depth
    return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`
  }).join(' ')} Z`
}

/** The back panel and its tab as one outline, the tab easing down into the top edge. */
const BACK_PATH = (() => {
  const { left: l, right: r, top: t } = BACK
  const c = CORNER
  return [
    `M ${l} ${t + 1} Q ${l} 2 ${l + 7} 2 H ${l + 28} C ${l + 32} 2 ${l + 33} ${t} ${l + 38} ${t}`,
    `H ${r - 7} Q ${r} ${t} ${r} ${t + 7}`,
    `V ${H - c} Q ${r} ${H} ${r - c} ${H} H ${l + c} Q ${l} ${H} ${l} ${H - c} Z`,
  ].join(' ')
})()

/**
 * The front's top edge, left to right: level, then an S-curve up to the
 * higher right part at `high`.
 */
function frontTopEdge(high: number) {
  const low = high + FRONT_RISE
  return `M ${CORNER} ${low} H 42 C 54 ${low} 58 ${high} 70 ${high} H ${W - CORNER}`
}

/**
 * The folder's front: a trapezoid spanning the whole icon along its top and
 * pulled in to the back's width at the bottom, so it reads as leaning toward
 * the viewer.
 */
function frontPath(high: number) {
  const low = high + FRONT_RISE
  const t = FRONT_TAPER
  const c = CORNER
  return [
    frontTopEdge(high),
    `Q ${W} ${high} ${W - (t * c) / (H - high)} ${high + c}`,
    `L ${W - t} ${H - c}`,
    `Q ${W - t} ${H} ${W - t - c} ${H} H ${t + c}`,
    `Q ${t} ${H} ${t} ${H - c}`,
    `L ${(t * c) / (H - low)} ${low + c}`,
    `Q 0 ${low} ${CORNER} ${low} Z`,
  ].join(' ')
}

const styles = stylex.create({
  icon: { display: 'block', width: W, height: H },
  // In a tile the icon scales with the column instead.
  fluidIcon: { width: '100%', height: 'auto' },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingInline: 12,
    borderWidth: 0,
    borderRadius: 4,
    cursor: 'pointer',
    color: colors['--ps-foreground'],
    backgroundColor: { 'default': colors['--ps-muted'], ':hover': colors['--ps-hover'] },
    transitionProperty: 'background-color',
    transitionDuration: motionTokens.fast,
    outline: { 'default': 'none', ':focus-visible': `2px solid ${colors['--ps-focus-ring']}` },
    outlineOffset: 6,
  },
  tileSize: (width: number, height: number) => ({ width, height }),
  tileIcon: { width: `${TILE_ICON_SHARE * 100}%` },
  tileName: { maxWidth: '100%' },
  name: {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    maxWidth: '100%',
    textAlign: 'center',
    wordBreak: 'break-all',
  },
})

interface Cover {
  /** The folder the photo is in, which owns its thumbnail. */
  folder: string
  path: string
}

async function firstPhoto(folderPath: string) {
  const page = await scanFolderPage(folderPath, 0, COVER_CANDIDATES)
  return page.photos.find(p => !p.isCloudPlaceholder)?.path ?? null
}

/** The folder's first photo, or failing that the first one in a subfolder. */
async function findCover(folderPath: string): Promise<Cover | null> {
  const own = await firstPhoto(folderPath)
  if (own)
    return { folder: folderPath, path: own }
  const subfolders = await listSubfolders(folderPath)
  for (const sub of subfolders.slice(0, SUBFOLDER_CANDIDATES)) {
    const path = await firstPhoto(sub.path)
    if (path)
      return { folder: sub.path, path }
  }
  return null
}

/** The photo for the folder's icon; null until it loads or if there is none. */
function useCover(folderPath: string) {
  const [cover, setCover] = useState<Cover | null>(null)
  useEffect(() => {
    let cancelled = false
    findCover(folderPath)
      .then((found) => {
        if (!cancelled)
          setCover(found)
      })
      .catch(error => console.warn(`failed to preview ${folderPath}:`, error))
    return () => {
      cancelled = true
    }
  }, [folderPath])
  return cover
}

/**
 * A Finder-style folder drawn in SVG: the back, the cover photo peeking out,
 * and a frosted front - the photo blurred and clipped to the front's shape
 * under a translucent blue, which is what Finder's glass looks like.
 */
function FolderIcon({ coverUrl, open, iCloud = false, fluid = false }: { coverUrl: string | undefined, open: boolean, iCloud?: boolean, fluid?: boolean }) {
  // One value drives the front's height; its outline, highlight and the glass
  // clip are all rebuilt from it each frame, so they move as one.
  const high = useMotionValue(FRONT_HIGH_CLOSED)
  const front = useTransform(high, frontPath)
  const topEdge = useTransform(high, frontTopEdge)
  const cloud = useTransform(high, h => cloudOnFront(h))
  const cloudEdge = useTransform(high, h => cloudOnFront(h, 0.5))
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    const target = open ? FRONT_HIGH_OPEN : FRONT_HIGH_CLOSED
    if (reduceMotion) {
      high.set(target)
      return
    }
    const controls = animate(high, target, spring.slow)
    return () => controls.stop()
  }, [open, high, reduceMotion])

  // Gradients, clips and filters are looked up by document-wide id, inside
  // url(#...) references - keep only characters that are safe there.
  const id = `folder${useId().replaceAll(/[^\w-]/g, '')}`
  const inner = {
    x: PHOTO.x + PHOTO.border,
    y: PHOTO.y + PHOTO.border,
    width: PHOTO.width - PHOTO.border * 2,
    height: PHOTO.height - PHOTO.border * 2,
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...stylex.props(styles.icon, fluid && styles.fluidIcon)}>
      <defs>
        <linearGradient id={`${id}back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fb5f4" />
          <stop offset="1" stopColor="#3f9de9" />
        </linearGradient>
        <linearGradient id={`${id}front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd3fb" stopOpacity={coverUrl ? 0.55 : 1} />
          <stop offset="1" stopColor="#6fbaf5" stopOpacity={coverUrl ? 0.75 : 1} />
        </linearGradient>
        <clipPath id={`${id}photo`}>
          <rect {...inner} rx={PHOTO.radius - PHOTO.border} />
        </clipPath>
        <clipPath id={`${id}frontClip`}>
          <motion.path d={front} />
        </clipPath>
        <filter id={`${id}blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`${id}shadow`} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="0.75" floodOpacity="0.25" />
        </filter>
      </defs>

      <path d={BACK_PATH} fill={`url(#${id}back)`} />

      {coverUrl && (
        <>
          <rect
            x={PHOTO.x}
            y={PHOTO.y}
            width={PHOTO.width}
            height={PHOTO.height}
            rx={PHOTO.radius}
            fill="#fff"
            filter={`url(#${id}shadow)`}
          />
          <image
            href={coverUrl}
            {...inner}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${id}photo)`}
          />
          {/* The frosted glass: the same framed photo, blurred, seen through the front. */}
          <g clipPath={`url(#${id}frontClip)`}>
            <g filter={`url(#${id}blur)`}>
              <rect
                x={PHOTO.x}
                y={PHOTO.y}
                width={PHOTO.width}
                height={PHOTO.height}
                rx={PHOTO.radius}
                fill="#fff"
              />
              <image
                href={coverUrl}
                {...inner}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${id}photo)`}
              />
            </g>
          </g>
        </>
      )}

      <motion.path d={front} fill={`url(#${id}front)`} />
      {/* A highlight along the front's top edge. */}
      <motion.path
        d={topEdge}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.6}
        strokeWidth={1}
        clipPath={`url(#${id}frontClip)`}
      />
      {iCloud && (
        // Pressed in: a darker cloud over a light edge just below it.
        <>
          <motion.path d={cloudEdge} fill="#fff" fillOpacity={0.5} />
          <motion.path d={cloud} fill="#1f6fbf" fillOpacity={0.55} />
        </>
      )}
    </svg>
  )
}

/** The menu every folder gets; `onOpenInNewTab`, `onRemove` and `onDelete` add their items. */
function folderMenuItems(
  t: TFunction,
  path: string,
  { onOpenInNewTab, onRemove, onDelete }: { onOpenInNewTab?: () => void, onRemove?: () => void, onDelete?: () => void },
): ContextMenuItem[] {
  return [
    ...(onOpenInNewTab ? [{ label: t('tabs.openInNewTab'), icon: ExternalLinkRegular, onSelect: onOpenInNewTab }] : []),
    ...pathMenuItems(t, path),
    ...(onRemove ? [{ label: t('tabs.removeFromList'), icon: CloseRegular, onSelect: onRemove }] : []),
    ...(onDelete ? [{ label: t('dialogs.deleteFolderTitle'), icon: FolderDeleteRegular, destructive: true, onSelect: onDelete }] : []),
  ]
}

function useCoverUrl(path: string) {
  const cover = useCover(path)
  const coverUrl = useThumbnail(cover?.folder ?? path, cover?.path ?? '', PREVIEW_EDGE, cover !== null)
  return cover ? coverUrl : undefined
}

interface FolderCardProps {
  path: string
  name: string
  onOpen: () => void
  /** Forgets the folder from a list; the menu item is left out without it. */
  onRemove?: () => void
  /** Deletes the folder; the menu item is left out without it. */
  onDelete?: () => void
}

/** A folder drawn like a Finder folder icon with its first photo inside. */
export function FolderCard({ path, name, onOpen, onRemove, onDelete }: FolderCardProps) {
  const { t } = useTranslation()
  const coverUrl = useCoverUrl(path)
  const iCloud = useIsICloudFolder(path)
  const { open, handlers } = useOpenOnHover()

  return (
    <ContextMenu items={folderMenuItems(t, path, { onRemove, onDelete })}>
      <button
        type="button"
        onClick={onOpen}
        {...handlers}
        {...stylex.props(cardMarker, card.root)}
      >
        <span aria-hidden {...stylex.props(card.iconWell)}>
          <FolderIcon coverUrl={coverUrl} open={open} iCloud={iCloud} />
        </span>
        <span {...stylex.props(styles.name, text.caption)}>{name}</span>
      </button>
    </ContextMenu>
  )
}

interface FolderTileProps {
  path: string
  name: string
  width: number
  height: number
  /** Opens the folder in place, or in a background tab for ⌘ and middle clicks. */
  onOpen: (e: { metaKey: boolean, button: number }) => void
  onDelete: () => void
}

/** A subfolder in the masonry, sized like a photo tile, that opens like a link. */
export function FolderTile({ path, name, width, height, onOpen, onDelete }: FolderTileProps) {
  const { t } = useTranslation()
  const coverUrl = useCoverUrl(path)
  const iCloud = useIsICloudFolder(path)
  const { open, handlers } = useOpenOnHover()

  return (
    <ContextMenu
      items={folderMenuItems(t, path, {
        onOpenInNewTab: () => onOpen({ metaKey: true, button: 0 }),
        onDelete,
      })}
    >
      <button
        type="button"
        onClick={onOpen}
        // The middle button never fires a click; it is a new tab, as on a link.
        onAuxClick={(e) => {
          if (e.button === 1)
            onOpen(e)
        }}
        // Keeps the middle button from starting autoscroll.
        onMouseDown={(e) => {
          if (e.button === 1)
            e.preventDefault()
        }}
        {...handlers}
        {...stylex.props(styles.tile, styles.tileSize(width, height))}
      >
        <span aria-hidden {...stylex.props(styles.tileIcon)}>
          <FolderIcon coverUrl={coverUrl} open={open} iCloud={iCloud} fluid />
        </span>
        <span {...stylex.props(styles.tileName, utility.truncate, text.caption)}>{name}</span>
      </button>
    </ContextMenu>
  )
}
