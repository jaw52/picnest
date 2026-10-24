<script setup lang="ts">
import AppTooltip from '~/components/AppTooltip.vue'

// Position and listeners go to the button, past the tooltip around it.
defineOptions({ inheritAttrs: false })

defineProps<{
  label: string
  /** A UnoCSS icon class. */
  icon: string
}>()
</script>

<!-- A round control on the lightbox, which stays dark whatever the theme. -->
<template>
  <AppTooltip :content="label">
    <button v-bind="$attrs" type="button" class="lightbox-button" :aria-label="label">
      <span class="size-4.5" :class="icon" />
    </button>
  </AppTooltip>
</template>

<style scoped>
.lightbox-button {
  position: absolute;
  display: flex;
  width: 36px;
  height: 36px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: rgb(255 255 255 / 0.1);
  color: rgb(255 255 255 / 0.8);
  transition:
    color 80ms,
    background-color 80ms;
}

.lightbox-button:hover {
  background-color: rgb(255 255 255 / 0.2);
  color: white;
}

.lightbox-button:active {
  background-color: rgb(255 255 255 / 0.25);
}
</style>
