<script setup lang="ts">
import { computed } from 'vue'
import { formatEpisodes, scoreToStars } from '@/lib/media'
import GenreChips from './GenreChips.vue'
import MediaCover from './MediaCover.vue'
import MediaSynopsis from './MediaSynopsis.vue'
import StarRating from './StarRating.vue'
import type { MediaSummary } from '@/types/anilist'

/**
 * Card completa de un anime. Aporta la ESTRUCTURA —portada y generos a la
 * izquierda; titulo, cuerpo y metadatos a la derecha— y deja el contenido en
 * manos de quien la usa, mediante cuatro huecos:
 *
 *   #cover   la portada            (por defecto MediaCover)
 *   #aside   debajo de la portada  (por defecto GenreChips)
 *   #body    el bloque central     (por defecto titulo + sinopsis)
 *   #meta    la fila inferior      (por defecto valoracion + capitulos)
 *
 * Las acciones sobre el anime (quitar, cambiar estado) NO van dentro: se
 * superponen desde fuera, para no robar ancho al contenido.
 *
 * Todos traen su version por defecto, asi que <AnimeCard :media="x" /> ya
 * funciona; solo se sustituye lo que cambia. El login, por ejemplo, reemplaza
 * #body por TitleFormats.
 *
 * Para la fila compacta del desplegable del buscador, ver AnimeRow.vue.
 */
const props = withDefaults(
  defineProps<{
    media: MediaSummary
    /** Portada alternativa (p. ej. una empaquetada en el repositorio). */
    cover?: string | null
    /** Generos en ingles. Si no se pasan, se usan los de `media`. */
    genres?: string[]
    /** Valoracion 0-5. Si no se pasa, se deriva del averageScore de `media`. */
    rating?: number | null
    /** Capitulos vistos: con esto la linea muestra "13/28". */
    watched?: number | null
    /**
     * Version compacta para rejillas de cuatro columnas: menos relleno, portada
     * mas estrecha, tipografia menor y sinopsis a tres lineas. Sin esto la card
     * no baja de ~350 px de ancho utiles.
     */
    dense?: boolean
  }>(),
  { cover: null, genres: () => [], rating: null, watched: null, dense: false },
)

/** Romaji, sin decir que lo es; si falta, el preferido. */
const title = computed(() => props.media.titleRomaji ?? props.media.titlePreferred)

const coverSrc = computed(() => props.cover ?? props.media.coverImage)

const genreList = computed(() => (props.genres.length ? props.genres : (props.media.genres ?? [])))

const ratingValue = computed(() => props.rating ?? scoreToStars(props.media.averageScore))

const episodesLabel = computed(() => {
  if (props.watched != null && props.media.episodes) {
    return `${props.watched}/${props.media.episodes}`
  }
  return formatEpisodes(props.media)
})
</script>

<template>
  <article
    class="border border-overlay bg-surface/85 shadow-shade backdrop-blur-sm"
    :class="dense ? 'rounded-2xl p-3 shadow-lg' : 'rounded-3xl p-4 shadow-2xl'"
  >
    <div class="flex" :class="dense ? 'gap-3' : 'gap-4'">
      <!-- Columna izquierda -->
      <div class="shrink-0" :class="dense ? 'w-[34%]' : 'w-[38%]'">
        <slot name="cover" :src="coverSrc">
          <MediaCover
            :src="coverSrc"
            :color="media.coverColor"
            class="aspect-2/3 w-full"
            :class="dense ? 'rounded-xl' : 'rounded-2xl'"
          />
        </slot>

        <slot name="aside" :genres="genreList">
          <!-- single-line: en una rejilla, una card que envuelve sus categorias
               queda mas alta que sus vecinas. Las que no caben van al "+X". -->
          <GenreChips :genres="genreList" :max="dense ? 2 : 3" single-line class="mt-2" />
        </slot>
      </div>

      <!-- Columna derecha -->
      <div class="flex min-w-0 flex-1 flex-col">
        <slot name="body" :title="title" :media="media">
          <p
            class="line-clamp-2 leading-snug font-medium text-body"
            :class="dense ? 'text-sm' : 'text-base'"
          >
            {{ title }}
          </p>
          <MediaSynopsis
            :text="media.description"
            :lines="dense ? 3 : 4"
            class="mt-1.5"
          />
        </slot>

        <!-- mt-auto: la fila se queda abajo aunque el cuerpo sea corto. -->
        <div class="mt-auto flex items-center gap-2" :class="dense ? 'pt-2' : 'pt-3'">
          <slot name="meta" :rating="ratingValue" :episodes="episodesLabel">
            <StarRating v-if="ratingValue != null" :value="ratingValue" />
            <span class="ml-auto shrink-0 text-[11px] font-medium text-muted tabular-nums">
              {{ episodesLabel }}
            </span>
          </slot>
        </div>
      </div>
    </div>
  </article>
</template>
