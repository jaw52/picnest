<script setup lang="ts">
import TabStrip from '~/modules/tabs/TabStrip.vue'
</script>

<!--
  The tab bar across the window's top: the tabs, then the room the active
  tab puts its folder's controls in (see FolderControls). It occupies the
  window's top-left corner, so the tabs keep clear of the native traffic
  lights; its fixed height keeps the row from growing when the (taller)
  thumbnail slider shows, and its top padding centers the controls on the
  tabs' midline, y=24 (28px tabs, 3px off the bottom), as are the traffic
  lights (TrafficLightPosition in main.go). No bottom border: the active tab
  runs into the page.
-->
<template>
  <div data-drag-region class="pl-[84px] pr-3 pt-[7px] bg-titlebar flex gap-1 h-[41px] items-center">
    <TabStrip />
    <!-- Empty space between the tabs and the actions - still a drag handle. -->
    <div class="grow min-w-6" />
    <div id="folder-controls" class="flex shrink-0" />
  </div>
</template>
