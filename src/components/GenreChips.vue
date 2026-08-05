<script setup lang="ts">
import { computed } from 'vue'
import { translateGenre } from '@/lib/media'

/** Los generos llegan en ingles (canonicos de AniList) y se traducen aqui. */
const props = withDefaults(defineProps<{ genres: string[]; max?: number }>(), { max: 3 })

const labels = computed(() => props.genres.slice(0, props.max).map(translateGenre))
</script>

<template>
  <div v-if="labels.length" class="flex min-w-0 flex-wrap gap-1">
    <span
      v-for="label in labels"
      :key="label"
      class="truncate rounded-full border border-overlay bg-surface-2/80 px-2 py-0.5 text-[9px] tracking-wide text-muted"
    >
      {{ label }}
    </span>
  </div>
</template>
