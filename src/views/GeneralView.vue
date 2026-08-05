<script setup lang="ts">
import { ref } from 'vue'
import { fetchRegisteredMedia } from '@/lib/lists'
import AnimeGrid from '@/components/AnimeGrid.vue'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { MediaSummary } from '@/types/anilist'

/**
 * Catalogo general: todo lo que alguien ha registrado en la aplicacion.
 *
 * Sale de la coleccion `media`, que se rellena en cada alta a cualquier lista,
 * asi que ya es el registro global sin necesidad de duplicar nada.
 */
const media = ref<MediaSummary[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

async function load() {
  try {
    media.value = await fetchRegisteredMedia()
  } catch (e) {
    error.value = (e as Error).message.includes('permission')
      ? 'Firestore ha denegado el acceso. Despliega las reglas: npx firebase deploy --only firestore:rules'
      : 'No se ha podido cargar el catálogo.'
  } finally {
    isLoading.value = false
  }
}

void load()
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        kicker="Catálogo común"
        title="General"
        :count="media.length"
        :unit="['título', 'títulos']"
        hint="Todo lo que alguien ha registrado en AnimeDB, sin importar en qué lista lo guardara."
      />

      <p
        v-if="error"
        role="alert"
        class="mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted"
      >
        {{ error }}
      </p>

      <div class="mt-8">
        <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
        <AnimeGrid
          v-else
          :media="media"
          empty="Nadie ha añadido nada todavía. Empieza por tus pendientes."
        />
      </div>
    </main>
  </div>
</template>
