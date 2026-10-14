import type { LanguagePreference } from '~/mygo'
import { Dialog } from '@base-ui/react/dialog'
import { CloseRegular } from '@mingcute/react/core-regular'
import * as stylex from '@stylexjs/stylex'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { languageStateAtom, settingsOpenAtom } from '~/atoms/settings'
import { IconButton } from '~/components/IconButton'
import { TabsSubtle, TabsSubtleItem } from '~/components/TabsSubtle'
import { SurfaceProvider } from '~/context/surface'
import { changeLanguage } from '~/i18n'
import { App } from '~/mygo'
import { motion as motionTokens, radius } from '~/theme/layout.stylex'
import { surfaceStyles } from '~/theme/surface'
import { text, weight } from '~/theme/text'

const SURFACE_LEVEL = 3

const LANGUAGES: LanguagePreference[] = ['system', 'zh-CN', 'en']

const hidden = ':is([data-starting-style], [data-ending-style])'

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    backgroundColor: 'rgb(0 0 0 / 0.4)',
    opacity: { default: 1, [hidden]: 0 },
    transitionProperty: 'opacity',
    transitionDuration: '150ms',
  },
  popup: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxSizing: 'border-box',
    width: 'min(440px, calc(100vw - 64px))',
    padding: 20,
    borderRadius: radius.container,
    outline: 'none',
    opacity: { default: 1, [hidden]: 0 },
    transform: {
      default: 'translate(-50%, -50%)',
      [hidden]: 'translate(-50%, -50%) scale(0.97)',
    },
    transitionProperty: 'opacity, transform',
    transitionDuration: '150ms',
    transitionTimingFunction: motionTokens.easeOut,
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
        <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
        <SurfaceProvider value={SURFACE_LEVEL}>
          <Dialog.Popup {...stylex.props(styles.popup, ...surfaceStyles(SURFACE_LEVEL, 8))}>
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
