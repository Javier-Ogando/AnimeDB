<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/lib/i18n'
import {
  addAnimeToList,
  ensurePersonalList,
  itemToMedia,
  removeAnimeFromList,
  updateItemStatus,
  watchListItems,
  type ListItem,
} from '@/lib/lists'
import AnimeGrid from '@/components/AnimeGrid.vue'
import AnimeSearchInput from '@/components/AnimeSearchInput.vue'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { MediaSummary } from '@/types/anilist'
import type { ItemStatus } from '@/types/models'

const { user } = useAuth()
const { t } = useI18n()

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
  return e.message.includes('permission') ? t('error.permissionRead') : t('personal.loadError')
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

async function onStatus(media: MediaSummary, status: ItemStatus) {
  if (!listId.value || !user.value) return
  try {
    await updateItemStatus(listId.value, media.id, status, user.value.uid)
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

    <main class="mx-auto max-w-6xl px-6 pt-10 pb-28">
      <PageHeader
        :kicker="t('personal.kicker')"
        :count="items.length"
        :unit="[t('unit.titleOne'), t('unit.titleMany')]"
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
        <p v-if="isLoading" class="text-sm text-muted">{{ t('common.loading') }}</p>
        <AnimeGrid
          v-else
          :media="items.map(itemToMedia)"
          :empty="t('personal.empty')"
          manage
          @remove="onRemove"
          @status="onStatus"
        />
      </div>
    </main>
  </div>
</template>
