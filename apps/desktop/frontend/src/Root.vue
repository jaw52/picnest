<script setup lang="ts">
import { MotionConfig } from 'motion-v'
import { TooltipProvider } from 'reka-ui'
import { provideSize } from '~/context/size'
import CollectPanel from '~/modules/collect/CollectPanel.vue'
import App from './App.vue'

// The menu bar icon's panel loads this page too, under #collect.
const isCollectPanel = window.location.hash === '#collect'
if (isCollectPanel) {
  // The panel's window is see-through, so its rounded corners show.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

// A dense desktop tool: every control sits on the 28px compact step.
provideSize('compact')
</script>

<template>
  <!-- Honours the OS reduced-motion setting in every motion component. -->
  <MotionConfig reduced-motion="user">
    <!-- Once one tooltip opens, the ones next to it skip the delay. -->
    <TooltipProvider :delay-duration="200" :skip-delay-duration="300">
      <CollectPanel v-if="isCollectPanel" />
      <App v-else />
    </TooltipProvider>
  </MotionConfig>
</template>
