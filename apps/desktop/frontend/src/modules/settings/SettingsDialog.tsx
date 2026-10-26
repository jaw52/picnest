import { Dialog } from '@base-ui/react/dialog'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { folderRoots, recentFoldersAtom } from '~/atoms/recentFolders'
import { languageStateAtom, settingsOpenAtom } from '~/atoms/settings'
import { Button } from '~/components/Button'
import { IconButton } from '~/components/IconButton'
import { ProgressRing } from '~/components/ProgressRing'
import { TabsSubtle, TabsSubtleItem } from '~/components/TabsSubtle'
import { clearThumbnailCache } from '~/hooks/useThumbnail'
import { changeLanguage } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatFileSize } from '~/lib/format'
import { dialogBackdrop, dialogPopup } from '~/lib/surface'
import type { CacheClearProgress, LanguagePreference } from '~/mygo'
import { App, events } from '~/mygo'
import CloseRegular from '~icons/mingcute/close-line'

const LANGUAGES: LanguagePreference[] = ['system', 'zh-CN', 'en']

type CacheState = 'idle' | 'clearing' | 'cleared'

/**
 * The photo cache's size, with a button to clear it. Mounted while Settings
 * is open, so each opening measures afresh.
 */
function PhotoCacheRow() {
  const { t } = useTranslation()
  const recentFolders = useAtomValue(recentFoldersAtom)
  // The added folders' subfolders are measured and cleared with them.
  const folders = useMemo(() => folderRoots(recentFolders).map((f) => f.path), [recentFolders])
  const [size, setSize] = useState<number | null>(null)
  const [state, setState] = useState<CacheState>('idle')
  const [progress, setProgress] = useState<CacheClearProgress>({ done: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    void App.photoCacheSize(folders).then((bytes) => {
      if (!cancelled) setSize(bytes)
    })
    return () => {
      cancelled = true
    }
  }, [folders])

  const clear = async () => {
    if (state !== 'idle') return
    setState('clearing')
    setProgress({ done: 0, total: 0 })
    const off = events.cacheClearProgress.on(setProgress)
    try {
      await App.clearPhotoCache(folders)
      clearThumbnailCache()
      setSize(await App.photoCacheSize(folders))
      setState('cleared')
    } catch (error) {
      console.warn('failed to clear the photo cache:', error)
      setState('idle')
    } finally {
      off()
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="text-body">{t('settings.cache')}</span>
          <span className="text-caption text-text-secondary">
            {size === null ? t('settings.cacheMeasuring') : formatFileSize(size)}
          </span>
        </span>
        <span className="text-caption text-text-secondary">{t('settings.cacheHint')}</span>
      </div>
      {/* The progress shows in the button itself, which keeps focus and its place in the row. */}
      <Button
        className="shrink-0"
        disabled={state === 'cleared' || size === 0}
        variant="secondary"
        onClick={() => void clear()}
      >
        {state === 'clearing' ? (
          <span className="flex items-center gap-1.5 tabular-nums">
            <ProgressRing label={t('settings.clearingCache')} max={progress.total} size={14} value={progress.done} />
            {progress.total > 0 ? Math.floor((progress.done / progress.total) * 100) : 0}%
          </span>
        ) : state === 'cleared' ? (
          t('settings.cacheCleared')
        ) : (
          t('settings.clearCache')
        )}
      </Button>
    </div>
  )
}

/** Settings, opened from the menu bar (Picnest ▸ Settings…, ⌘,). */
export function SettingsDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useAtom(settingsOpenAtom)
  const [languageState, setLanguageState] = useAtom(languageStateAtom)

  // Each language is named in itself, so it can be found whatever the app
  // is shown in.
  const languageNames: Record<LanguagePreference, string> = {
    system: t('settings.system'),
    'zh-CN': '简体中文',
    en: 'English',
  }

  const pickLanguage = (preference: LanguagePreference) => {
    void App.setLanguage(preference).then((state) => {
      changeLanguage(state.language)
      setLanguageState(state)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className={cn(dialogPopup, 'w-[min(440px,calc(100vw-64px))] gap-4 p-5')}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="wght-semibold text-title">{t('settings.title')}</Dialog.Title>
            <Dialog.Close render={<IconButton icon={CloseRegular} label={t('common.close')} />} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-body">{t('settings.language')}</span>
            <TabsSubtle
              selectedIndex={Math.max(0, LANGUAGES.indexOf(languageState.preference))}
              onSelect={(index) => pickLanguage(LANGUAGES[index])}
            >
              {LANGUAGES.map((preference, index) => (
                <TabsSubtleItem index={index} key={preference} label={languageNames[preference]} />
              ))}
            </TabsSubtle>
          </div>
          <PhotoCacheRow />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
