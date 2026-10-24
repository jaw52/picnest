import type { ObjectDirective, Ref, ShallowRef } from 'vue'
import type { ItemRect } from '~/types/fluid-hover'
import { onScopeDispose, shallowRef, watch } from 'vue'

export interface UseFluidHoverOptions {
  /**
   * Which direction to resolve the nearest item along: `y` for vertical
   * lists (the default), closest by top and height; `x` for horizontal
   * strips, closest by left and width; `xy` for 2-D grids, the card closest
   * across rows and columns alike, by straight-line distance to its center.
   */
  axis?: 'x' | 'y' | 'xy'
  /**
   * Whether a click that lands between items (a gap, the padding, past the
   * last row) is routed to the highlighted item, so what is lit is what a
   * click hits. On by default: in a menu or a list the highlight is a
   * promise about the click. Pass `false` where empty space should stay
   * inert.
   */
  gapClick?: boolean
}

export interface FluidHover {
  activeIndex: Ref<number | null>
  itemRects: Readonly<ShallowRef<(ItemRect | undefined)[]>>
  /**
   * True once every registered item has been measured and no remeasure is
   * pending, i.e. `itemRects` describes the current item set. Gate absolutely
   * positioned overlays on it: an overlay that mounts against a rect a later
   * pass still corrects animates from the wrong place to the right one, which
   * reads as the highlight sliding in from another row.
   */
  isMeasured: Readonly<ShallowRef<boolean>>
  /**
   * Counts pointer entries. It steps when the pointer, having entered the
   * container, first moves the highlight, so the highlight keyed on it fades
   * in at the new row instead of sliding over from where it was last (a row
   * lit from the keyboard, or one still fading out).
   */
  session: Readonly<ShallowRef<number>>
  handlers: {
    /** Picks the item nearest the pointer. */
    mousemove: (e: MouseEvent) => void
    mouseenter: () => void
    mouseleave: () => void
    /**
     * Routes a click that lands between items to the highlighted item, so the
     * highlight and the click agree. A click inside an item is left to the
     * item, and so is one on a control between items (a search field).
     */
    click: (e: MouseEvent) => void
  }
  /** Registers a row under its index for as long as it is mounted: `v-fluid-item="index"`. */
  itemDirective: ObjectDirective<HTMLElement, number>
  /** Re-reads the rects synchronously, keeping `isMeasured` as it is. */
  measureItems: () => void
}

interface PickNearestInput {
  axis: 'x' | 'y' | 'xy'
  /** The pointer, in viewport coordinates. */
  point: { x: number, y: number }
  /** Item rects in the container's layout space (sparse: unregistered slots are undefined). */
  rects: readonly (ItemRect | undefined)[]
  /**
   * The container's bounding rect and live scroll / border offsets, which
   * map layout rects into the pointer's viewport space.
   */
  containerRect: { left: number, top: number, width: number, height: number }
  scroll: { x: number, y: number }
  border: { x: number, y: number }
  /**
   * Layout size of the container, so a cumulative ancestor `transform:
   * scale` (a popup mid scale-in) can be factored out per axis.
   */
  layoutSize: { width: number, height: number }
}

/**
 * The rule, as one pure function: an item the pointer is inside wins;
 * otherwise the item whose center is nearest does, so a pointer in a gap, in
 * the padding, or past the last row still lands. `y` and `x` measure one
 * coordinate; `xy` measures the straight line to each center. Ties keep the
 * first item.
 */
function pickNearest({ axis, point, rects, containerRect, scroll, border, layoutSize }: PickNearestInput): number | null {
  const scaleX = layoutSize.width > 0 ? containerRect.width / layoutSize.width : 1
  const scaleY = layoutSize.height > 0 ? containerRect.height / layoutSize.height : 1
  // A rect in the container's layout space, in the pointer's viewport space.
  const toViewport = (r: ItemRect): ItemRect => ({
    left: containerRect.left + (border.x + r.left - scroll.x) * scaleX,
    top: containerRect.top + (border.y + r.top - scroll.y) * scaleY,
    width: r.width * scaleX,
    height: r.height * scaleY,
  })
  let closestIndex: number | null = null
  let closestDistance = Infinity
  let containingIndex: number | null = null

  for (const [index, rect] of rects.entries()) {
    if (!rect)
      continue
    const box = toViewport(rect)
    if (contains(box, point, axis))
      containingIndex = index
    const distance = distanceToCenter(box, point, axis)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  }

  return containingIndex ?? closestIndex
}

function contains(box: ItemRect, point: { x: number, y: number }, axis: PickNearestInput['axis']): boolean {
  switch (axis) {
    case 'x': {
      return point.x >= box.left && point.x <= box.left + box.width
    }
    case 'y': {
      return point.y >= box.top && point.y <= box.top + box.height
    }
    case 'xy': {
      return contains(box, point, 'x') && contains(box, point, 'y')
    }
  }
}

function distanceToCenter(box: ItemRect, point: { x: number, y: number }, axis: PickNearestInput['axis']): number {
  switch (axis) {
    case 'x': {
      return Math.abs(point.x - (box.left + box.width / 2))
    }
    case 'y': {
      return Math.abs(point.y - (box.top + box.height / 2))
    }
    case 'xy': {
      return Math.hypot(distanceToCenter(box, point, 'x'), distanceToCenter(box, point, 'y'))
    }
  }
}

/** Set on the highlighted item (boolean attribute). */
const ACTIVE_ATTR = 'data-fluid-hover-active'

const ACTIVATOR_SELECTOR
  = 'a[href], button, [role=\'menuitem\'], [role=\'menuitemradio\'], [role=\'menuitemcheckbox\'], [role=\'option\'], [role=\'radio\'], [role=\'checkbox\'], [role=\'tab\'], [role=\'link\'], [role=\'button\']'

/**
 * The element a routed click should land on. A registered item is usually
 * the interactive row itself; when it is only a box around one, the first
 * control inside is what a real click on the row would have reached.
 */
function resolveActivator(element: HTMLElement): HTMLElement {
  if (element.matches(ACTIVATOR_SELECTOR) || element.hasAttribute('tabindex'))
    return element
  return element.querySelector<HTMLElement>(ACTIVATOR_SELECTOR) ?? element
}

/**
 * How many frames the coalesced remeasure retries while the registered items
 * still have no layout box. A popup can be in the DOM one frame before it is
 * laid out; retrying beats publishing zeroed rects, and the cap keeps a list
 * that stays hidden for good from spinning frames forever.
 */
const MEASUREMENT_ATTEMPTS = 3

function sameRects(a: readonly (ItemRect | undefined)[], b: readonly (ItemRect | undefined)[]): boolean {
  return a.length === b.length && a.every((p, i) => {
    const r = b[i]
    return p === r || (p !== undefined && r !== undefined
      && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height)
  })
}

/**
 * A highlight that follows the pointer between a list's rows, measured from
 * the rows' own layout boxes (Fluid Functionalism's hover).
 */
export function useFluidHover(
  container: Readonly<ShallowRef<HTMLElement | null>>,
  { axis = 'y', gapClick = true }: UseFluidHoverOptions = {},
): FluidHover {
  const items = new Map<number, HTMLElement>()
  const activeIndex = shallowRef<number | null>(null)
  const itemRects = shallowRef<(ItemRect | undefined)[]>([])
  const isMeasured = shallowRef(false)
  const session = shallowRef(0)
  // Set when the pointer enters; the pointer's first change of highlight
  // starts the new session, in the same update as the change itself.
  let sessionPending = false
  let pickFrame: number | null = null
  let measureFrame: number | null = null

  // The state, in the DOM: on the highlighted item and the container.
  // The container's data-fluid-hover-active-index is the highlighted index, or absent.
  watch([activeIndex, container], ([index, el], _, onCleanup) => {
    if (el && index === null)
      delete el.dataset.fluidHoverActiveIndex
    else if (el)
      el.dataset.fluidHoverActiveIndex = String(index)
    const active = index === null ? undefined : items.get(index)
    active?.setAttribute(ACTIVE_ATTR, '')
    onCleanup(() => {
      active?.removeAttribute(ACTIVE_ATTR)
      if (index !== null)
        items.get(index)?.removeAttribute(ACTIVE_ATTR)
    })
  }, { flush: 'post' })

  /**
   * Publishes a rect for every registered item. Returns false when the
   * measurement could not be completed (no container, or an item without a
   * layout box); nothing is published in that case, so the last complete
   * measurement stands instead of being overwritten with zeroes.
   */
  function runMeasurement(): boolean {
    const el = container.value
    if (!el)
      return false
    const rects: (ItemRect | undefined)[] = []
    for (const [index, element] of items) {
      // An element inside a display:none / not-yet-laid-out popup has no
      // offsetParent and reports every offset as 0.
      const hasLayoutBox = element.offsetParent !== null || element.offsetWidth > 0 || element.offsetHeight > 0
      if (!hasLayoutBox)
        return false
      // offset* rather than getBoundingClientRect, so a CSS transform on an
      // ancestor (a popup scaling in) doesn't skew the rects. Items nested in
      // positioned descendants of the container accumulate their offsets.
      let top = element.offsetTop
      let left = element.offsetLeft
      let ancestor = element.offsetParent as HTMLElement | null
      while (ancestor && ancestor !== el && el.contains(ancestor)) {
        top += ancestor.offsetTop + ancestor.clientTop
        left += ancestor.offsetLeft + ancestor.clientLeft
        ancestor = ancestor.offsetParent as HTMLElement | null
      }
      rects[index] = { top, height: element.offsetHeight, left, width: element.offsetWidth }
    }
    if (!sameRects(itemRects.value, rects))
      itemRects.value = rects
    return true
  }

  /**
   * The single measurement pass: coalesces every trigger (item registration,
   * resize) into one remeasure on the next frame and is the only place
   * readiness is reported.
   */
  function scheduleMeasurement(attemptsLeft = MEASUREMENT_ATTEMPTS) {
    if (measureFrame !== null)
      cancelAnimationFrame(measureFrame)
    measureFrame = requestAnimationFrame(() => {
      measureFrame = null
      if (runMeasurement())
        isMeasured.value = true
      else if (attemptsLeft > 1)
        scheduleMeasurement(attemptsLeft - 1)
    })
  }

  function remeasure() {
    // Readiness drops first: until the pass settles, an overlay positioned
    // from the published rects would be corrected after mounting.
    isMeasured.value = false
    scheduleMeasurement()
  }

  // Rows that change size in place must invalidate the published rects.
  const itemObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scheduleMeasurement())

  function register(index: number, element: HTMLElement) {
    const previous = items.get(index)
    if (previous)
      unregister(index, previous)
    items.set(index, element)
    itemObserver?.observe(element)
    if (index === activeIndex.value)
      element.setAttribute(ACTIVE_ATTR, '')
    remeasure()
  }

  /** Drops `element` from `index`, unless another row has taken the index since. */
  function unregister(index: number, element: HTMLElement) {
    if (items.get(index) !== element)
      return
    itemObserver?.unobserve(element)
    // The mark leaves with the element: a row that only moved to another
    // index must not carry it there.
    element.removeAttribute(ACTIVE_ATTR)
    items.delete(index)
    // The highlighted row is gone: nothing stays lit until the pointer
    // picks again. Decided after this tick's registrations, so a row that
    // only moved index hands the highlight to the row now under it.
    if (index === activeIndex.value) {
      queueMicrotask(() => {
        if (activeIndex.value === index && !items.has(index))
          activeIndex.value = null
      })
    }
    remeasure()
  }

  // Registered from the row's own element and lifecycle, so a row moving in
  // and the one moving out of an index can report in either order.
  const itemDirective: ObjectDirective<HTMLElement, number> = {
    mounted: (el, { value }) => register(value, el),
    updated: (el, { value, oldValue }) => {
      if (value === oldValue)
        return
      if (oldValue !== undefined && oldValue !== null)
        unregister(oldValue, el)
      register(value, el)
    },
    beforeUnmount: (el, { value }) => unregister(value, el),
  }

  function mousemove(e: MouseEvent) {
    const { clientX: x, clientY: y } = e
    if (pickFrame !== null)
      cancelAnimationFrame(pickFrame)
    pickFrame = requestAnimationFrame(() => {
      pickFrame = null
      const el = container.value
      if (!el)
        return
      const next = pickNearest({
        axis,
        point: { x, y },
        rects: itemRects.value,
        containerRect: el.getBoundingClientRect(),
        scroll: { x: el.scrollLeft, y: el.scrollTop },
        border: { x: el.clientLeft, y: el.clientTop },
        layoutSize: { width: el.offsetWidth, height: el.offsetHeight },
      })
      if (sessionPending && next !== activeIndex.value) {
        sessionPending = false
        session.value++
      }
      activeIndex.value = next
    })
  }

  function mouseleave() {
    if (pickFrame !== null) {
      cancelAnimationFrame(pickFrame)
      pickFrame = null
    }
    activeIndex.value = null
  }

  function click(e: MouseEvent) {
    const target = e.target as Node | null
    if (!target || !gapClick)
      return
    // Inside an item: the item owns the click.
    for (const element of items.values()) {
      if (element.contains(target))
        return
    }
    // A row that unmounted while its own click was still bubbling already landed.
    if (!target.isConnected)
      return
    // A control that sits between the rows keeps its own click too.
    const control = (target as Element).closest?.(
      'input, textarea, select, button, a, summary, [contenteditable], [role=\'textbox\'], [role=\'searchbox\'], [role=\'button\']',
    )
    if (control)
      return
    const index = activeIndex.value
    const element = index === null ? undefined : items.get(index)
    // A real DOM click on the item, so its own handlers run exactly as if
    // the pointer had been inside.
    if (element)
      resolveActivator(element).click()
  }

  // A reflow moves items even though the registered set is unchanged.
  // Readiness is deliberately not dropped: the published rects stay usable,
  // and hiding overlays on every reflow would flicker them.
  watch(container, (el, _, onCleanup) => {
    if (!el || typeof ResizeObserver === 'undefined')
      return
    const observer = new ResizeObserver(() => scheduleMeasurement())
    observer.observe(el)
    onCleanup(() => observer.disconnect())
  }, { immediate: true })

  onScopeDispose(() => {
    if (pickFrame !== null)
      cancelAnimationFrame(pickFrame)
    if (measureFrame !== null)
      cancelAnimationFrame(measureFrame)
    itemObserver?.disconnect()
  })

  return {
    activeIndex,
    itemRects,
    isMeasured,
    session,
    handlers: {
      mousemove,
      mouseenter: () => {
        sessionPending = true
      },
      mouseleave,
      click,
    },
    itemDirective,
    measureItems: () => void runMeasurement(),
  }
}
