<script setup lang="ts">
import { computed } from 'vue'
import { formatEpisodes } from '@/lib/media'
import type { MediaSummary } from '@/types/anilist'

/**
 * Card horizontal de un anime. Se usa en dos contextos con proporciones
 * distintas, de ahi la prop `variant`:
 *
 *   'search' -> fila compacta del desplegable del buscador
 *   'list'   -> card dentro de una lista guardada, con mas aire y poster alto
 *
 * Acepta MediaSummary, que es la forma comun entre un resultado de AniList y
 * el snapshot que guardamos en Firestore.
 */
const props = withDefaults(
  defineProps<{
    media: MediaSummary
    variant?: 'search' | 'list'
  }>(),
  { variant: 'search' },
)

const episodes = computed(() => formatEpisodes(props.media))

const isSearch = computed(() => props.variant === 'search')

/** El hueco de la imagen: 20% del ancho en ambas variantes, distinta altura. */
const posterClass = computed(() =>
  isSearch.value ? 'h-14 w-1/5 max-w-20' : 'aspect-2/3 w-1/5 max-w-28',
)

/** Tinte del placeholder con el color dominante que da AniList. */
const posterStyle = computed(() => {
  const color = props.media.coverColor
  return color
    ? { background: `linear-gradient(150deg, ${color}59, var(--surface-2) 70%)` }
    : undefined
})
</script>

<template>
  <div class="flex items-center" :class="isSearch ? 'gap-3' : 'gap-4'">
    <!-- Placeholder de portada. La URL ya viene en media.coverImage: cuando
         queramos imagenes reales, aqui va un <img> con ese src. -->
    <div
      class="shrink-0 overflow-hidden rounded-lg border border-overlay bg-surface-2"
      :class="posterClass"
      :style="posterStyle"
      aria-hidden="true"
    />

    <div class="min-w-0 flex-1">
      <p
        class="font-medium text-body"
        :class="isSearch ? 'truncate text-sm' : 'line-clamp-2 text-base leading-snug'"
      >
        {{ media.titlePreferred }}
      </p>
      <p class="mt-0.5 text-xs text-muted">{{ episodes }}</p>

      <!-- Segundo titulo: solo en la variante de lista, donde hay sitio. -->
      <p
        v-if="!isSearch && media.titleEnglish && media.titleEnglish !== media.titlePreferred"
        class="mt-1 truncate text-xs text-faint"
      >
        {{ media.titleEnglish }}
      </p>
    </div>

    <!-- Hueco para acciones (añadir, cambiar estado, quitar…). -->
    <slot name="trailing" />
  </div>
</template>
