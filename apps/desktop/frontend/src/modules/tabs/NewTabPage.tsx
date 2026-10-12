import * as stylex from '@stylexjs/stylex'
import { useAtom } from 'jotai'
import { FolderPlus } from 'lucide-react'
import { useMemo } from 'react'
import { folderRoots, recentFoldersAtom, withFolderRemoved } from '~/atoms/recentFolders'
import { Button } from '~/components/Button'
import { useSize } from '~/context/size'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useTabs } from '~/hooks/useTabs'
import { colors } from '~/theme/colors.stylex'
import { text, weight } from '~/theme/text'

import { FolderCard } from './FolderCard'

const styles = stylex.create({
  page: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 48,
    paddingInline: 16,
    paddingBottom: 32,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 760,
  },
  intro: { display: 'flex', flexDirection: 'column', gap: 4 },
  muted: { color: colors['--ps-muted-foreground'] },
  addButton: { alignSelf: 'flex-start' },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  heading: { color: colors['--ps-muted-foreground'] },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
    gap: 4,
    // Pull the cards' own padding out to the column edge.
    marginInline: -8,
  },
})

/**
 * What an empty tab shows: add a folder, or open one of the folders added
 * before. Folders open in their own tabs, so this page stays open.
 */
export function NewTabPage() {
  const [recentFolders, setRecentFolders] = useAtom(recentFoldersAtom)
  const roots = useMemo(() => folderRoots(recentFolders), [recentFolders])
  const { addFolder, openInNewTab } = useTabs()
  const deleteFolder = useDeleteFolder()
  const size = useSize()

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.column)}>
        <div {...stylex.props(styles.intro)}>
          <span {...stylex.props(text.title, weight.semibold)}>新标签页</span>
          <span {...stylex.props(styles.muted, text.body)}>
            添加一个文件夹，或从下面选择已添加的文件夹，在新标签页中打开。也可以直接把文件夹拖进窗口。
          </span>
        </div>
        <Button
          variant="secondary"
          leadingIcon={FolderPlus}
          onClick={() => void addFolder()}
          xstyle={styles.addButton}
        >
          添加文件夹
        </Button>
        {roots.length > 0 && (
          <div {...stylex.props(styles.section)}>
            <div {...stylex.props(styles.heading, size.type.caption, weight.semibold)}>
              已添加的文件夹
            </div>
            <div {...stylex.props(styles.grid)}>
              {roots.map(folder => (
                <FolderCard
                  key={folder.path}
                  path={folder.path}
                  name={folder.name}
                  onOpen={() => openInNewTab(folder.path)}
                  // Only forgets the shortcut; tabs showing it stay open.
                  onRemove={() => setRecentFolders(prev => withFolderRemoved(prev, folder.path))}
                  onDelete={() => void deleteFolder(folder.path)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
