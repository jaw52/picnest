import type { ReactNode } from 'react'
import type { Photo } from '~/types/photo'
import { CopyRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import {
  currentFolderAtom,
  filteredPhotosAtom,
  renamingPhotoIdAtom,
  selectedPhotoAtom,
  selectedPhotoIdsAtom,
} from '~/atoms/gallery'
import { IconButton } from '~/components/IconButton'
import { StarRating } from '~/components/StarRating'
import { Tooltip } from '~/components/Tooltip'
import { usePhotoDetails } from '~/hooks/usePhotoDetails'
import { useRatePhoto } from '~/hooks/useRatePhoto'
import { useRenamePhoto } from '~/hooks/useRenamePhoto'
import { useThumbnail } from '~/hooks/useThumbnail'
import { fileExtension, formatFileSize, formatUnixSeconds } from '~/lib/format'
import { writeText } from '~/lib/native'
import { colors } from '~/theme/colors.stylex'
import { radius } from '~/theme/layout.stylex'
import { text, utility, weight } from '~/theme/text'

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
  collageCell: { overflow: 'hidden', backgroundColor: colors['--ps-muted'] },
  fill: { width: '100%', height: '100%' },
  cover: { objectFit: 'cover' },
  contain: { objectFit: 'contain' },
  summary: { display: 'flex', height: '100%', flexDirection: 'column' },
  collage: {
    display: 'grid',
    aspectRatio: '1 / 1',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
    gap: 1,
    overflow: 'hidden',
    backgroundColor: colors['--ps-border'],
  },
  summaryCount: {
    paddingInline: 12,
    paddingBlock: 8,
    textAlign: 'center',
    color: colors['--ps-muted-foreground'],
  },
  empty: {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    textAlign: 'center',
    color: colors['--ps-muted-foreground'],
  },
  detail: { display: 'flex', height: '100%', flexDirection: 'column', overflowY: 'auto' },
  preview: {
    display: 'flex',
    aspectRatio: '1 / 1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors['--ps-muted'],
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
function FileNameRow({ photo, onRename }: { photo: Photo, onRename: (newName: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(photo.fileName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useAtom(renamingPhotoIdAtom)

  // A rename asked for from elsewhere (the grid's context menu); the
  // request is cleared once editing starts.
  if (renamingId === photo.id && !isEditing) {
    setDraft(photo.fileName)
    setIsEditing(true)
  }

  useEffect(() => {
    if (isEditing) {
      setRenamingId(null)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, setRenamingId])

  function startEditing() {
    setDraft(photo.fileName)
    setIsEditing(true)
  }

  function commit() {
    setIsEditing(false)
    onRename(draft)
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
        title={`${photo.fileName}（双击重命名）`}
        onDoubleClick={startEditing}
      >
        {photo.fileName}
      </div>
      <IconButton
        label="复制文件名"
        icon={CopyRegular}
        xstyle={styles.shrink}
        onClick={() => void writeText(photo.fileName)}
      />
    </div>
  )
}

// One key per collage cell; cells without a photo keep these.
const COLLAGE_SLOT_KEYS = ['slot-1', 'slot-2', 'slot-3', 'slot-4']

function CollageThumb({ folderPath, photo }: { folderPath: string | null, photo?: Photo }) {
  const thumbnailUrl = useThumbnail(
    folderPath,
    photo?.path ?? '',
    960,
    !!photo && !photo.isCloudPlaceholder,
  )
  return (
    <div {...stylex.props(styles.collageCell)}>
      {photo && thumbnailUrl && (
        <img src={thumbnailUrl} alt="" {...stylex.props(styles.fill, styles.cover)} draggable={false} />
      )}
    </div>
  )
}

function MultiSelectionSummary({
  folderPath,
  photos,
}: {
  folderPath: string | null
  photos: Photo[]
}) {
  const shown = photos.slice(0, COLLAGE_SLOT_KEYS.length)

  return (
    <div {...stylex.props(styles.summary)}>
      <div {...stylex.props(styles.collage)}>
        {shown.map(photo => (
          <CollageThumb key={photo.id} folderPath={folderPath} photo={photo} />
        ))}
        {COLLAGE_SLOT_KEYS.slice(shown.length).map(key => (
          <CollageThumb key={key} folderPath={folderPath} />
        ))}
      </div>
      <div {...stylex.props(styles.summaryCount, text.caption)}>
        {photos.length}
        {' '}
        个选中对象
      </div>
    </div>
  )
}

export function InfoSidebar() {
  const folderPath = useAtomValue(currentFolderAtom)
  const selectedIds = useAtomValue(selectedPhotoIdsAtom)
  const filteredPhotos = useAtomValue(filteredPhotosAtom)
  const photo = useAtomValue(selectedPhotoAtom)
  const rate = useRatePhoto(folderPath)
  const renamePhoto = useRenamePhoto(folderPath)
  const thumbnailUrl = useThumbnail(
    folderPath,
    photo?.path ?? '',
    960,
    !!photo && !photo.isCloudPlaceholder,
  )
  const { details } = usePhotoDetails(photo?.path ?? null)

  // Preload before swapping so the previous thumbnail stays on screen
  // instead of a blank/white flash while the new one decodes. Resetting to
  // undefined when there's no url happens during render (not in the effect
  // below) since it's a synchronous response to thumbnailUrl changing.
  const [displayUrl, setDisplayUrl] = useState<string | undefined>(thumbnailUrl)
  const [prevThumbnailUrl, setPrevThumbnailUrl] = useState(thumbnailUrl)
  if (thumbnailUrl !== prevThumbnailUrl) {
    setPrevThumbnailUrl(thumbnailUrl)
    if (!thumbnailUrl)
      setDisplayUrl(undefined)
  }

  useEffect(() => {
    if (!thumbnailUrl)
      return
    const img = new Image()
    img.src = thumbnailUrl
    img.onload = () => setDisplayUrl(thumbnailUrl)
    return () => {
      img.onload = null
    }
  }, [thumbnailUrl])

  if (selectedIds.size > 1) {
    return (
      <MultiSelectionSummary
        folderPath={folderPath}
        photos={filteredPhotos.filter(p => selectedIds.has(p.id))}
      />
    )
  }

  if (!photo) {
    return (
      <div {...stylex.props(styles.empty, text.caption)}>
        选择一张图片查看详情
      </div>
    )
  }

  return (
    <div {...stylex.props(styles.detail)}>
      <div {...stylex.props(styles.preview)}>
        {displayUrl && (
          <img
            src={displayUrl}
            alt={photo.fileName}
            {...stylex.props(styles.fill, styles.contain)}
            draggable={false}
          />
        )}
      </div>

      <div {...stylex.props(styles.info)}>
        <FileNameRow photo={photo} onRename={newName => void renamePhoto(photo, newName)} />
        <Tooltip content="选中后按 0–5 键评分" side="bottom">
          <div {...stylex.props(styles.rating)}>
            <StarRating rating={photo.rating} onChange={r => rate([photo], r)} />
          </div>
        </Tooltip>
      </div>

      <Section title="基本信息">
        <Row label="尺寸" value={`${photo.width} × ${photo.height}`} />
        <Row label="类型" value={fileExtension(photo.fileName) || '未知'} />
        <Row label="大小" value={details ? formatFileSize(details.fileSize) : '...'} />
        {details?.created !== undefined && (
          <Row label="创建时间" value={formatUnixSeconds(details.created)} />
        )}
        <Row label="修改时间" value={formatUnixSeconds(photo.modified)} />
      </Section>

      {details?.exif && (
        <Section title="EXIF">
          {details.exif.cameraMake && <Row label="制造商" value={details.exif.cameraMake} />}
          {details.exif.cameraModel && <Row label="型号" value={details.exif.cameraModel} />}
          {details.exif.lensModel && <Row label="镜头" value={details.exif.lensModel} />}
          {details.exif.focalLength && <Row label="焦距" value={details.exif.focalLength} />}
          {details.exif.aperture && <Row label="光圈" value={details.exif.aperture} />}
          {details.exif.shutterSpeed && <Row label="曝光时间" value={details.exif.shutterSpeed} />}
          {details.exif.iso && <Row label="ISO" value={details.exif.iso} />}
          {details.exif.exposureBias && <Row label="曝光偏移" value={details.exif.exposureBias} />}
          {details.exif.takenAt && <Row label="拍摄时间" value={details.exif.takenAt} />}
        </Section>
      )}
    </div>
  )
}
