import type { InjectionKey } from 'vue'
import { inject, provide } from 'vue'

const BACKGROUNDS = ['bg-surface-1', 'bg-surface-2', 'bg-surface-3', 'bg-surface-4', 'bg-surface-5', 'bg-surface-6', 'bg-surface-7', 'bg-surface-8']
const ELEVATIONS = ['elevation-1', 'elevation-2', 'elevation-3', 'elevation-4', 'elevation-5', 'elevation-6', 'elevation-7', 'elevation-8']

/** Clamped to the 8-step ladder, so a deep stack keeps resolving to a real surface. */
function clampLevel(level: number): number {
  return Math.round(Math.max(1, Math.min(8, level)))
}

/** Background and shadow classes for a surface level; the shadow defaults to the same rung. */
export function surfaceClasses(bgLevel: number, shadowLevel: number = bgLevel): string {
  return `${BACKGROUNDS[clampLevel(bgLevel) - 1]} ${ELEVATIONS[clampLevel(shadowLevel) - 1]}`
}

/**
 * The surface level the children sit on, on an 8-step ladder (1 is the page).
 * Raised components (menus, popovers) read it and pick their own level relative
 * to it, so a menu never melts into the panel it opens over.
 */
const surfaceKey: InjectionKey<number> = Symbol('surface')

export function provideSurface(level: number): void {
  provide(surfaceKey, clampLevel(level))
}

export function useSurface(): number {
  return inject(surfaceKey, 1)
}
