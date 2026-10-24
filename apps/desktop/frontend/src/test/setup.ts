import { config, enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'
import { i18n, setLanguage } from '~/i18n'

// happy-dom doesn't implement HTMLImageElement.decode; the lightbox decodes
// photos before showing them. Resolving at once stands in for a decoded image.
HTMLImageElement.prototype.decode ??= async () => {}

// A cancelled animation rejects its `finished` promise, which the Web
// Animations spec marks as handled; happy-dom doesn't, so every animation
// motion stops would surface as an unhandled rejection.
const cancel = Animation.prototype.cancel
Animation.prototype.cancel = function (this: Animation) {
  this.finished.catch(() => {})
  cancel.call(this)
}

// Components render in Chinese, the language the tests query by.
setLanguage('zh-CN')
config.global.plugins = [i18n]

// Each test's components go once it ends, with their window listeners.
enableAutoUnmount(afterEach)
