import { isMyGo, onFileDrop as onNativeFileDrop, runtime } from 'mygo-runtime'

import { Native } from '~/mygo'

/**
 * Webview-loadable URL for a file on disk, served by the Go `localfile`
 * scheme. WebView2 serves custom schemes under http://<scheme>.localhost.
 */
export function convertFileSrc(path: string): string {
  const base =
    isMyGo() && runtime().platform === 'win32'
      ? // WebView2 only serves custom schemes over http
        'http://localfile.localhost/'
      : 'localfile://localhost/'
  return `${base}?path=${encodeURIComponent(path)}`
}

/**
 * A photo scaled down to at most `maxEdge` px on its longest side, upright
 * as the photo shows. The backend serves the file as it is when it's no
 * larger, or of a kind it leaves alone (see servePreview).
 */
export function convertPreviewSrc(path: string, maxEdge: number): string {
  return `${convertFileSrc(path)}&edge=${maxEdge}`
}

/**
 * The video of a Live Photo in the Photos library. `modified` names the
 * version, so the backend finds the video it wrote out without asking Photos.
 */
export function convertLiveSrc(path: string, modified: number): string {
  return `${convertFileSrc(path)}&live=1&v=${modified}`
}

export function writeText(text: string): Promise<void> {
  return Native.writeText(text)
}

/** Opens a folder in Finder (or a file in its default app). */
export function openPath(path: string): Promise<void> {
  return Native.openPath(path)
}

export async function pickFolder(options: { title?: string; defaultPath?: string } = {}): Promise<string | null> {
  const selected = await Native.pickFolder(options.title ?? '', options.defaultPath ?? '')
  return selected || null
}

interface DialogOptions {
  kind?: 'info' | 'warning' | 'error'
  title?: string
}

/** Yes/no confirmation; resolves to whether the user confirmed. */
export function ask(message: string, options: DialogOptions = {}): Promise<boolean> {
  return Native.ask(options.title ?? '', message, options.kind ?? 'info')
}

export function message(text: string, options: DialogOptions = {}): Promise<void> {
  return Native.message(options.title ?? '', text, options.kind ?? 'info')
}

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

// Without preventDefault on dragover the drop is refused.
function acceptFileDrag(event: DragEvent) {
  if (hasFiles(event)) event.preventDefault()
}

/**
 * Tracks files dragged onto the window. Hover state comes from the DOM drag
 * events (which don't expose paths); the dropped paths come from MyGo.
 */
export function onFileDrop(handlers: {
  onHover: (hovering: boolean) => void
  onDrop: (paths: string[]) => void
}): () => void {
  // dragenter/dragleave fire for every child crossed, so count the depth.
  let depth = 0
  const enter = (event: DragEvent) => {
    if (!hasFiles(event)) return
    if (depth++ === 0) handlers.onHover(true)
  }
  const leave = (event: DragEvent) => {
    if (!hasFiles(event)) return
    if (--depth <= 0) {
      depth = 0
      handlers.onHover(false)
    }
  }
  const drop = () => {
    depth = 0
    handlers.onHover(false)
  }
  window.addEventListener('dragenter', enter)
  window.addEventListener('dragleave', leave)
  window.addEventListener('dragover', acceptFileDrag)
  window.addEventListener('drop', drop)
  const off = onNativeFileDrop(({ paths }) => handlers.onDrop(paths))
  return () => {
    window.removeEventListener('dragenter', enter)
    window.removeEventListener('dragleave', leave)
    window.removeEventListener('dragover', acceptFileDrag)
    window.removeEventListener('drop', drop)
    off()
  }
}
