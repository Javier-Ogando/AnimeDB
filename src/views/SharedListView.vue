<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import {
  addAnimeToList,
  createInvite,
  findInviteForList,
  getList,
  inviteUrl,
  itemToMedia,
  removeAnimeFromList,
  watchListItems,
  type ListItem,
  type ListWithId,
} from '@/lib/lists'
import AnimeGrid from '@/components/AnimeGrid.vue'
import AnimeSearchInput from '@/components/AnimeSearchInput.vue'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { MediaSummary } from '@/types/anilist'

const route = useRoute()
const { user } = useAuth()

const listId = String(route.params.listId)

const list = ref<ListWithId | null>(null)
const items = ref<ListItem[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const link = ref<string | null>(null)
const isCopied = ref(false)

let unsubscribe: (() => void) | null = null

function describe(e: Error): string {
  return e.message.includes('permission')
    ? 'Firestore ha denegado el acceso. Despliega las reglas: npx firebase deploy --only firestore:rules'
    : 'No se ha podido cargar la lista.'
}

async function start() {
  try {
    list.value = await getList(listId)
    if (!list.value) {
      error.value = 'Esta lista no existe o ya no tienes acceso.'
      isLoading.value = false
      return
    }

    // El enlace se reutiliza si ya habia una invitacion viva, para no generar
    // un token nuevo cada vez que se abre la pantalla.
    const token = await findInviteForList(listId)
    if (token) link.value = inviteUrl(token)

    unsubscribe = watchListItems(
      listId,
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

void start()
onUnmounted(() => unsubscribe?.())

async function onCopy() {
  if (!link.value) return
  try {
    await navigator.clipboard.writeText(link.value)
    isCopied.value = true
    window.setTimeout(() => (isCopied.value = false), 2000)
  } catch {
    // Sin permiso de portapapeles el input sigue ahi para copiar a mano.
    isCopied.value = false
  }
}

async function onRegenerate() {
  if (!user.value) return
  try {
    const token = await createInvite(listId, user.value.uid)
    link.value = inviteUrl(token)
  } catch (e) {
    error.value = describe(e as Error)
  }
}

async function onAdd(media: MediaSummary) {
  if (!user.value) return
  try {
    await addAnimeToList(listId, media, user.value.uid)
  } catch (e) {
    error.value = describe(e as Error)
  }
}

async function onRemove(media: MediaSummary) {
  try {
    await removeAnimeFromList(listId, media.id)
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
        kicker="Lista compartida"
        :title="list?.name ?? 'Lista compartida'"
        :count="items.length"
        :unit="['título', 'títulos']"
        :hint="`${list?.memberUids?.length ?? 1} ${(list?.memberUids?.length ?? 1) === 1 ? 'miembro' : 'miembros'} pueden ver y añadir en esta lista.`"
      />

      <!-- Enlace de invitacion, encima del listado -->
      <section class="mt-6 rounded-2xl border border-line bg-surface/60 p-4">
        <p class="text-[11px] tracking-[0.16em] text-faint uppercase">Invitar a alguien</p>

        <div v-if="link" class="mt-3 flex flex-wrap items-center gap-2">
          <input
            :value="link"
            readonly
            class="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-xs text-muted focus:border-accent/60 focus:outline-none"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="shrink-0 cursor-pointer rounded-full border border-accent/50 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/10"
            @click="onCopy"
          >
            {{ isCopied ? '¡Copiado!' : 'Copiar' }}
          </button>
        </div>

        <div v-else class="mt-3 flex flex-wrap items-center gap-3">
          <p class="text-sm text-muted">Esta lista no tiene un enlace activo.</p>
          <button
            type="button"
            class="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-medium text-body transition hover:border-accent/60"
            @click="onRegenerate"
          >
            Generar enlace
          </button>
        </div>

        <p class="mt-3 text-xs leading-relaxed text-faint">
          Cualquiera con este enlace puede unirse a la lista. Genera uno nuevo si quieres invalidar
          el anterior.
        </p>
      </section>

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
          empty="Aún no hay nada en esta lista. Busca un anime arriba."
          removable
          @remove="onRemove"
        />
      </div>
    </main>
  </div>
</template>
