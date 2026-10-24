<script setup lang="ts">
defineProps<{ label: string, value: string }>()
</script>

<template>
  <div class="text-caption py-0.5 flex gap-2 items-center justify-between">
    <span class="text-muted-foreground shrink-0">{{ label }}</span>
    <span class="text-foreground text-right truncate">{{ value }}</span>
  </div>
</template>
