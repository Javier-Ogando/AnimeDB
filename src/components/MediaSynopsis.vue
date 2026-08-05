<script setup lang="ts">
/**
 * Sinopsis recortada. La guardamos al dar de alta el anime, asi que los items
 * anteriores a esa funcion no la tienen y este bloque simplemente no aparece.
 */
withDefaults(defineProps<{ text?: string | null; lines?: 3 | 4 | 6 }>(), { lines: 4 })
</script>

<template>
  <p
    v-if="text"
    class="text-xs leading-relaxed text-muted"
    :class="lines === 3 ? 'line-clamp-3' : lines === 6 ? 'line-clamp-6' : 'line-clamp-4'"
  >
    {{ text }}
  </p>
</template>
