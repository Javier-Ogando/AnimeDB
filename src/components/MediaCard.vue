<script setup lang="ts">
import { computed } from 'vue'
import { formatEpisodes } from '@/lib/media'
import type { MediaSummary } from '@/types/anilist'

/**
 * Fila compacta de un anime: portada, titulo y capitulos. Se usa en el
 * desplegable del buscador y en cualquier listado denso.
 *
 * Para la card completa (generos, valoracion, los tres titulos) ver AnimeCard.vue.
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

/**
 * La portada mantiene la proporcion 2:3 de los posters en las dos variantes:
 * en la fila del buscador se ancla a la altura (~37x56 px) y en la card de una
 * lista al ancho. Asi la imagen nunca se deforma.
 */
const posterClass = computed(() =>
  isSearch.value ? 'aspect-2/3 h-14' : 'aspect-2/3 w-1/5 max-w-28',
)

/**
 * Tinte con el color dominante que da AniList. Sigue viendose mientras la
 * imagen carga y como respaldo cuando un titulo no tiene portada.
 */
const posterStyle = computed(() => {
  const color = props.media.coverColor
  return color
    ? { background: `linear-gradient(150deg, ${color}59, var(--surface-2) 70%)` }
    : undefined
})
</script>

<template>
  <div class="flex items-center" :class="isSearch ? 'gap-3' : 'gap-4'">
    <div
      class="shrink-0 overflow-hidden rounded-lg border border-overlay bg-surface-2"
      :class="posterClass"
      :style="posterStyle"
    >
      <img
        v-if="media.coverImage"
        :src="media.coverImage"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="size-full object-cover"
      />
    </div>

    <div class="min-w-0 flex-1">
      <p
        class="font-medium text-body"
        :class="isSearch ? 'truncate text-sm' : 'line-clamp-2 text-base leading-snug'"
      >
        {{ media.titlePreferred }}
      </p>
      <p class="mt-0.5 text-xs text-muted">{{ episodes }}</p>
    </div>

    <!-- Hueco para acciones (añadir, cambiar estado, quitar…). -->
    <slot name="trailing" />
  </div>
</template>
