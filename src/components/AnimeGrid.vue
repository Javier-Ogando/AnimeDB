<script setup lang="ts">
import AnimeCard from './AnimeCard.vue'
import type { MediaSummary } from '@/types/anilist'

const props = withDefaults(
  defineProps<{
    media: MediaSummary[]
    /** Texto cuando no hay nada que mostrar. */
    empty?: string
    /** Con esto, cada card muestra un botón de quitar. */
    removable?: boolean
  }>(),
  { empty: 'Todavía no hay nada por aquí.', removable: false },
)

defineEmits<{ remove: [media: MediaSummary] }>()
</script>

<template>
  <!-- Estado vacio con la silueta de una card: comunica que va a haber cards
       aqui, cosa que una frase en un recuadro no hace. -->
  <div
    v-if="!props.media.length"
    class="grid place-items-center rounded-3xl border border-dashed border-line px-6 py-16"
  >
    <div class="flex items-center gap-4 opacity-40" aria-hidden="true">
      <div class="aspect-2/3 h-20 rounded-xl border border-line bg-surface-2/60" />
      <div class="space-y-2">
        <div class="h-2.5 w-32 rounded-full bg-surface-2" />
        <div class="h-2 w-20 rounded-full bg-surface-2/70" />
        <div class="h-2 w-24 rounded-full bg-surface-2/70" />
      </div>
    </div>

    <p class="mt-8 max-w-sm text-center font-display text-lg leading-snug text-balance text-muted">
      {{ props.empty }}
    </p>
  </div>

  <!-- gap-4 y no gap-3: el boton de quitar sobresale 8 px de la esquina, y con
       menos hueco pisaria la card vecina. -->
  <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <div v-for="item in props.media" :key="item.id" class="relative">
      <AnimeCard :media="item" dense />

      <!-- Fuera de la card a proposito: no es contenido del anime sino una
           accion sobre el, asi que se superpone en la esquina en vez de ocupar
           una columna dentro y estrechar el texto. -->
      <button
        v-if="props.removable"
        type="button"
        class="float-pill absolute -top-2 -right-2 z-10 grid size-7 cursor-pointer place-items-center text-faint transition hover:border-accent/60 hover:text-body"
        :aria-label="`Quitar ${item.titleRomaji ?? item.titlePreferred}`"
        @click="$emit('remove', item)"
      >
        <svg
          class="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
