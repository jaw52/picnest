import type { LanguagePreference } from '~/mygo'
import { Dialog } from '@base-ui/react/dialog'
import * as stylex from '@stylexjs/stylex'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import CloseRegular from '~icons/mingcute/close-line'
import { languageStateAtom, settingsOpenAtom } from '~/atoms/settings'
import { IconButton } from '~/components/IconButton'
import { TabsSubtle, TabsSubtleItem } from '~/components/TabsSubtle'
import { SurfaceProvider } from '~/context/surface'
import { changeLanguage } from '~/i18n'
import { App } from '~/mygo'
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
})

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
          </Dialog.Popup>
        </SurfaceProvider>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
