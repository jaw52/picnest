export interface DecodedImages {
  /** Resolves once `src` is ready to paint, or failed to load, so callers never hang. */
  decode: (src: string) => Promise<void>
  /** Drops every image not listed. */
  retain: (srcs: string[]) => void
  /** Whether `src` is decoded and held, so an `<img>` of it paints at once. */
  isDecoded: (src: string) => boolean
}

/**
 * Decodes images ahead of showing them. Holding the decoded elements keeps
 * them in the webview's memory cache, so an `<img>` with the same src paints
 * on its first frame instead of blank.
 */
export function useDecodedImages(): DecodedImages {
  const images = new Map<string, HTMLImageElement>()
  const decoded = new Set<string>()

  async function decode(src: string) {
    let image = images.get(src)
    if (!image) {
      image = new Image()
      image.src = src
      images.set(src, image)
    }
    const held = image
    return held.decode().then(() => {
      if (images.get(src) === held)
        decoded.add(src)
    }).catch(() => {})
  }

  function retain(srcs: string[]) {
    for (const src of images.keys()) {
      if (srcs.includes(src))
        continue
      images.delete(src)
      decoded.delete(src)
    }
  }

  return { decode, retain, isDecoded: src => decoded.has(src) }
}
