import '@testing-library/jest-dom/vitest'

import { initI18n } from '~/i18n'

// jsdom doesn't implement ResizeObserver; the masonry grid uses it to track
// its container's width. The real WebKit webview has it natively.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// Stub only implements the methods the grid uses.
globalThis.ResizeObserver = ResizeObserverStub

// jsdom doesn't implement matchMedia; motion and the Fluid
// Functionalism components query it (reduced motion, pointer type).
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList

// jsdom doesn't implement HTMLImageElement.decode; the lightbox decodes
// photos before showing them. Resolving at once stands in for a decoded image.
HTMLImageElement.prototype.decode ??= () => Promise.resolve()

// Components render in Chinese, the language the tests query by.
initI18n('zh-CN')
