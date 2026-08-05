<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import {
  addAnimeToList,
  ensurePersonalList,
  personalListId,
  watchMyLists,
  type ListWithId,
} from '@/lib/lists'
import AnimeSearchInput, { type SearchDestination } from '@/components/AnimeSearchInput.vue'
import AppHeader from '@/components/AppHeader.vue'
import type { MediaSummary } from '@/types/anilist'

const { user } = useAuth()
const { notify } = useToast()

const cards = [
  { to: '/personal', title: 'Mis pendientes', hint: 'Tu lista personal' },
  { to: '/general', title: 'General', hint: 'Todo lo registrado en la app' },
  { to: '/compartidas', title: 'Listas compartidas', hint: 'Por link de invitación' },
]

/** Las compartidas son destinos del buscador, así que hay que conocerlas. */
const sharedLists = ref<ListWithId[]>([])

let unsubscribe: (() => void) | null = null

const uid = user.value?.uid
if (uid) {
  unsubscribe = watchMyLists(uid, 'shared', (next) => (sharedLists.value = next))
}
onUnmounted(() => unsubscribe?.())

const destinations = computed<SearchDestination[]>(() => [
  { id: 'personal', label: 'Personal' },
  ...sharedLists.value.map((list) => ({ id: list.id, label: list.name })),
])

async function onSelect(media: MediaSummary, destinationId: string) {
  if (!user.value) return

  try {
    // 'personal' es un alias: la lista personal se crea al vuelo si no existe.
    const listId =
      destinationId === 'personal'
        ? await ensurePersonalList(user.value.uid)
        : destinationId || personalListId(user.value.uid)

    await addAnimeToList(listId, media, user.value.uid)

    const target = destinations.value.find((d) => d.id === destinationId)
    notify(`«${media.titleRomaji ?? media.titlePreferred}» añadido a ${target?.label ?? 'tu lista'}.`)
  } catch (e) {
    notify(
      (e as Error).message.includes('permission')
        ? 'Firestore ha denegado la escritura. Despliega las reglas: npx firebase deploy --only firestore:rules'
        : 'No se ha podido añadir.',
      'error',
    )
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-5xl px-6 py-12">
      <div class="flex justify-center">
        <AnimeSearchInput :destinations="destinations" @select="onSelect" />
      </div>

      <!-- z-0 explicito: el desplegable del buscador debe quedar por encima. -->
      <div class="relative z-0 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="card in cards"
          :key="card.title"
          :to="card.to"
          class="rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-accent/40"
        >
          <h2 class="text-sm font-medium">{{ card.title }}</h2>
          <p class="mt-1 text-xs text-muted">{{ card.hint }}</p>
          <p class="mt-6 text-xs text-accent">Abrir →</p>
        </RouterLink>
      </div>
    </main>
  </div>
</template>
