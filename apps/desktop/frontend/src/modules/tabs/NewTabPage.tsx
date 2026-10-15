import * as stylex from '@stylexjs/stylex'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import NewFolderRegular from '~icons/mingcute/new-folder-line'
import { recentFoldersAtom, withFolderForgotten } from '~/atoms/recentFolders'
import { Button } from '~/components/Button'
import { useSize } from '~/context/size'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useTabs } from '~/hooks/useTabs'
import { colors } from '~/theme/colors.stylex'
import { text, weight } from '~/theme/text'

import { FolderCard } from './FolderCard'
import { LibraryCard } from './LibraryCard'

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
 * What an empty tab shows: add a folder, open the Photos library, or open
 * one of the folders added before. Each opens in its own tab, so this page
 * stays open.
 */
export function NewTabPage() {
  const { t } = useTranslation()
  const [recentFolders, setRecentFolders] = useAtom(recentFoldersAtom)
  const { addFolder, openInNewTab } = useTabs()
  const deleteFolder = useDeleteFolder()
  const size = useSize()

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.column)}>
        <div {...stylex.props(styles.intro)}>
          <span {...stylex.props(text.title, weight.semibold)}>{t('common.newTab')}</span>
          <span {...stylex.props(styles.muted, text.body)}>
            {t('newTab.intro')}
          </span>
        </div>
        <Button
          variant="secondary"
          leadingIcon={NewFolderRegular}
          onClick={() => void addFolder()}
          xstyle={styles.addButton}
        >
          {t('newTab.addFolder')}
        </Button>
        <div {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.heading, size.type.caption, weight.semibold)}>
            {t('newTab.fromPhotos')}
          </div>
          <div {...stylex.props(styles.grid)}>
            <LibraryCard />
          </div>
        </div>
        {recentFolders.length > 0 && (
          <div {...stylex.props(styles.section)}>
            <div {...stylex.props(styles.heading, size.type.caption, weight.semibold)}>
              {t('newTab.added')}
            </div>
            <div {...stylex.props(styles.grid)}>
              {recentFolders.map(folder => (
                <FolderCard
                  key={folder.path}
                  path={folder.path}
                  name={folder.name}
                  onOpen={() => openInNewTab(folder.path)}
                  // Only forgets the shortcut; tabs showing it stay open.
                  onRemove={() => setRecentFolders(prev => withFolderForgotten(prev, folder.path))}
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
