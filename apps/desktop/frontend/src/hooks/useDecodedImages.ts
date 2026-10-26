import { useCallback, useRef } from 'react'

/**
 * Decodes images ahead of showing them. `decode(src)` resolves once the
 * image is ready to paint (or failed to load, so callers never hang), and
 * `retain(srcs)` drops every image not listed. Holding the decoded elements
 * keeps them in the webview's memory cache, so an `<img>` with the same src
 * paints on its first frame instead of blank.
 */
export function useDecodedImages() {
  const imagesRef = useRef(new Map<string, HTMLImageElement>())
  const decodedRef = useRef(new Set<string>())

  const decode = useCallback((src: string) => {
    const images = imagesRef.current
    let image = images.get(src)
    if (!image) {
      image = new Image()
      image.src = src
      images.set(src, image)
    }
    return image
      .decode()
      .then(() => {
        if (images.get(src) === image) decodedRef.current.add(src)
      })
      .catch(() => {})
  }, [])

  const retain = useCallback((srcs: string[]) => {
    const images = imagesRef.current
    for (const src of images.keys()) {
      if (srcs.includes(src)) {
        continue
      }

      images.delete(src)
      decodedRef.current.delete(src)
    }
  }, [])

  /** Whether `src` is decoded and held, so an `<img>` of it paints at once. */
  const isDecoded = useCallback((src: string) => decodedRef.current.has(src), [])

  return { decode, retain, isDecoded }
}
