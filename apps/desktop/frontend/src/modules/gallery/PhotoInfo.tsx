import type { ReactNode } from 'react'
import type { Photo } from '~/types/photo'
import { Popover } from '@base-ui/react/popover'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CopyRegular from '~icons/mingcute/copy-line'
import { currentFolderAtom, photoInfoIdAtom, photosAtom, renamingPhotoIdAtom } from '~/atoms/gallery'
import { IconButton } from '~/components/IconButton'
import { StarRating } from '~/components/StarRating'
import { Tooltip } from '~/components/Tooltip'
import { useScrollContainer } from '~/context/scroll'
import { SurfaceProvider, useSurface } from '~/context/surface'
import { useFileName } from '~/hooks/useFileName'
import { usePhotoDetails } from '~/hooks/usePhotoDetails'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { useRenamePhoto } from '~/hooks/useRenamePhoto'
import { fileExtension, formatFileSize, formatUnixSeconds } from '~/lib/format'
import { isLibraryPath } from '~/lib/library'
import { writeText } from '~/lib/native'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { surfaceStyles } from '~/theme/surface'
import { text, utility, weight } from '~/theme/text'

const hidden = ':is([data-starting-style], [data-ending-style])'

/** The photo's tile in the tab's grid: another tab may show the folder too. */
function tileOf(scroller: HTMLElement | null, photoId: string) {
  return scroller?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(photoId)}"]`) ?? null
}

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBlock: 2,
  },
  rowLabel: { flexShrink: 0, color: colors['--ps-muted-foreground'] },
  rowValue: { textAlign: 'right', color: colors['--ps-foreground'] },
  section: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors['--ps-border'],
    paddingInline: 12,
    paddingBlock: 8,
  },
  sectionTitle: { marginBottom: 4, color: colors['--ps-muted-foreground'] },
  nameInput: {
    boxSizing: 'border-box',
    height: 28,
    width: '100%',
    backgroundColor: colors['--ps-card'],
    paddingInline: 6,
    color: colors['--ps-foreground'],
    outline: 'none',
    borderWidth: 0,
    borderRadius: radius.item,
    boxShadow: `0 0 0 1px ${colors['--ps-border']}`,
  },
  nameRow: { display: 'flex', alignItems: 'center', gap: 4 },
  name: { minWidth: 0, flexGrow: 1, flexBasis: 0, cursor: 'text' },
  shrink: { flexShrink: 0 },
  positioner: { zIndex: 50 },
  popup: {
    boxSizing: 'border-box',
    width: 280,
    maxHeight: 'var(--available-height)',
    overflowY: 'auto',
    borderRadius: radius.container,
    outline: 'none',
    transformOrigin: 'var(--transform-origin)',
    opacity: { default: 1, [hidden]: 0 },
    transform: { default: 'none', [hidden]: 'scale(0.97)' },
    transitionProperty: 'opacity, transform',
    transitionDuration: '120ms',
    transitionTimingFunction: 'ease-out',
  },
  info: { paddingInline: 12, paddingBlock: 8 },
  rating: { marginTop: 6 },
})

function Row({ label, value }: { label: string, value: string }) {
  return (
    <div {...stylex.props(styles.row, text.caption)}>
      <span {...stylex.props(styles.rowLabel)}>{label}</span>
      <span {...stylex.props(utility.truncate, styles.rowValue)}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionTitle, text.caption, weight.semibold)}>
        {title}
      </div>
      {children}
    </div>
  )
}

/**
 * Double-click (or 重命名 in a photo's context menu) to rename, synced to the
 * real file on disk; click the icon to copy.
 */
function FileNameRow({ photo, onRename }: { photo: Photo, onRename?: (newName: string) => void }) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(photo.fileName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useAtom(renamingPhotoIdAtom)
  const fileName = useFileName(photo)

  // A rename asked for from elsewhere (the grid's context menu); the
  // request is cleared once editing starts.
  if (renamingId === photo.id && !isEditing && onRename) {
    setDraft(photo.fileName)
    setIsEditing(true)
  }

  useEffect(() => {
    if (!isEditing) {
      return
    }

    setRenamingId(null)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing, setRenamingId])

  function startEditing() {
    if (!onRename)
      return
    setDraft(photo.fileName)
    setIsEditing(true)
  }

  function commit() {
    setIsEditing(false)
    onRename?.(draft)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')
            commit()
          else if (e.key === 'Escape')
            setIsEditing(false)
        }}
        {...stylex.props(styles.nameInput, text.subtitleCompact, weight.semibold)}
      />
    )
  }

  return (
    <div {...stylex.props(styles.nameRow)}>
      <div
        {...stylex.props(styles.name, utility.truncate, text.subtitleCompact, weight.semibold)}
        title={onRename ? t('photoInfo.renameHint', { name: fileName }) : fileName}
        onDoubleClick={startEditing}
      >
        {fileName}
      </div>
      <IconButton
        label={t('photoInfo.copyFileName')}
        icon={CopyRegular}
        xstyle={styles.shrink}
        onClick={() => void writeText(fileName)}
      />
    </div>
  )
}

function PhotoInfo({ photo, folderPath }: { photo: Photo, folderPath: string | null }) {
  const { t } = useTranslation()
  const rate = useRatePhoto(folderPath)
  const renamePhoto = useRenamePhoto(folderPath)
  const { details } = usePhotoDetails(photo.path)
  const fileName = useFileName(photo)

  return (
    <>
      <div {...stylex.props(styles.info)}>
        {/* A photo in the Photos library has no file of its own to rename. */}
        <FileNameRow photo={photo} onRename={isLibraryPath(folderPath) ? undefined : newName => void renamePhoto(photo, newName)} />
        <Tooltip content={t('photoInfo.rateHint')} side="bottom">
          <div {...stylex.props(styles.rating)}>
            <StarRating rating={photo.rating} onChange={r => rate([photo], r)} />
          </div>
        </Tooltip>
      </div>

      <Section title={t('photoInfo.basics')}>
        <Row label={t('photoInfo.dimensions')} value={photo.isCloudPlaceholder ? t('photoInfo.unknown') : `${photo.width} × ${photo.height}`} />
        <Row label={t('photoInfo.type')} value={fileExtension(fileName) || t('photoInfo.unknown')} />
        {!isLibraryPath(folderPath) && (
          <Row label={t('photoInfo.size')} value={details ? formatFileSize(details.fileSize) : '...'} />
        )}
        {details?.created !== undefined && (
          <Row label={t('photoInfo.created')} value={formatUnixSeconds(details.created)} />
        )}
        <Row label={t('photoInfo.modified')} value={formatUnixSeconds(photo.modified)} />
      </Section>

      {details?.exif && (
        <Section title="EXIF">
          {details.exif.cameraMake && <Row label={t('photoInfo.make')} value={details.exif.cameraMake} />}
          {details.exif.cameraModel && <Row label={t('photoInfo.model')} value={details.exif.cameraModel} />}
          {details.exif.lensModel && <Row label={t('photoInfo.lens')} value={details.exif.lensModel} />}
          {details.exif.focalLength && <Row label={t('photoInfo.focalLength')} value={details.exif.focalLength} />}
          {details.exif.aperture && <Row label={t('photoInfo.aperture')} value={details.exif.aperture} />}
          {details.exif.shutterSpeed && <Row label={t('photoInfo.shutterSpeed')} value={details.exif.shutterSpeed} />}
          {details.exif.iso && <Row label="ISO" value={details.exif.iso} />}
          {details.exif.exposureBias && <Row label={t('photoInfo.exposureBias')} value={details.exif.exposureBias} />}
          {details.exif.takenAt && <Row label={t('photoInfo.takenAt')} value={details.exif.takenAt} />}
        </Section>
      )}
    </>
  )
}

/**
 * The card beside a photo's tile, opened from its context menu or ⌘I. It
 * floats over the page, so opening it leaves the grid as it is. It closes
 * once its tile is gone: deleted, filtered out, or scrolled far enough to be
 * unmounted.
 */
function PhotoInfoCard({ photoId }: { photoId: string }) {
  const folderPath = useAtomValue(currentFolderAtom)
  const setOpenId = useSetAtom(photoInfoIdAtom)
  const photo = useAtomValue(photosAtom).find(p => p.id === photoId)
  const scroller = useScrollContainer()
  // A card stacks two steps above the page, like a menu.
  const level = Math.min(useSurface() + 2, 8)

  useEffect(() => {
    function closeIfGone() {
      if (!photo || !tileOf(scroller, photoId))
        setOpenId(null)
    }
    closeIfGone()
    scroller?.addEventListener('scroll', closeIfGone, { passive: true })
    return () => scroller?.removeEventListener('scroll', closeIfGone)
  }, [photoId, photo, setOpenId, scroller])

  if (!photo)
    return null

  return (
    <Popover.Portal>
      <Popover.Positioner
        anchor={() => tileOf(scroller, photoId)}
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        {...stylex.props(styles.positioner)}
      >
        <SurfaceProvider value={level}>
          <Popover.Popup
            // A rename asked for from the context menu focuses its input.
            initialFocus={() => document.querySelector<HTMLElement>('[data-photo-info] input') ?? true}
            data-photo-info
            {...stylex.props(styles.popup, ...surfaceStyles(level, 3))}
          >
            <PhotoInfo photo={photo} folderPath={folderPath} />
          </Popover.Popup>
        </SurfaceProvider>
      </Popover.Positioner>
    </Popover.Portal>
  )
}

/** Mount once, beside the grid: the info card for `photoInfoIdAtom`. */
export function PhotoInfoPopover() {
  const [openId, setOpenId] = useAtom(photoInfoIdAtom)
  // Kept through the closing transition, so the card fades out with its content.
  const [shownId, setShownId] = useState(openId)
  if (openId !== null && openId !== shownId)
    setShownId(openId)

  return (
    <Popover.Root
      open={openId !== null}
      onOpenChange={(open) => {
        if (!open)
          setOpenId(null)
      }}
      onOpenChangeComplete={(open) => {
        if (!open)
          setShownId(null)
      }}
    >
      {shownId !== null && <PhotoInfoCard photoId={shownId} />}
    </Popover.Root>
  )
}
