import * as stylex from '@stylexjs/stylex'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { Copy, FolderOpen, FolderX, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { ContextMenu } from '~/components/ContextMenu'
import { useThumbnail } from '~/hooks/useThumbnail'
import { listSubfolders, scanFolderPage } from '~/lib/backend'
import { openPath, writeText } from '~/lib/native'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { text } from '~/theme/text'

import { cardMarker } from './markers.stylex'

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
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: colors['--ps-foreground'],
  },
  // Like Finder, hovering highlights the icon, not the whole cell.
  iconWell: {
    padding: 8,
    borderRadius: radius.item,
    backgroundColor: {
      default: 'transparent',
      [stylex.when.ancestor(':hover', cardMarker)]: colors['--ps-hover'],
    },
    transitionProperty: 'background-color',
    transitionDuration: '80ms',
  },
  icon: { display: 'block', width: W, height: H },
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
function FolderIcon({ coverUrl, open }: { coverUrl: string | undefined, open: boolean }) {
  // One value drives the front's height; its outline, highlight and the glass
  // clip are all rebuilt from it each frame, so they move as one.
  const high = useMotionValue(FRONT_HIGH_CLOSED)
  const front = useTransform(high, frontPath)
  const topEdge = useTransform(high, frontTopEdge)
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
  const id = `folder${useId().replace(/[^\w-]/g, '')}`
  const inner = {
    x: PHOTO.x + PHOTO.border,
    y: PHOTO.y + PHOTO.border,
    width: PHOTO.width - PHOTO.border * 2,
    height: PHOTO.height - PHOTO.border * 2,
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...stylex.props(styles.icon)}>
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
    </svg>
  )
}

interface FolderCardProps {
  path: string
  name: string
  onOpen: () => void
  /** Forgets the folder from a list; the menu item is left out without it. */
  onRemove?: () => void
  onDelete: () => void
}

/** A folder drawn like a Finder folder icon with its first photo inside. */
export function FolderCard({ path, name, onOpen, onRemove, onDelete }: FolderCardProps) {
  const cover = useCover(path)
  // The folder opens while pointed at or focused from the keyboard.
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const coverUrl = useThumbnail(cover?.folder ?? path, cover?.path ?? '', PREVIEW_EDGE, cover !== null)

  return (
    <ContextMenu
      items={[
        { label: '复制路径', icon: Copy, onSelect: () => void writeText(path) },
        {
          label: '在访达中打开',
          icon: FolderOpen,
          onSelect: () =>
            void openPath(path).catch(error => console.warn(`failed to open ${path}:`, error)),
        },
        ...(onRemove ? [{ label: '从列表中移除', icon: X, onSelect: onRemove }] : []),
        { label: '删除文件夹', icon: FolderX, destructive: true, onSelect: onDelete },
      ]}
    >
      <button
        type="button"
        onClick={onOpen}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={e => setFocused(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFocused(false)}
        {...stylex.props(cardMarker, styles.card)}
      >
        <span aria-hidden {...stylex.props(styles.iconWell)}>
          <FolderIcon coverUrl={cover ? coverUrl : undefined} open={hovered || focused} />
        </span>
        <span {...stylex.props(styles.name, text.caption)}>{name}</span>
      </button>
    </ContextMenu>
  )
}
