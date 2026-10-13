import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue } from 'jotai'
import { PanelRightClose, PanelRightOpen, RefreshCw, Trash2 } from 'lucide-react'
import {
  bulkDeleteBlockedAtom,
  currentFolderAtom,
  filteredPhotosAtom,
  isScanningAtom,
  selectedPhotoIdsAtom,
  thumbnailWidthAtom,
} from '~/atoms/gallery'
import { infoSidebarCollapsedAtom } from '~/atoms/layout'
import { activeTabPathAtom } from '~/atoms/tabs'
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
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors['--ps-border'],
    // The toolbar occupies the window's top-left corner; keep the tabs
    // clear of the native traffic lights.
    paddingLeft: 84,
    paddingRight: 12,
    // A fixed height, so the row doesn't grow when the (taller) thumbnail
    // slider shows: 40px plus the border, which the traffic lights are
    // centered on (see TrafficLightPosition in main.go).
    height: 41,
  },
  // Empty space between the tabs and the actions - still a drag handle.
  spacer: { flexGrow: 1, minWidth: 24 },
  slider: { width: 192, flexShrink: 0, marginRight: 8 },
  spinning: {
    animationName: spin,
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
})

export function Toolbar() {
  const tabPath = useAtomValue(activeTabPathAtom)
  const currentFolder = useAtomValue(currentFolderAtom)
  const isScanning = useAtomValue(isScanningAtom)
  const selectedIds = useAtomValue(selectedPhotoIdsAtom)
  const photos = useAtomValue(filteredPhotosAtom)
  const bulkDeleteBlocked = useAtomValue(bulkDeleteBlockedAtom) && selectedIds.size > 1
  const [infoCollapsed, setInfoCollapsed] = useAtom(infoSidebarCollapsedAtom)
  const [thumbnailWidth, setThumbnailWidth] = useAtom(thumbnailWidthAtom)
  const { navigateToFolder } = useOpenFolder()
  const deletePhoto = useDeletePhoto(currentFolder)

  return (
    <div data-drag-region {...stylex.props(styles.toolbar)}>
      <TabStrip />
      <div {...stylex.props(styles.spacer)} />
      {currentFolder && (
        // The whole track is clickable, not just the thumb, so none of it
        // may drag the window.
        <div data-no-drag {...stylex.props(styles.slider)}>
          <Slider
            label="缩略图"
            min={120}
            max={480}
            step={10}
            value={thumbnailWidth}
            onChange={setThumbnailWidth}
            formatValue={value => `${value}px`}
          />
        </div>
      )}
      {currentFolder && (
        <IconButton
          label={bulkDeleteBlocked ? '缩略图生成完后才能批量删除' : '删除选中项'}
          icon={Trash2}
          disabled={selectedIds.size === 0 || bulkDeleteBlocked}
          onClick={() => void deletePhoto(photos.filter(p => selectedIds.has(p.id)))}
        />
      )}
      {currentFolder && (
        <IconButton
          label="重新扫描"
          icon={RefreshCw}
          iconClassName={isScanning ? stylex.props(styles.spinning).className : undefined}
          disabled={isScanning}
          onClick={() => navigateToFolder(currentFolder)}
        />
      )}
      {tabPath !== null && (
        <IconButton
          label={infoCollapsed ? '展开信息栏' : '收起信息栏'}
          icon={infoCollapsed ? PanelRightOpen : PanelRightClose}
          onClick={() => setInfoCollapsed(v => !v)}
        />
      )}
    </div>
  )
}
