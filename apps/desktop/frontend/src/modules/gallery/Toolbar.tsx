import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import Delete2Regular from '~icons/mingcute/delete-2-line'
import Refresh2Regular from '~icons/mingcute/refresh-2-line'
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
import { TabStrip } from '~/modules/tabs/TabStrip'
import { colors } from '~/theme/colors.stylex'

const spin = stylex.keyframes({
  to: { transform: 'rotate(360deg)' },
})

const styles = stylex.create({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    // The toolbar occupies the window's top-left corner; keep the tabs
    // clear of the native traffic lights.
    paddingLeft: 84,
    paddingRight: 12,
    // A fixed height, so the row doesn't grow when the (taller) thumbnail
    // slider shows. No bottom border: the active tab runs into the page.
    height: 41,
    // Centers the controls on the tabs' midline, y=24 (28px tabs, 3px off the
    // bottom), as are the traffic lights (TrafficLightPosition in main.go).
    paddingTop: 7,
    backgroundColor: colors['--ps-titlebar'],
  },
  // Empty space between the tabs and the actions - still a drag handle.
  spacer: { flexGrow: 1, minWidth: 24 },
  slot: { display: 'flex', flexShrink: 0 },
  // The folder's controls keep their room on the new-tab page, only hidden:
  // the tabs, which shrink to fit, would otherwise widen at once on switching.
  controls: { display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 },
  hidden: { visibility: 'hidden' },
  slider: { width: 192, flexShrink: 0, marginRight: 8 },
  spinning: {
    animationName: spin,
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
})

/**
 * The tab bar across the window's top: the tabs, then the room the active
 * tab puts its folder's controls in (see FolderControls), through
 * `controlsRef`.
 */
export function Toolbar({ controlsRef }: { controlsRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div data-drag-region {...stylex.props(styles.toolbar)}>
      <TabStrip />
      <div {...stylex.props(styles.spacer)} />
      <div ref={controlsRef} {...stylex.props(styles.slot)} />
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
    <div {...stylex.props(styles.controls, !currentFolder && styles.hidden)} aria-hidden={!currentFolder}>
      {/* The whole track is clickable, not just the thumb, so none of it
          may drag the window. */}
      <div data-no-drag {...stylex.props(styles.slider)}>
        {/* Also ⌘= / ⌘- / ⌘0, or a pinch on the grid. */}
        <Slider
          label={t('gallery.thumbnailSize')}
          min={THUMBNAIL_WIDTH_MIN}
          max={THUMBNAIL_WIDTH_MAX}
          step={10}
          value={thumbnailWidth}
          onChange={setThumbnailWidth}
          showValue={false}
        />
      </div>
      <IconButton
        label={bulkDeleteBlocked ? t('gallery.bulkDeleteWaits') : t('gallery.deleteSelected')}
        icon={Delete2Regular}
        disabled={selectedIds.size === 0 || bulkDeleteBlocked}
        onClick={() => void deletePhoto(photos.filter(p => selectedIds.has(p.id)))}
      />
      <IconButton
        label={t('gallery.rescan')}
        icon={Refresh2Regular}
        iconClassName={isScanning ? stylex.props(styles.spinning).className : undefined}
        disabled={!currentFolder || isScanning}
        onClick={() => currentFolder && void navigateToFolder(currentFolder)}
      />
    </div>
  )
}
