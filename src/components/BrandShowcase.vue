<script setup lang="ts">
import AnimeCard from './AnimeCard.vue'
import TitleFormats from './TitleFormats.vue'
import frierenCover from '@/assets/frieren-cover.jpg'
import type { MediaSummary } from '@/types/anilist'

/**
 * Panel derecho del login. Adelanta la forma real de una card dentro de una
 * lista reutilizando el mismo AnimeCard que usaran las listas.
 *
 * La portada va empaquetada en el repo y no enlazada al CDN de AniList: el
 * login no debe quedarse a medio pintar si la red va lenta.
 */

/** Datos reales de AniList (id 154587). */
const frieren: MediaSummary = {
  id: 154587,
  titlePreferred: 'Sousou no Frieren',
  titleRomaji: 'Sousou no Frieren',
  titleEnglish: 'Frieren: Beyond Journey’s End',
  coverImage: null,
  coverColor: '#bbf1a1',
  format: 'TV',
  seasonYear: 2023,
  episodes: 28,
  seasons: null,
  totalEpisodes: null,
}

/** Canonicos de AniList; AnimeCard los traduce al pintarlos. */
const genres = ['Adventure', 'Drama', 'Fantasy']

/** averageScore 91/100 en AniList -> 4,55 sobre 5. */
const rating = 4.55
</script>

<template>
  <aside class="relative isolate hidden overflow-hidden bg-surface lg:block">
    <!-- Atmosfera: dos halos desenfocados en deriva lenta + grano.
         Sobre blanco el magenta pesa mas que sobre tinta, asi que en claro va
         a la mitad de opacidad. -->
    <div
      class="drift pointer-events-none absolute -top-[15%] -right-1/4 size-[38rem] rounded-full bg-accent/12 blur-[110px] dark:bg-accent/25"
      aria-hidden="true"
    />
    <div
      class="drift pointer-events-none absolute -bottom-[20%] -left-1/4 size-[32rem] rounded-full bg-ice-400/8 blur-[120px] dark:bg-ice-400/10"
      style="animation-delay: -9s"
      aria-hidden="true"
    />
    <!-- El grano se ve sucio sobre papel claro: solo en modo oscuro. -->
    <div
      class="grain pointer-events-none absolute inset-0 opacity-0 dark:opacity-[0.16]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-overlay to-transparent"
      aria-hidden="true"
    />

    <!-- Etiqueta vertical en el canto: detalle editorial. -->
    <span
      class="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-[10px] tracking-[0.42em] text-faint/60 uppercase [writing-mode:vertical-rl]"
      aria-hidden="true"
    >
      Catálogo · AniList
    </span>

    <div class="relative flex h-full flex-col justify-center gap-10 px-14 py-16 xl:px-20">
      <!-- Mazo de cards: dos fantasma detras para dar profundidad. -->
      <div
        class="relative mx-auto grid w-full max-w-[23rem] place-items-center"
        aria-hidden="true"
      >
        <div
          class="rise absolute h-64 w-full translate-x-8 rotate-[7deg] rounded-3xl border border-overlay bg-surface-2/60"
          style="animation-delay: 60ms"
        />
        <div
          class="rise absolute h-64 w-full -translate-x-8 -rotate-[5deg] rounded-3xl border border-overlay bg-surface-2/40"
          style="animation-delay: 30ms"
        />

        <AnimeCard
          class="rise relative w-full -rotate-[2deg]"
          style="animation-delay: 140ms"
          :media="frieren"
          :cover="frierenCover"
          :genres="genres"
          :rating="rating"
        >
          <!-- En el login el cuerpo son los tres formatos de titulo, no la
               sinopsis: es lo que explica que se puede buscar por cualquiera. -->
          <template #body>
            <TitleFormats
              :media="frieren"
              class="flex-1 rounded-2xl bg-surface-2/60 p-3"
            />
          </template>
        </AnimeCard>
      </div>

      <div class="mx-auto max-w-sm text-center">
        <p class="font-display text-2xl leading-snug text-balance text-body">
          Un catálogo. Tres formas de buscar el mismo título.
        </p>
        <p class="mt-4 text-sm leading-relaxed text-muted">
          Tus pendientes, la lista comunitaria y las listas que abres con quien quieras. Los datos
          vienen de AniList; aquí solo se consultan.
        </p>
      </div>
    </div>
  </aside>
</template>
