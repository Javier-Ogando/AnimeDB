<script setup lang="ts">
// Wordmark provisional: cuando haya logo, se sustituye solo aqui.
withDefaults(defineProps<{ as?: string }>(), { as: 'span' })
</script>

<template>
  <component :is="as" class="font-display tracking-tight select-none">
    Anime<span class="text-magenta-400">DB</span>
  </component>
</template>
