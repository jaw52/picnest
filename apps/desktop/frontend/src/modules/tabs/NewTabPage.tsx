import * as stylex from '@stylexjs/stylex'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import AddRegular from '~icons/mingcute/add-line'
import { recentFoldersAtom, withFolderForgotten } from '~/atoms/recentFolders'
import { useSize } from '~/context/size'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useTabs } from '~/hooks/useTabs'
import { colors } from '~/theme/colors.stylex'
import { motion, radius } from '~/theme/layout.stylex'
import { text, weight } from '~/theme/text'

import { FolderCard } from './FolderCard'
import { LibraryCard } from './LibraryCard'
import { cardMarker } from './markers.stylex'

const styles = stylex.create({
  page: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 72,
    paddingInline: 16,
    paddingBottom: 32,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
    width: '100%',
    maxWidth: 760,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  heading: { margin: 0, color: colors['--ps-muted-foreground'] },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
    gap: 4,
    // Pull the cards' own padding out to the column edge.
    marginInline: -8,
  },
  addCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: colors['--ps-foreground'],
  },
  // Sits where a folder icon would, so the grid's rows line up.
  addWell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'content-box',
    width: 104 - 2,
    height: 84 - 2,
    margin: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.container,
    borderColor: {
      default: colors['--ps-border'],
      [stylex.when.ancestor(':hover', cardMarker)]: colors['--ps-muted-foreground'],
    },
    color: {
      default: colors['--ps-muted-foreground'],
      [stylex.when.ancestor(':hover', cardMarker)]: colors['--ps-foreground'],
    },
    backgroundColor: {
      default: 'transparent',
      [stylex.when.ancestor(':hover', cardMarker)]: colors['--ps-hover'],
    },
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: motion.fast,
  },
  addIcon: { width: 24, height: 24 },
  label: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  hint: { color: colors['--ps-muted-foreground'] },
})

/** A placeholder at the end of the folders that adds another one. */
function AddFolderCard({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onAdd} {...stylex.props(cardMarker, styles.addCard)}>
      <span aria-hidden {...stylex.props(styles.addWell)}>
        <AddRegular {...stylex.props(styles.addIcon)} />
      </span>
      <span {...stylex.props(styles.label)}>
        <span {...stylex.props(text.caption)}>{t('newTab.addFolder')}</span>
        <span {...stylex.props(styles.hint, text.caption)}>{t('newTab.dropHint')}</span>
      </span>
    </button>
  )
}

/**
 * What an empty tab shows: the Photos library, and the folders added before
 * with a way to add another. Each opens in its own tab, so this page stays
 * open.
 */
export function NewTabPage() {
  const [recentFolders, setRecentFolders] = useAtom(recentFoldersAtom)
  const { addFolder, openInNewTab } = useTabs()
  const deleteFolder = useDeleteFolder()
  const { t } = useTranslation()
  const size = useSize()

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.column)}>
        <section {...stylex.props(styles.section)}>
          <h2 {...stylex.props(styles.heading, size.type.caption, weight.semibold)}>
            {t('newTab.library')}
          </h2>
          <div {...stylex.props(styles.grid)}>
            <LibraryCard />
          </div>
        </section>
        <section {...stylex.props(styles.section)}>
          <h2 {...stylex.props(styles.heading, size.type.caption, weight.semibold)}>
            {t('newTab.folders')}
          </h2>
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
            <AddFolderCard onAdd={() => void addFolder()} />
          </div>
        </section>
      </div>
    </div>
  )
}
