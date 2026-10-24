<script setup lang="ts">
import type { Tab } from '~/types/tabs'
import { provideTabActive } from '~/context/tab'
import { provideGallery } from '~/state/gallery'
import TabContent from './TabContent.vue'

const { tab, active } = defineProps<{
  tab: Tab
  active: boolean
}>()

provideGallery()
provideTabActive(() => active)
</script>

<!--
  A tab: the folder it shows, with a gallery of its own - photos, filter,
  selection, scroll position - that stays as it is while another tab is
  shown, so switching back is instant. A tab not shown keeps its folder up
  to date, but runs nothing else: no shortcuts, no thumbnail prefetching.
-->
<template>
  <TabContent :tab="tab" :active="active" />
</template>
