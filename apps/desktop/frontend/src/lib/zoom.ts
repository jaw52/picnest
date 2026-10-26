/** A photo's pan and zoom: `scale` 1 is "fit", `x`/`y` the offset in px from the centered position. */
export interface View {
  scale: number
  x: number
  y: number
}

export const FIT: View = { scale: 1, x: 0, y: 0 }

/**
 * The photo's laid-out (unscaled) size and the viewport it sits in, in px.
 * `offsetX`/`offsetY` is how far the photo's resting center is from the
 * viewport's center (the caption's strip pushes it off-center vertically).
 */
export interface Box {
  imageH: number
  imageW: number
  offsetX?: number
  offsetY?: number
  viewH: number
  viewW: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** One axis: the photo covers the viewport once it is bigger than it, and stays centered while smaller. */
function clampAxis(offset: number, size: number, view: number, rest: number) {
  const slack = (size - view) / 2
  if (slack <= 0) return 0
  // `|| 0` turns a -0 from clamping into 0.
  return clamp(offset, -slack - rest, slack - rest) || 0
}

export function clampView(view: View, box: Box): View {
  return {
    scale: view.scale,
    x: clampAxis(view.x, box.imageW * view.scale, box.viewW, box.offsetX ?? 0),
    y: clampAxis(view.y, box.imageH * view.scale, box.viewH, box.offsetY ?? 0),
  }
}

/**
 * Zooms to `scale` (kept within 1..max) so the spot under the cursor stays put.
 * `cx`/`cy` are the cursor's offset from where the photo is centered, in px.
 */
export function zoomAbout(view: View, scale: number, cx: number, cy: number, box: Box, max: number): View {
  const next = clamp(scale, 1, max)
  const k = next / view.scale
  return clampView({ scale: next, x: cx - k * (cx - view.x), y: cy - k * (cy - view.y) }, box)
}

/** The scale at which one image pixel is one CSS pixel, or 2 when the photo is already shown at that size. */
export function actualSizeScale(naturalW: number, imageW: number) {
  const scale = imageW > 0 ? naturalW / imageW : 1
  return scale > 1.05 ? scale : 2
}
