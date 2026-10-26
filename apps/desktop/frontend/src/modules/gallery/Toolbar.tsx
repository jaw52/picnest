import { useAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'

import {
  bulkDeleteBlockedAtom,
  currentFolderAtom,
  filteredPhotosAtom,
  isScanningAtom,
  selectedPhotoIdsAtom,
  THUMBNAIL_WIDTH_MAX,
  THUMBNAIL_WIDTH_MIN,
  thumbnailWidthAtom,
} from '~/atoms/gallery'
import { IconButton } from '~/components/IconButton'
import { Slider } from '~/components/Slider'
import { useDeletePhoto } from '~/hooks/useDeletePhoto'
import { useOpenFolder } from '~/hooks/useOpenFolder'
import { cn } from '~/lib/cn'
import { TabStrip } from '~/modules/tabs/TabStrip'
import Delete2Regular from '~icons/mingcute/delete-2-line'
import Refresh2Regular from '~icons/mingcute/refresh-2-line'

/**
 * The tab bar across the window's top: the tabs, then the room the active
 * tab puts its folder's controls in (see FolderControls), through
 * `controlsRef`.
 */
export function Toolbar({ controlsRef }: { controlsRef: (el: HTMLDivElement | null) => void }) {
  return (
    // Left padding clears the native traffic lights; the fixed height keeps the
    // row from growing with the slider. The top padding centers the controls on
    // the tabs' midline, as the traffic lights are (TrafficLightPosition in main.go).
    <div data-drag-region className="flex h-[41px] items-center gap-1 bg-material-opaque pt-[7px] pr-3 pl-[84px]">
      <TabStrip />
      {/* Empty space between the tabs and the actions - still a drag handle. */}
      <div className="min-w-6 grow" />
      <div className="flex shrink-0" ref={controlsRef} />
    </div>
  )
}

/** The controls of the folder a tab shows, which it puts in the tab bar. */
export function FolderControls() {
  const { t } = useTranslation()
  const currentFolder = useAtomValue(currentFolderAtom)
  const isScanning = useAtomValue(isScanningAtom)
  const selectedIds = useAtomValue(selectedPhotoIdsAtom)
  const photos = useAtomValue(filteredPhotosAtom)
  const bulkDeleteBlocked = useAtomValue(bulkDeleteBlockedAtom) && selectedIds.size > 1
  const [thumbnailWidth, setThumbnailWidth] = useAtom(thumbnailWidthAtom)
  const { navigateToFolder } = useOpenFolder()
  const deletePhoto = useDeletePhoto(currentFolder)

  return (
    // The folder's controls keep their room on the new-tab page, only hidden:
    // the tabs, which shrink to fit, would otherwise widen at once on switching.
    <div aria-hidden={!currentFolder} className={cn('flex shrink-0 items-center gap-1', !currentFolder && 'invisible')}>
      {/* The whole track is clickable, not just the thumb, so none of it
          may drag the window. */}
      <div data-no-drag className="mr-2 w-48 shrink-0">
        {/* Also ⌘= / ⌘- / ⌘0, or a pinch on the grid. */}
        <Slider
          label={t('gallery.thumbnailSize')}
          max={THUMBNAIL_WIDTH_MAX}
          min={THUMBNAIL_WIDTH_MIN}
          showValue={false}
          step={10}
          value={thumbnailWidth}
          onChange={setThumbnailWidth}
        />
      </div>
      <IconButton
        disabled={selectedIds.size === 0 || bulkDeleteBlocked}
        icon={Delete2Regular}
        label={bulkDeleteBlocked ? t('gallery.bulkDeleteWaits') : t('gallery.deleteSelected')}
        onClick={() => void deletePhoto(photos.filter((p) => selectedIds.has(p.id)))}
      />
      <IconButton
        disabled={!currentFolder || isScanning}
        icon={Refresh2Regular}
        iconClassName={isScanning ? 'animate-spin' : undefined}
        label={t('gallery.rescan')}
        onClick={() => currentFolder && void navigateToFolder(currentFolder)}
      />
    </div>
  )
}
