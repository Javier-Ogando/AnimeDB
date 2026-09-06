<script setup lang="ts">
import { computed } from 'vue'
import { formatEpisodes, scoreToStars } from '@/lib/media'
import GenreChips from './GenreChips.vue'
import MediaCover from './MediaCover.vue'
import MediaStats from './MediaStats.vue'
import StarRating from './StarRating.vue'
import type { MediaSummary } from '@/types/anilist'

/**
 * Fila compacta de un anime: portada pequena, titulo y una sola linea con
 * valoracion, generos y capitulos.
 *
 * Es una disposicion distinta y no una variante de AnimeCard, pero se construye
 * con las mismas piezas. No lleva marco propio porque el contenedor de la fila
 * (el boton del desplegable) ya pone fondo, borde y estado de seleccion.
 */
const props = defineProps<{ media: MediaSummary }>()

const title = computed(() => props.media.titleRomaji ?? props.media.titlePreferred)
const ratingValue = computed(() => scoreToStars(props.media.averageScore))
const episodesLabel = computed(() => formatEpisodes(props.media))
</script>

<template>
  <div class="flex items-center gap-3">
    <MediaCover
      :src="media.coverImage"
      :color="media.coverColor"
      class="aspect-2/3 h-14 shrink-0 rounded-lg"
    />

    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <p class="min-w-0 truncate text-sm font-medium text-body">{{ title }}</p>

      <div class="flex min-w-0 items-center gap-2">
        <StarRating v-if="ratingValue != null" :value="ratingValue" />

        <!-- Los generos a un extremo y los capitulos al otro. El contenedor se
             renderiza siempre: con un solo hijo, justify-between alinearia a la
             izquierda y los capitulos dejarian de estar a la derecha. -->
        <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
          <GenreChips :genres="media.genres ?? []" :max="3" :show-overflow="false" />
          <span class="shrink-0 text-xs font-medium text-muted tabular-nums">
            {{ episodesLabel }}
          </span>
        </div>
      </div>

      <!-- Coeficientes narrativos, debajo de las etiquetas. -->
      <MediaStats :stats="media.stats ?? null" dense />
    </div>

    <slot name="trailing" />
  </div>
</template>
