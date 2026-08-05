<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import {
  addAnimeToList,
  ensurePersonalList,
  itemToMedia,
  removeAnimeFromList,
  watchListItems,
  type ListItem,
} from '@/lib/lists'
import AnimeGrid from '@/components/AnimeGrid.vue'
import AnimeSearchInput from '@/components/AnimeSearchInput.vue'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { MediaSummary } from '@/types/anilist'

const { user } = useAuth()

const items = ref<ListItem[]>([])
const listId = ref<string | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

let unsubscribe: (() => void) | null = null

async function start() {
  const uid = user.value?.uid
  if (!uid) return

  try {
    listId.value = await ensurePersonalList(uid)
    unsubscribe = watchListItems(
      listId.value,
      (next) => {
        items.value = next
        isLoading.value = false
      },
      (e) => {
        error.value = describe(e)
        isLoading.value = false
      },
    )
  } catch (e) {
    error.value = describe(e as Error)
    isLoading.value = false
  }
}

/** El fallo esperado hoy es permission-denied: las reglas no estan desplegadas. */
function describe(e: Error): string {
  return e.message.includes('permission')
    ? 'Firestore ha denegado el acceso. Despliega las reglas: npx firebase deploy --only firestore:rules'
    : 'No se ha podido cargar la lista.'
}

void start()
onUnmounted(() => unsubscribe?.())

async function onAdd(media: MediaSummary) {
  if (!listId.value || !user.value) return
  try {
    await addAnimeToList(listId.value, media, user.value.uid)
  } catch (e) {
    error.value = describe(e as Error)
  }
}

async function onRemove(media: MediaSummary) {
  if (!listId.value) return
  try {
    await removeAnimeFromList(listId.value, media.id)
  } catch (e) {
    error.value = describe(e as Error)
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        kicker="Tu lista"
        title="Mis pendientes"
        :count="items.length"
        :unit="['título', 'títulos']"
        hint="Solo la ves tú. Busca cualquier anime y guárdalo aquí para no perderle la pista."
      />

      <div class="mt-6 flex">
        <AnimeSearchInput @select="onAdd" />
      </div>

      <p
        v-if="error"
        role="alert"
        class="relative z-0 mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted"
      >
        {{ error }}
      </p>

      <div class="relative z-0 mt-8">
        <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
        <AnimeGrid
          v-else
          :media="items.map(itemToMedia)"
          empty="Busca un anime arriba y añádelo a tus pendientes."
          removable
          @remove="onRemove"
        />
      </div>
    </main>
  </div>
</template>
