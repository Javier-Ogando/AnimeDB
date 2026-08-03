<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AnimeSearchInput from '@/components/AnimeSearchInput.vue'
import BrandMark from '@/components/BrandMark.vue'
import MediaCard from '@/components/MediaCard.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { MediaSummary } from '@/types/anilist'

const { user, signOut, isBusy } = useAuth()
const router = useRouter()

const cards = [
  { title: 'Mis pendientes', hint: 'Tu lista personal' },
  { title: 'Lista comunitaria', hint: 'Pública, te apuntas si quieres' },
  { title: 'Listas compartidas', hint: 'Por link de invitación' },
]

/** Provisional: el siguiente paso es escribirlo en lists/{id}/items/{animeId}. */
const selected = ref<MediaSummary | null>(null)

function onSelect(media: MediaSummary) {
  selected.value = media
}

async function onSignOut() {
  await signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-line">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <BrandMark class="text-lg" />

        <div class="flex items-center gap-3">
          <ThemeToggle />
          <img
            v-if="user?.photoURL"
            :src="user.photoURL"
            :alt="user.displayName ?? 'Avatar'"
            class="size-8 rounded-full ring-1 ring-line"
            referrerpolicy="no-referrer"
          />
          <span class="hidden text-sm text-muted sm:inline">
            {{ user?.displayName ?? user?.email }}
          </span>
          <button
            type="button"
            :disabled="isBusy"
            class="cursor-pointer rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-muted transition hover:border-accent/60 hover:text-body disabled:cursor-not-allowed disabled:opacity-60"
            @click="onSignOut"
          >
            Salir
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-12">
      <h1 class="font-display text-3xl tracking-tight">
        Hola, {{ user?.displayName?.split(' ')[0] ?? 'usuario' }}
      </h1>

      <div class="mt-8 flex justify-center">
        <AnimeSearchInput @select="onSelect" />
      </div>

      <!-- Provisional, hasta que exista el alta en lista: demuestra la
           variante 'list' del mismo MediaCard. -->
      <div
        v-if="selected"
        class="relative z-0 mx-auto mt-6 max-w-xl rounded-2xl border border-line bg-surface/60 p-4"
      >
        <p class="mb-3 text-[11px] tracking-[0.18em] text-accent/70 uppercase">Selección</p>
        <MediaCard :media="selected" variant="list" />
      </div>

      <!-- z-0 explicito: el desplegable del buscador debe quedar por encima. -->
      <div class="relative z-0 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="card in cards"
          :key="card.title"
          class="cursor-pointer rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-accent/40"
        >
          <h2 class="text-sm font-medium">{{ card.title }}</h2>
          <p class="mt-1 text-xs text-muted">{{ card.hint }}</p>
          <p class="mt-6 text-xs text-faint">Pendiente de implementar</p>
        </article>
      </div>
    </main>
  </div>
</template>
