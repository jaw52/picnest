import type { FolderEntry } from '~/types/folder'
import * as stylex from '@stylexjs/stylex'
import { useCallback, useEffect, useState } from 'react'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useTabs } from '~/hooks/useTabs'
import { listSubfolders } from '~/lib/backend'
import { FolderCard } from '~/modules/tabs/FolderCard'
import { colors } from '~/theme/colors.stylex'
import { text } from '~/theme/text'

const styles = stylex.create({
  centered: {
    display: 'flex',
    minHeight: '60vh',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors['--ps-muted-foreground'],
  },
  page: {
    paddingTop: 32,
    paddingInline: 16,
    paddingBottom: 32,
    marginInline: 'auto',
    maxWidth: 760,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
    gap: 4,
    // Pull the cards' own padding out to the column edge.
    marginInline: -8,
  },
})

/**
 * A folder with no photos of its own. When it only groups other folders,
 * those are what it holds, so they are laid out to open instead.
 */
export function EmptyFolder({ folderPath }: { folderPath: string }) {
  const { openInActiveTab } = useTabs()
  const deleteFolder = useDeleteFolder()
  const [subfolders, setSubfolders] = useState<FolderEntry[] | null>(null)

  const load = useCallback(
    () => listSubfolders(folderPath).catch((error) => {
      console.warn(`failed to list subfolders of ${folderPath}:`, error)
      return []
    }),
    [folderPath],
  )
  useEffect(() => {
    let cancelled = false
    void load().then((entries) => {
      if (!cancelled)
        setSubfolders(entries)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  // Nothing until the subfolders are in, rather than a notice that turns into a grid.
  if (subfolders === null)
    return null
  if (subfolders.length === 0)
    return <div {...stylex.props(styles.centered, text.body)}>这个文件夹里没有图片</div>

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.grid)}>
        {subfolders.map(folder => (
          <FolderCard
            key={folder.path}
            path={folder.path}
            name={folder.name}
            onOpen={() => openInActiveTab(folder.path)}
            onDelete={() => void deleteFolder(folder.path).then(load).then(setSubfolders)}
          />
        ))}
      </div>
    </div>
  )
}
