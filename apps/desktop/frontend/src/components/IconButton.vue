<script setup lang="ts">
import type { ButtonVariant } from './BaseButton.vue'
import AppTooltip from './AppTooltip.vue'
import BaseButton from './BaseButton.vue'

// Listeners and attributes go to the button, past the tooltip around it.
defineOptions({ inheritAttrs: false })

const { variant = 'ghost' } = defineProps<{
  /** Accessible name, also shown as the tooltip. */
  label: string
  /** A UnoCSS icon class, such as `i-mingcute-copy-line`. */
  icon: string
  /** Extra classes on the glyph, such as a spin. */
  iconClass?: string
  variant?: ButtonVariant
  disabled?: boolean
  active?: boolean
}>()
</script>

<!-- An icon-only button, ghost by default, with its label in a tooltip. -->
<template>
  <AppTooltip :content="label">
    <BaseButton v-bind="$attrs" :variant="variant" size="icon-compact" :aria-label="label" :disabled="disabled" :active="active">
      <span :class="[icon, iconClass]" />
    </BaseButton>
  </AppTooltip>
</template>
