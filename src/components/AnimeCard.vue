<script setup lang="ts">
import { computed } from 'vue'
import { formatEpisodes } from '@/lib/media'
import type { MediaSummary } from '@/types/anilist'

/**
 * Card completa de un anime: portada, generos, los tres formatos de titulo,
 * valoracion en estrellas y capitulos. Pensada para reutilizarse dentro de una
 * lista, en el panel del login y donde haga falta.
 *
 * Para la fila compacta del desplegable del buscador, ver MediaCard.vue.
 */
const props = withDefaults(
  defineProps<{
    media: MediaSummary
    /** Portada alternativa (p. ej. una empaquetada); por defecto la de media. */
    cover?: string | null
    genres?: string[]
    /** Valoracion de 0 a 5. null oculta las estrellas. */
    rating?: number | null
    /**
     * Capitulos vistos. Si se pasa, la linea de capitulos se muestra como
     * "13/28"; si no, solo el total que ya sabe formatear formatEpisodes.
     */
    watched?: number | null
  }>(),
  { cover: null, genres: () => [], rating: null, watched: null },
)

const coverSrc = computed(() => props.cover ?? props.media.coverImage)

/** Tinte con el color dominante de AniList mientras carga la portada. */
const coverStyle = computed(() => {
  const color = props.media.coverColor
  return color
    ? { background: `linear-gradient(150deg, ${color}59, var(--surface-2) 70%)` }
    : undefined
})

/** Los tres formatos, sin repetir los que coinciden entre si. */
const titles = computed(() => {
  const rows: Array<{ label: string; value: string }> = []
  const push = (label: string, value: string | null) => {
    if (!value) return
    rows.push({ label, value })
  }

  push('Romaji', props.media.titleRomaji)
  push('English', props.media.titleEnglish)
  push('Preferred', props.media.titlePreferred)

  return rows
})

const episodesLabel = computed(() => {
  if (props.watched != null && props.media.episodes) {
    return `${props.watched}/${props.media.episodes}`
  }
  return formatEpisodes(props.media)
})

const STARS = 5

/** Ancho de la capa rellena: permite medias estrellas sin trocear iconos. */
const ratingWidth = computed(() => {
  const value = Math.min(Math.max(props.rating ?? 0, 0), STARS)
  return `${(value / STARS) * 100}%`
})
</script>

<template>
  <article
    class="rounded-3xl border border-overlay bg-surface/85 p-4 shadow-2xl shadow-shade backdrop-blur-sm"
  >
    <div class="flex gap-4">
      <!-- Portada y generos -->
      <div class="w-[38%] shrink-0">
        <div
          class="overflow-hidden rounded-2xl border border-overlay bg-surface-2"
          :style="coverStyle"
        >
          <img
            v-if="coverSrc"
            :src="coverSrc"
            alt=""
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            class="aspect-2/3 w-full object-cover"
          />
          <div v-else class="aspect-2/3 w-full" />
        </div>

        <div v-if="genres.length" class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="genre in genres"
            :key="genre"
            class="rounded-full border border-overlay bg-surface-2/80 px-2 py-0.5 text-[9px] tracking-wide text-muted"
          >
            {{ genre }}
          </span>
        </div>
      </div>

      <!-- Titulos, valoracion y capitulos -->
      <div class="flex min-w-0 flex-1 flex-col">
        <dl class="flex-1 space-y-2 rounded-2xl bg-surface-2/60 p-3">
          <div v-for="t in titles" :key="t.label">
            <dt class="text-[9px] font-medium tracking-[0.16em] text-accent/70 uppercase">
              {{ t.label }}
            </dt>
            <dd class="text-[12px] leading-snug text-muted">{{ t.value }}</dd>
          </div>
        </dl>

        <div class="mt-3 flex items-center gap-2.5">
          <!-- Estrellas: una capa vacia y encima otra rellena recortada al
               porcentaje, para que una valoracion de 4,55 se vea como tal. -->
          <div
            v-if="rating != null"
            class="relative w-max shrink-0"
            role="img"
            :aria-label="`Valoración ${rating.toFixed(1)} de ${STARS}`"
          >
            <div class="flex gap-0.5 text-line-strong">
              <svg
                v-for="i in STARS"
                :key="`empty-${i}`"
                class="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z"
                />
              </svg>
            </div>
            <div
              class="absolute inset-y-0 left-0 overflow-hidden"
              :style="{ width: ratingWidth }"
              aria-hidden="true"
            >
              <div class="flex gap-0.5 text-accent">
                <svg
                  v-for="i in STARS"
                  :key="`full-${i}`"
                  class="size-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <span class="ml-auto shrink-0 text-[11px] font-medium text-muted tabular-nums">
            {{ episodesLabel }}
          </span>
        </div>
      </div>
    </div>

    <!-- Para quien la use dentro de una lista: acciones, miembros, estado… -->
    <slot name="footer" />
  </article>
</template>
