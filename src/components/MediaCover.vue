<script setup lang="ts">
import { computed } from 'vue'

/**
 * Portada de un anime. El tamano y el redondeo los decide quien la usa con
 * clases; aqui solo va la imagen y el tinte de respaldo.
 */
const props = defineProps<{ src?: string | null; color?: string | null }>()

/**
 * Tinte con el color dominante que da AniList: se ve mientras carga la imagen y
 * queda como respaldo en los titulos sin portada.
 */
const tint = computed(() =>
  props.color
    ? { background: `linear-gradient(150deg, ${props.color}59, var(--surface-2) 70%)` }
    : undefined,
)
</script>

<template>
  <div class="overflow-hidden border border-overlay bg-surface-2" :style="tint">
    <img
      v-if="src"
      :src="src"
      alt=""
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      class="size-full object-cover"
    />
  </div>
</template>
