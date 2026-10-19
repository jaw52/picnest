import type { MotionValue } from 'framer-motion'
import type { LibraryAccess } from '~/mygo'
import * as stylex from '@stylexjs/stylex'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOpenOnHover } from '~/hooks/useOpenOnHover'
import { useTabs } from '~/hooks/useTabs'
import {
  ensureThumbnailUrl,
  libraryAccess,
  openLibraryPrivacySettings,
  requestLibraryAccess,
  scanFolderPage,
} from '~/lib/backend'
import { LIBRARY_PATH } from '~/lib/library'
import { spring } from '~/lib/springs'
import { colors } from '~/theme/colors.stylex'
import { text } from '~/theme/text'

import { card } from './card'
import { cardMarker } from './markers.stylex'

/** Thumbnail edge for the fanned photos: small, and shared with nothing else. */
const PREVIEW_EDGE = 256

// The icon's coordinate space, the same as a folder's so they line up.
const W = 104
const H = 84

/** Each photo: a white-bordered print, landscape, standing on the icon's bottom. */
const PRINT = { width: 62, height: 48, border: 2.5, radius: 4 }
const PRINT_X = (W - PRINT.width) / 2
const PRINT_Y = H - PRINT.height - 8

/**
 * The prints from back to front: how far each turns and shifts sideways,
 * closed and fanned out on hover. They turn about their bottom edge, like
 * cards held in a hand.
 */
const FAN = [
  { name: 'left', rotate: [-11, -19], x: [-7, -14], y: [1, 2] },
  { name: 'right', rotate: [9, 17], x: [7, 14], y: [0, 1] },
  { name: 'front', rotate: [0, 0], x: [0, 0], y: [0, -4] },
] as const

/**
 * What a print shows before there are photos to show: a landscape, each in
 * its own light, painted in the print's coordinates.
 */
const PLACEHOLDERS = [
  { sky: ['#f9cb9c', '#e69138'], hill: '#b45f06' },
  { sky: ['#b6d7a8', '#6aa84f'], hill: '#38761d' },
  { sky: ['#9fc5e8', '#3d85c6'], hill: '#0b5394' },
] as const

const styles = stylex.create({
  icon: { display: 'block', width: W, height: H, overflow: 'visible' },
  label: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, maxWidth: '100%' },
  status: { color: colors['--ps-muted-foreground'], textAlign: 'center' },
})

function Print({ index, spread, coverUrl, id }: { index: number, spread: MotionValue<number>, coverUrl: string | undefined, id: string }) {
  const fan = FAN[index]
  const rotate = useTransform(spread, s => fan.rotate[0] + (fan.rotate[1] - fan.rotate[0]) * s)
  const x = useTransform(spread, s => fan.x[0] + (fan.x[1] - fan.x[0]) * s)
  const y = useTransform(spread, s => fan.y[0] + (fan.y[1] - fan.y[0]) * s)
  const inner = {
    x: PRINT_X + PRINT.border,
    y: PRINT_Y + PRINT.border,
    width: PRINT.width - PRINT.border * 2,
    height: PRINT.height - PRINT.border * 2,
  }
  const placeholder = PLACEHOLDERS[index]
  const clip = `${id}clip${index}`
  const sky = `${id}sky${index}`
  // The horizon sits a little below the middle; the sun above the hills.
  const horizon = inner.y + inner.height * 0.62

  return (
    <motion.g style={{ rotate, x, y, originX: 0.5, originY: 1 }}>
      <defs>
        <clipPath id={clip}>
          <rect {...inner} rx={PRINT.radius - PRINT.border} />
        </clipPath>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={placeholder.sky[0]} />
          <stop offset="1" stopColor={placeholder.sky[1]} />
        </linearGradient>
      </defs>
      <rect
        x={PRINT_X}
        y={PRINT_Y}
        width={PRINT.width}
        height={PRINT.height}
        rx={PRINT.radius}
        fill="#fff"
        filter={`url(#${id}shadow)`}
      />
      <g clipPath={`url(#${clip})`}>
        {coverUrl
          ? <image href={coverUrl} {...inner} preserveAspectRatio="xMidYMid slice" />
          : (
              <>
                <rect {...inner} fill={`url(#${sky})`} />
                <circle cx={inner.x + inner.width * 0.72} cy={inner.y + inner.height * 0.3} r={4.5} fill="#fff" fillOpacity={0.85} />
                <path
                  d={[
                    `M ${inner.x} ${horizon + 6}`,
                    `L ${inner.x + inner.width * 0.3} ${horizon - 10}`,
                    `L ${inner.x + inner.width * 0.5} ${horizon}`,
                    `L ${inner.x + inner.width * 0.68} ${horizon - 6}`,
                    `L ${inner.x + inner.width} ${horizon + 4}`,
                    `V ${inner.y + inner.height} H ${inner.x} Z`,
                  ].join(' ')}
                  fill={placeholder.hill}
                  fillOpacity={0.8}
                />
              </>
            )}
      </g>
    </motion.g>
  )
}

/**
 * The Photos library drawn as three prints fanned out, its latest photos on
 * them once it may be read; they fan out further while pointed at.
 */
function LibraryIcon({ coverUrls, open }: { coverUrls: string[], open: boolean }) {
  const spread = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    const target = open ? 1 : 0
    if (reduceMotion) {
      spread.set(target)
      return
    }
    const controls = animate(spread, target, spring.slow)
    return () => controls.stop()
  }, [open, spread, reduceMotion])

  // Clips, gradients and filters are looked up by document-wide id, inside
  // url(#...) references - keep only characters that are safe there.
  const id = `library${useId().replaceAll(/[^\w-]/g, '')}`
  // The newest photo goes in front.
  const ordered = [coverUrls[2], coverUrls[1], coverUrls[0]]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...stylex.props(styles.icon)}>
      <defs>
        <filter id={`${id}shadow`} x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="0" dy="0.75" stdDeviation="1" floodOpacity="0.3" />
        </filter>
      </defs>
      {FAN.map((print, i) => (
        <Print key={print.name} index={i} spread={spread} coverUrl={ordered[i]} id={id} />
      ))}
    </svg>
  )
}

/**
 * Where the app stands with the Photos library: whether it may be read, and
 * if so how many photos it has and the newest few to show. Access is
 * checked again when the window comes back to the front, since it is
 * granted in System Settings.
 */
function useLibrarySource() {
  const [access, setAccess] = useState<LibraryAccess>()
  const [total, setTotal] = useState<number>()
  const [coverUrls, setCoverUrls] = useState<string[]>([])

  const refresh = useCallback(async () => {
    const current = await libraryAccess()
    setAccess(current)
    if (current !== 'granted')
      return
    const page = await scanFolderPage(LIBRARY_PATH, 0, FAN.length)
    setTotal(page.total)
    const urls = await Promise.all(
      page.photos.map(p => ensureThumbnailUrl(LIBRARY_PATH, p.path, PREVIEW_EDGE).catch(() => {})),
    )
    setCoverUrls(urls.filter(url => url !== undefined))
  }, [])

  useEffect(() => {
    const load = () => void refresh().catch(error => console.warn('failed to read the Photos library:', error))
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [refresh])

  return { access, total, coverUrls, setAccess, refresh }
}

/**
 * The Photos library on the new-tab page. Opens it in a tab once it may be
 * read; before that, asks for access, or, refused, opens System Settings to
 * grant it there.
 */
export function LibraryCard() {
  const { t } = useTranslation()
  const { openInNewTab } = useTabs()
  const { access, total, coverUrls, setAccess, refresh } = useLibrarySource()
  const { open, handlers } = useOpenOnHover()

  const activate = async () => {
    if (access === 'denied') {
      await openLibraryPrivacySettings()
      return
    }
    const granted = access === 'granted' ? access : await requestLibraryAccess()
    setAccess(granted)
    if (granted !== 'granted')
      return
    openInNewTab(LIBRARY_PATH)
    void refresh()
  }

  let status = ''
  if (access === 'granted')
    status = total === undefined ? '' : t('library.photos', { count: total })
  else if (access === 'denied')
    status = t('library.denied')
  else if (access !== undefined)
    status = t('library.allowAccess')

  return (
    <button
      type="button"
      onClick={() => void activate().catch(error => console.warn('failed to open the Photos library:', error))}
      {...handlers}
      {...stylex.props(cardMarker, card.root)}
    >
      <span aria-hidden {...stylex.props(card.iconWell)}>
        <LibraryIcon coverUrls={access === 'granted' ? coverUrls : []} open={open} />
      </span>
      <span {...stylex.props(styles.label)}>
        <span {...stylex.props(text.caption)}>{t('library.name')}</span>
        {status && <span {...stylex.props(styles.status, text.caption)}>{status}</span>}
      </span>
    </button>
  )
}
