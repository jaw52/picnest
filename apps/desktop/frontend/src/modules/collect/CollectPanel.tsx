import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { recentFoldersAtom } from '~/atoms/recentFolders'
import { DropdownMenu } from '~/components/ContextMenu'
import { IconButton } from '~/components/IconButton'
import { cn } from '~/lib/cn'
import { convertPreviewSrc, openPath } from '~/lib/native'
import type { CollectItem } from '~/mygo'
import { App as GoApp, events } from '~/mygo'
import CheckCircleRegular from '~icons/mingcute/check-circle-line'
import CheckRegular from '~icons/mingcute/check-line'
import CloseCircleRegular from '~icons/mingcute/close-circle-line'
import DownRegular from '~icons/mingcute/down-small-line'
import DownloadRegular from '~icons/mingcute/download-2-line'
import FolderRegular from '~icons/mingcute/folder-line'
import FolderOpenRegular from '~icons/mingcute/folder-open-line'
import LoadingRegular from '~icons/mingcute/loading-3-line'

function fileName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function Item({ item }: { item: CollectItem }) {
  const { t } = useTranslation()
  const detail =
    item.status === 'saving'
      ? t('collect.saving')
      : item.status === 'failed'
        ? t('collect.failed')
        : host(item.pageUrl) || t('collect.saved')
  return (
    <div className="flex items-center gap-2.5 rounded-item p-1" title={item.error || item.pageUrl}>
      {item.path ? (
        <img
          alt=""
          className="size-10 shrink-0 rounded-md bg-fill object-cover"
          src={convertPreviewSrc(item.path, 128)}
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-fill text-text-secondary">
          <DownloadRegular className="size-4 shrink-0" />
        </span>
      )}
      <span className="flex min-w-0 grow flex-col">
        <span className="truncate text-caption">{item.path ? fileName(item.path) : t('collect.picture')}</span>
        <span className={cn('truncate text-caption', item.status === 'failed' ? 'text-red' : 'text-text-secondary')}>
          {detail}
        </span>
      </span>
      {item.status === 'saving' && <LoadingRegular className="size-4 shrink-0 animate-spin text-text-secondary" />}
      {item.status === 'saved' && <CheckCircleRegular className="size-4 shrink-0 text-green" />}
      {item.status === 'failed' && <CloseCircleRegular className="size-4 shrink-0 text-red" />}
    </div>
  )
}

/**
 * Where dropped pictures go: one of the folders added on the new-tab page.
 * The Go side keeps the pick (see collect.go); while none is picked, or the
 * picked one is no longer listed, the first listed folder is.
 */
function SaveTarget() {
  const { t } = useTranslation()
  const folders = useAtomValue(recentFoldersAtom)
  // undefined until the Go side says; "" for none.
  const [target, setTarget] = useState<string>()

  useEffect(() => {
    void GoApp.collectTarget().then(setTarget)
  }, [])

  const pick = (dir: string) => {
    setTarget(dir)
    void GoApp.setCollectTarget(dir)
  }

  const current = target === undefined ? undefined : (folders.find((folder) => folder.path === target) ?? folders[0])
  // Tells the Go side when the pick falls to the first folder.
  useEffect(() => {
    if (target !== undefined && current?.path !== target) void GoApp.setCollectTarget(current?.path ?? '')
  }, [target, current])

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      <DropdownMenu
        items={folders.map((folder) => ({
          id: folder.path,
          label: folder.name,
          icon: folder.path === current?.path ? CheckRegular : FolderRegular,
          onSelect: () => pick(folder.path),
        }))}
        trigger={
          <button
            className="-ml-1.5 flex h-7 min-w-0 grow cursor-pointer items-center gap-1.5 rounded-item px-1.5 text-caption text-text enabled:hover:bg-fill disabled:cursor-default"
            disabled={folders.length === 0}
            title={current?.path}
            type="button"
          >
            <span className="shrink-0 text-text-secondary">{t('collect.saveTo')}</span>
            <FolderRegular className="size-3.5 shrink-0" />
            <span className="wght-semibold truncate">
              {current?.name ?? (folders.length === 0 ? t('collect.noFolders') : t('collect.pickFolder'))}
            </span>
            <DownRegular className="size-3.5 shrink-0 text-text-secondary" />
          </button>
        }
      />
      <IconButton
        disabled={!current}
        icon={FolderOpenRegular}
        label={t('collect.openFolder')}
        onClick={() => current && void openPath(current.path)}
      />
    </div>
  )
}

/**
 * The panel under the menu bar icon: where a picture dragged from a web page
 * is dropped to be collected, and the pictures dropped so far. The Go side
 * takes the drop itself (see collect_darwin.go) and says when one is over.
 */
export function CollectPanel() {
  const { t } = useTranslation()
  const [items, setItems] = useState<CollectItem[]>([])
  const [over, setOver] = useState(false)

  useEffect(() => {
    void GoApp.collectedItems().then(setItems)
    const offItems = events.collectChanged.on(setItems)
    const offHover = events.collectHover.on(setOver)
    return () => {
      offItems()
      offHover()
    }
  }, [])

  return (
    <div className="box-border flex h-screen flex-col gap-3 overflow-hidden rounded-container bg-background p-3 text-text">
      <div
        className={cn(
          'flex h-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-item border-[1.5px] transition-[border-color,background-color,color,transform] duration-150 ease-out-expo',
          over
            ? 'scale-102 border-solid border-blue bg-blue/10 text-blue'
            : 'border-dashed border-border text-text-secondary',
        )}
      >
        <DownloadRegular className="size-6" />
        <span className="wght-semibold text-caption">{over ? t('collect.release') : t('collect.dropHere')}</span>
      </div>
      <div className="-mx-1 flex min-h-0 grow flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => (
          <Item item={item} key={item.id} />
        ))}
      </div>
      <SaveTarget />
    </div>
  )
}
