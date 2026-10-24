<script setup lang="ts">
import type { Placeholder } from '~/types/lightbox'
import PlaceholderImage from './PlaceholderImage.vue'
import { useLoaded } from './useLoaded'
import './lightbox.css'

const { src } = defineProps<{ src: string, placeholder?: Placeholder, alt: string }>()

const { loaded, onLoad, onError } = useLoaded(() => src)
</script>

<!-- A photo laid out as the lightbox fits it, without the zoom: a neighbour waiting beside the photo shown, for a swipe to bring in. -->
<template>
  <div class="lb-viewport">
    <div class="lb-stage">
      <PlaceholderImage v-if="placeholder" :placeholder="placeholder" />
      <!-- WebKit decodes a large photo off the main thread the first time it
           paints, leaving it blank meanwhile: a neighbour offscreen until a
           swipe slides it in would come in empty. -->
      <img
        :src="src"
        :alt="alt"
        decoding="sync"
        draggable="false"
        class="lb-image"
        :class="{ 'lb-over': placeholder, 'lb-unloaded': placeholder && !loaded }"
        @load="onLoad"
        @error="onError"
      >
    </div>
  </div>
</template>
