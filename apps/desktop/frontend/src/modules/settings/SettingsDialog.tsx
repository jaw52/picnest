import type { CacheClearProgress, LanguagePreference } from '~/mygo'
import { Dialog } from '@base-ui/react/dialog'
import * as stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseRegular from '~icons/mingcute/close-line'
import { folderRoots, recentFoldersAtom } from '~/atoms/recentFolders'
import { languageStateAtom, settingsOpenAtom } from '~/atoms/settings'
import { Button } from '~/components/Button'
import { IconButton } from '~/components/IconButton'
import { ProgressRing } from '~/components/ProgressRing'
import { TabsSubtle, TabsSubtleItem } from '~/components/TabsSubtle'
import { SurfaceProvider } from '~/context/surface'
import { clearThumbnailCache } from '~/hooks/useThumbnail'
import { changeLanguage } from '~/i18n'
import { formatFileSize } from '~/lib/format'
import { App, events } from '~/mygo'
import { colors } from '~/theme/colors.stylex'
import { dialog } from '~/theme/dialog'
import { surfaceStyles } from '~/theme/surface'
import { text, weight } from '~/theme/text'

const SURFACE_LEVEL = 3

const LANGUAGES: LanguagePreference[] = ['system', 'zh-CN', 'en']

const styles = stylex.create({
  popup: {
    gap: 16,
    width: 'min(440px, calc(100vw - 64px))',
    padding: 20,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 2 },
  title: { display: 'flex', alignItems: 'baseline', gap: 8 },
  hint: { color: colors['--ps-muted-foreground'] },
  action: { flexShrink: 0 },
  progress: { display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' },
})

type CacheState = 'idle' | 'clearing' | 'cleared'

/**
 * The photo cache's size, with a button to clear it. Mounted while Settings
 * is open, so each opening measures afresh.
 */
function PhotoCacheRow() {
  const { t } = useTranslation()
  const recentFolders = useAtomValue(recentFoldersAtom)
  // The added folders' subfolders are measured and cleared with them.
  const folders = useMemo(() => folderRoots(recentFolders).map(f => f.path), [recentFolders])
  const [size, setSize] = useState<number | null>(null)
  const [state, setState] = useState<CacheState>('idle')
  const [progress, setProgress] = useState<CacheClearProgress>({ done: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    void App.photoCacheSize(folders).then((bytes) => {
      if (!cancelled)
        setSize(bytes)
    })
    return () => {
      cancelled = true
    }
  }, [folders])

  const clear = async () => {
    if (state !== 'idle')
      return
    setState('clearing')
    setProgress({ done: 0, total: 0 })
    const off = events.cacheClearProgress.on(setProgress)
    try {
      await App.clearPhotoCache(folders)
      clearThumbnailCache()
      setSize(await App.photoCacheSize(folders))
      setState('cleared')
    }
    catch (error) {
      console.warn('failed to clear the photo cache:', error)
      setState('idle')
    }
    finally {
      off()
    }
  }

  return (
    <div {...stylex.props(styles.row)}>
      <div {...stylex.props(styles.label)}>
        <span {...stylex.props(styles.title)}>
          <span {...stylex.props(text.body)}>{t('settings.cache')}</span>
          <span {...stylex.props(text.caption, styles.hint)}>
            {size === null ? t('settings.cacheMeasuring') : formatFileSize(size)}
          </span>
        </span>
        <span {...stylex.props(text.caption, styles.hint)}>{t('settings.cacheHint')}</span>
      </div>
      {/* The progress shows in the button itself, which keeps focus and its place in the row. */}
      <Button
        variant="secondary"
        size="compact"
        disabled={state === 'cleared' || size === 0}
        onClick={() => void clear()}
        xstyle={styles.action}
      >
        {state === 'clearing'
          ? (
              <span {...stylex.props(styles.progress)}>
                <ProgressRing label={t('settings.clearingCache')} value={progress.done} max={progress.total} size={14} />
                {progress.total > 0 ? Math.floor(progress.done / progress.total * 100) : 0}
                %
              </span>
            )
          : state === 'cleared' ? t('settings.cacheCleared') : t('settings.clearCache')}
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
    'system': t('settings.system'),
    'zh-CN': '简体中文',
    'en': 'English',
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
        <Dialog.Backdrop {...stylex.props(dialog.backdrop)} />
        <SurfaceProvider value={SURFACE_LEVEL}>
          <Dialog.Popup {...stylex.props(dialog.popup, styles.popup, ...surfaceStyles(SURFACE_LEVEL, 8))}>
            <div {...stylex.props(styles.header)}>
              <Dialog.Title {...stylex.props(text.title, weight.semibold)}>{t('settings.title')}</Dialog.Title>
              <Dialog.Close render={<IconButton label={t('common.close')} icon={CloseRegular} />} />
            </div>
            <div {...stylex.props(styles.row)}>
              <span {...stylex.props(text.body)}>{t('settings.language')}</span>
              <TabsSubtle
                selectedIndex={Math.max(0, LANGUAGES.indexOf(languageState.preference))}
                onSelect={index => pickLanguage(LANGUAGES[index])}
              >
                {LANGUAGES.map((preference, index) => (
                  <TabsSubtleItem key={preference} index={index} label={languageNames[preference]} />
                ))}
              </TabsSubtle>
            </div>
            <PhotoCacheRow />
          </Dialog.Popup>
        </SurfaceProvider>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
