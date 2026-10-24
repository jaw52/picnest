<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="px-3 py-2 border-t border-border">
    <div class="text-caption text-muted-foreground mb-1 wght-semibold">
      {{ title }}
    </div>
    <slot />
  </div>
</template>
