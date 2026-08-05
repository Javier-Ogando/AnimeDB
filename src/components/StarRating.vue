<script setup lang="ts">
import { computed } from 'vue'

/**
 * Valoracion de 0 a 5. Se pinta una capa de estrellas vacias y encima otra
 * rellena recortada al porcentaje exacto, de modo que un 4,55 se ve como tal
 * sin tener que dibujar medias estrellas.
 */
const props = withDefaults(defineProps<{ value: number; size?: 'sm' | 'md' }>(), { size: 'sm' })

const STARS = 5
const PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z'

const width = computed(() => `${(Math.min(Math.max(props.value, 0), STARS) / STARS) * 100}%`)
const starClass = computed(() => (props.size === 'md' ? 'size-4' : 'size-3.5'))
</script>

<template>
  <div
    class="relative w-max shrink-0"
    role="img"
    :aria-label="`Valoración ${value.toFixed(1)} de ${STARS}`"
  >
    <div class="flex gap-0.5 text-line-strong">
      <svg
        v-for="i in STARS"
        :key="`empty-${i}`"
        :class="starClass"
        class="shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path :d="PATH" />
      </svg>
    </div>

    <div class="absolute inset-y-0 left-0 overflow-hidden" :style="{ width }" aria-hidden="true">
      <div class="flex gap-0.5 text-accent">
        <svg
          v-for="i in STARS"
          :key="`full-${i}`"
          :class="starClass"
          class="shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path :d="PATH" />
        </svg>
      </div>
    </div>
  </div>
</template>
