<script setup lang="ts">
import { computed } from 'vue'
import { useSizeVariant } from '~/context/size'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive'
type ButtonSize = 'default' | 'compact' | 'icon' | 'icon-compact'

const {
  variant = 'primary',
  size,
  loading = false,
  leadingIcon,
  trailingIcon,
  active = false,
  disabled = false,
} = defineProps<{
  variant?: ButtonVariant
  /** Omitted, the button follows the surrounding size step (default 36px, compact 28px). */
  size?: ButtonSize
  loading?: boolean
  /** UnoCSS icon classes, before and after the label. */
  leadingIcon?: string
  trailingIcon?: string
  /**
   * Force the visual pressed/held state. Useful when the button drives an
   * external open piece of UI (a popover, menu) so it reads as engaged while
   * it is showing.
   */
  active?: boolean
  disabled?: boolean
}>()

const contextSize = useSizeVariant()
const resolvedSize = computed<ButtonSize>(() => size ?? (contextSize === 'compact' ? 'compact' : 'default'))
const iconOnly = computed(() => resolvedSize.value === 'icon' || resolvedSize.value === 'icon-compact')
const compact = computed(() => resolvedSize.value === 'compact' || resolvedSize.value === 'icon-compact')
const iconSize = computed(() => (compact.value ? 'size-3.5' : 'size-4'))
const leading = computed(() => (iconOnly.value ? undefined : leadingIcon))
const trailing = computed(() => (iconOnly.value ? undefined : trailingIcon))
</script>

<template>
  <button
    type="button"
    class="button"
    :class="[
      variant,
      `step-${resolvedSize}`,
      { 'pad-leading': leading, 'pad-trailing': trailing },
    ]"
    :disabled="disabled || loading"
    :data-icon-only="iconOnly ? (compact ? 'compact' : 'default') : undefined"
  >
    <span aria-hidden="true" class="surface" :class="{ forced: active }" />
    <span class="content">
      <template v-if="loading">
        <span class="hidden-while-loading">
          <span v-if="leading" :class="[leading, iconSize]" />
          <slot />
          <span v-if="trailing" :class="[trailing, iconSize]" />
        </span>
        <span class="spinner-wrap">
          <svg :class="compact ? 'size-7' : 'size-9'" viewBox="0 0 24 24" fill="none">
            <path
              class="spinner-path"
              d="M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
              stroke="currentColor"
              stroke-width="1.125"
              stroke-linecap="round"
              pathLength="100"
            />
          </svg>
        </span>
      </template>
      <slot v-else-if="iconOnly" />
      <template v-else>
        <span v-if="leading" :class="[leading, iconSize]" />
        <span class="trim-cap"><slot /></span>
        <span v-if="trailing" :class="[trailing, iconSize]" />
      </template>
    </span>
  </button>
</template>

<style scoped>
.button {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  outline: none;
  cursor: pointer;
  user-select: none;
  transition: color 80ms;
}

.button:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.button:focus-visible {
  box-shadow: 0 0 0 1px var(--ps-focus-ring);
}

/* Text color per variant. */
.primary,
.destructive {
  color: var(--ps-background);
}

.secondary,
.tertiary {
  color: var(--ps-foreground);
}

.ghost {
  color: var(--ps-muted-foreground);
}

.ghost:hover {
  color: var(--ps-foreground);
}

/* The two-step size ladder shared by every control. */
.step-default {
  height: 36px;
  padding-inline: 16px;
  gap: 6px;
  font-size: var(--ps-fs-body);
  line-height: var(--ps-lh-body);
}

.step-compact {
  height: 28px;
  padding-inline: 12px;
  gap: 4px;
  font-size: var(--ps-fs-body-compact);
  line-height: var(--ps-lh-body-compact);
}

.step-icon {
  width: 36px;
  height: 36px;
  padding: 0;
}

.step-icon-compact {
  width: 28px;
  height: 28px;
  padding: 0;
}

/* An icon sits 4px closer to its edge than text does. */
.step-default.pad-leading {
  padding-left: 12px;
}

.step-compact.pad-leading {
  padding-left: 8px;
}

.step-default.pad-trailing {
  padding-right: 12px;
}

.step-compact.pad-trailing {
  padding-right: 8px;
}

/* Press effect: the surface sits 1px inside the button and a same-color
   shadow spread fills it back out. Pressing collapses the spread, shrinking
   the surface by exactly 1px per side at any width, which a scale could not.
   Secondary's fills are see-through, so it takes on the surface under it. */
.surface {
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  transition-property: box-shadow, background-color;
  transition-duration: 180ms, 80ms;
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1), ease;
}

.button:active .surface {
  transition-duration: 80ms, 80ms;
}

.primary .surface {
  --fill: var(--ps-foreground);
  --fill-hover: color-mix(in oklab, var(--ps-foreground) 90%, var(--ps-background));
  --fill-active: color-mix(in oklab, var(--ps-foreground) 80%, var(--ps-background));
}

/* Primary's recipe in the destructive color, for actions that remove files. */
.destructive .surface {
  --fill: var(--ps-destructive);
  --fill-hover: color-mix(in oklab, var(--ps-destructive) 90%, var(--ps-background));
  --fill-active: color-mix(in oklab, var(--ps-destructive) 80%, var(--ps-background));
}

.secondary .surface {
  --fill: var(--ps-tint);
  --fill-hover: var(--ps-tint-hover);
  --fill-active: var(--ps-tint);
}

.primary .surface,
.destructive .surface,
.secondary .surface {
  background-color: var(--fill);
  box-shadow: 0 0 0 1px var(--fill);
}

.primary:hover .surface,
.destructive:hover .surface,
.secondary:hover .surface {
  background-color: var(--fill-hover);
  box-shadow: 0 0 0 1px var(--fill-hover);
}

.primary:active .surface,
.destructive:active .surface,
.secondary:active .surface {
  background-color: var(--fill-active);
  box-shadow: 0 0 0 0 var(--fill-active);
}

/* The border ring is an outer 1px shadow at rest that hands off to an inset
   1px shadow when pressed, so the ring moves inward with the surface. The
   translucent fill only ever reaches the ring's inner edge, so it needs no
   spread of its own. */
.tertiary .surface {
  background-color: transparent;
  box-shadow:
    0 0 0 1px var(--ps-border),
    inset 0 0 0 0 var(--ps-border);
}

.tertiary:hover .surface {
  background-color: var(--ps-hover);
}

.tertiary:active .surface {
  background-color: var(--ps-active);
  box-shadow:
    0 0 0 0 var(--ps-border),
    inset 0 0 0 1px var(--ps-border);
}

/* Translucent fill + same-color spread never double up: outer shadows render
   only outside the surface box. */
.ghost .surface {
  background-color: transparent;
  box-shadow: 0 0 0 1px transparent;
}

.ghost:hover .surface {
  background-color: var(--ps-hover);
  box-shadow: 0 0 0 1px var(--ps-hover);
}

.ghost:active .surface {
  background-color: var(--ps-active);
  box-shadow: 0 0 0 0 var(--ps-active);
}

/* Forced-active (`active` prop): pressed colors at full size; the geometric
   press-collapse still reacts on top. */
.primary .surface.forced,
.destructive .surface.forced,
.secondary .surface.forced {
  background-color: var(--fill-active);
  box-shadow: 0 0 0 1px var(--fill-active);
}

.tertiary .surface.forced {
  background-color: var(--ps-active);
  box-shadow:
    0 0 0 1px var(--ps-border),
    inset 0 0 0 0 var(--ps-border);
}

.ghost .surface.forced {
  background-color: var(--ps-active);
  box-shadow: 0 0 0 1px var(--ps-active);
}

.button:active .surface.forced {
  box-shadow: 0 0 0 0 var(--fill-active, var(--ps-active));
}

.tertiary:active .surface.forced {
  box-shadow:
    0 0 0 0 var(--ps-border),
    inset 0 0 0 1px var(--ps-border);
}

.content {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: inherit;
}

.hidden-while-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: inherit;
  opacity: 0;
}

.spinner-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-path {
  stroke-dasharray: 15 85;
  animation:
    spinner-move 2s linear infinite,
    spinner-dash 4s ease-in-out infinite;
}

@keyframes spinner-move {
  to {
    stroke-dashoffset: -100;
  }
}

@keyframes spinner-dash {
  0%,
  100% {
    stroke-dasharray: 15 85;
  }

  50% {
    stroke-dasharray: 40 60;
  }
}

[data-icon-only='default'] :slotted([class*='i-']) {
  width: 16px;
  height: 16px;
}

[data-icon-only='compact'] :slotted([class*='i-']) {
  width: 14px;
  height: 14px;
}
</style>
