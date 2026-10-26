import { Popover } from '@base-ui/react/popover'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { currentFolderAtom, photoInfoIdAtom, photosAtom, renamingPhotoIdAtom } from '~/atoms/gallery'
import { IconButton } from '~/components/IconButton'
import { StarRating } from '~/components/StarRating'
import { Tooltip } from '~/components/Tooltip'
import { useScrollContainer } from '~/context/scroll'
import { useFileName } from '~/hooks/useFileName'
import { usePhotoDetails } from '~/hooks/usePhotoDetails'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { useRenamePhoto } from '~/hooks/useRenamePhoto'
import { cn } from '~/lib/cn'
import { fileExtension, formatFileSize, formatUnixSeconds } from '~/lib/format'
import { isLibraryPath } from '~/lib/library'
import { writeText } from '~/lib/native'
import { popupSurface } from '~/lib/surface'
import type { Photo } from '~/types/photo'
import CopyRegular from '~icons/mingcute/copy-line'

/** The photo's tile in the tab's grid: another tab may show the folder too. */
function tileOf(scroller: HTMLElement | null, photoId: string) {
  return scroller?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(photoId)}"]`) ?? null
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-caption">
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className="truncate text-right text-text">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border px-3 py-2">
      <div className="wght-semibold mb-1 text-caption text-text-secondary">{title}</div>
      {children}
    </div>
  )
}

/**
 * Double-click (or 重命名 in a photo's context menu) to rename, synced to the
 * real file on disk; click the icon to copy.
 */
function FileNameRow({ photo, onRename }: { photo: Photo; onRename?: (newName: string) => void }) {
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
    if (!onRename) return
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
        className="wght-semibold box-border h-7 w-full rounded-item bg-background px-1.5 text-subtitle text-text ring-1 ring-border outline-none"
        ref={inputRef}
        value={draft}
        onBlur={commit}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') setIsEditing(false)
        }}
      />
    )
  }

  return (
    <div className="flex items-center gap-1">
      <div
        className="wght-semibold min-w-0 grow basis-0 cursor-text truncate text-subtitle"
        title={onRename ? t('photoInfo.renameHint', { name: fileName }) : fileName}
        onDoubleClick={startEditing}
      >
        {fileName}
      </div>
      <IconButton
        className="shrink-0"
        icon={CopyRegular}
        label={t('photoInfo.copyFileName')}
        onClick={() => void writeText(fileName)}
      />
    </div>
  )
}

function PhotoInfo({ photo, folderPath }: { photo: Photo; folderPath: string | null }) {
  const { t } = useTranslation()
  const rate = useRatePhoto(folderPath)
  const renamePhoto = useRenamePhoto(folderPath)
  const { details } = usePhotoDetails(photo.path)
  const fileName = useFileName(photo)

  return (
    <>
      <div className="px-3 py-2">
        {/* A photo in the Photos library has no file of its own to rename. */}
        <FileNameRow
          photo={photo}
          onRename={isLibraryPath(folderPath) ? undefined : (newName) => void renamePhoto(photo, newName)}
        />
        <Tooltip content={t('photoInfo.rateHint')} side="bottom">
          <div className="mt-1.5">
            <StarRating rating={photo.rating} onChange={(r) => rate([photo], r)} />
          </div>
        </Tooltip>
      </div>

      <Section title={t('photoInfo.basics')}>
        <Row
          label={t('photoInfo.dimensions')}
          value={photo.isCloudPlaceholder ? t('photoInfo.unknown') : `${photo.width} × ${photo.height}`}
        />
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
  const photo = useAtomValue(photosAtom).find((p) => p.id === photoId)
  const scroller = useScrollContainer()

  useEffect(() => {
    function closeIfGone() {
      if (!photo || !tileOf(scroller, photoId)) setOpenId(null)
    }
    closeIfGone()
    scroller?.addEventListener('scroll', closeIfGone, { passive: true })
    return () => scroller?.removeEventListener('scroll', closeIfGone)
  }, [photoId, photo, setOpenId, scroller])

  if (!photo) return null

  return (
    <Popover.Portal>
      <Popover.Positioner
        align="start"
        anchor={() => tileOf(scroller, photoId)}
        className="z-50"
        collisionPadding={12}
        side="right"
        sideOffset={8}
      >
        <Popover.Popup
          // A rename asked for from the context menu focuses its input.
          data-photo-info
          initialFocus={() => document.querySelector<HTMLElement>('[data-photo-info] input') ?? true}
          className={cn(
            popupSurface,
            'box-border max-h-(--available-height) w-70 origin-(--transform-origin) overflow-y-auto rounded-container outline-none',
            'transition-[opacity,transform] duration-120 ease-out data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0',
          )}
        >
          <PhotoInfo folderPath={folderPath} photo={photo} />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}

/** Mount once, beside the grid: the info card for `photoInfoIdAtom`. */
export function PhotoInfoPopover() {
  const [openId, setOpenId] = useAtom(photoInfoIdAtom)
  // Kept through the closing transition, so the card fades out with its content.
  const [shownId, setShownId] = useState(openId)
  if (openId !== null && openId !== shownId) setShownId(openId)

  return (
    <Popover.Root
      open={openId !== null}
      onOpenChange={(open) => {
        if (!open) setOpenId(null)
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setShownId(null)
      }}
    >
      {shownId !== null && <PhotoInfoCard photoId={shownId} />}
    </Popover.Root>
  )
}
