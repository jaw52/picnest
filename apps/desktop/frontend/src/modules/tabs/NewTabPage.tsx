import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'

import { recentFoldersAtom, withFolderForgotten } from '~/atoms/recentFolders'
import { useDeleteFolder } from '~/hooks/useDeleteFolder'
import { useTabs } from '~/hooks/useTabs'
import AddRegular from '~icons/mingcute/add-line'

import { cardClass } from './card'
import { FolderCard } from './FolderCard'
import { LibraryCard } from './LibraryCard'

/** A placeholder at the end of the folders that adds another one. */
function AddFolderCard({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  return (
    <button className={cardClass} type="button" onClick={onAdd}>
      {/* Sits where a folder icon would, so the grid's rows line up. */}
      <span
        aria-hidden
        className="m-2 box-content flex h-[82px] w-[102px] items-center justify-center rounded-container border border-dashed border-border text-text-secondary transition-colors duration-80 group-hover/card:border-text-secondary group-hover/card:bg-text/5 group-hover/card:text-text"
      >
        <AddRegular className="size-6" />
      </span>
      <span className="flex flex-col items-center gap-px">
        <span className="text-caption">{t('newTab.addFolder')}</span>
        <span className="text-caption text-text-secondary">{t('newTab.dropHint')}</span>
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

  return (
    <div className="flex justify-center px-4 pt-18 pb-8">
      <div className="flex w-full max-w-190 flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="wght-semibold text-caption text-text-secondary">{t('newTab.library')}</h2>
          {/* The negative margin pulls the cards' own padding out to the column edge. */}
          <div className="-mx-2 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1">
            <LibraryCard />
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="wght-semibold text-caption text-text-secondary">{t('newTab.folders')}</h2>
          <div className="-mx-2 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1">
            {recentFolders.map((folder) => (
              <FolderCard
                key={folder.path}
                name={folder.name}
                path={folder.path}
                onDelete={() => void deleteFolder(folder.path)}
                onOpen={() => openInNewTab(folder.path)}
                // Only forgets the shortcut; tabs showing it stay open.
                onRemove={() => setRecentFolders((prev) => withFolderForgotten(prev, folder.path))}
              />
            ))}
            <AddFolderCard onAdd={() => void addFolder()} />
          </div>
        </section>
      </div>
    </div>
  )
}
