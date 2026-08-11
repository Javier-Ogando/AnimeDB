<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/lib/i18n'
import {
  addAnimeToList,
  canEdit,
  createInvite,
  deleteList,
  fetchUserProfiles,
  findInviteForList,
  getList,
  inviteUrl,
  itemToMedia,
  removeAnimeFromList,
  renameList,
  roleOf,
  setMemberRole,
  updateItemStatus,
  watchListItems,
  type ListItem,
  type ListWithId,
} from '@/lib/lists'
import AnimeGrid from '@/components/AnimeGrid.vue'
import AnimeSearchInput from '@/components/AnimeSearchInput.vue'
import AppHeader from '@/components/AppHeader.vue'
import ListSettings from '@/components/ListSettings.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { MediaSummary } from '@/types/anilist'
import type { ItemStatus, ListRole } from '@/types/models'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { notify } = useToast()
const { t } = useI18n()

const listId = String(route.params.listId)

const list = ref<ListWithId | null>(null)
const items = ref<ListItem[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const link = ref<string | null>(null)
const profiles = ref(new Map<string, { displayName: string | null; photoURL: string | null }>())

let unsubscribe: (() => void) | null = null

const myRole = computed(() => roleOf(list.value, user.value?.uid))
const canWrite = computed(() => canEdit(myRole.value))

function describe(e: Error): string {
  return e.message.includes('permission') ? t('error.permissionRole') : t('error.generic')
}

async function loadList() {
  list.value = await getList(listId)
  if (list.value?.memberUids?.length) {
    profiles.value = await fetchUserProfiles(list.value.memberUids)
  }
}

async function start() {
  try {
    await loadList()
    if (!list.value) {
      error.value = t('shared.notFound')
      isLoading.value = false
      return
    }

    // Se reutiliza la invitacion viva si la hay, para no generar un token nuevo
    // cada vez que se abre la pantalla.
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

/** Envoltorio comun: toda accion avisa por toast si falla. */
async function run(action: () => Promise<void>, ok?: string) {
  try {
    await action()
    if (ok) notify(ok)
  } catch (e) {
    notify(describe(e as Error), 'error')
  }
}

const onAdd = (media: MediaSummary) =>
  run(
    () => addAnimeToList(listId, media, user.value!.uid),
    t('shared.added', { title: media.titleRomaji ?? media.titlePreferred }),
  )

const onRemove = (media: MediaSummary) => run(() => removeAnimeFromList(listId, media.id))

const onStatus = (media: MediaSummary, status: ItemStatus) =>
  run(() => updateItemStatus(listId, media.id, status, user.value!.uid))

const onRename = (name: string) =>
  run(async () => {
    await renameList(listId, name)
    await loadList()
  }, t('shared.renamed'))

const onRole = (uid: string, role: ListRole) =>
  run(async () => {
    await setMemberRole(listId, uid, role)
    await loadList()
  }, t('shared.roleUpdated'))

const onRegenerate = () =>
  run(async () => {
    const token = await createInvite(listId, user.value!.uid)
    link.value = inviteUrl(token)
  }, t('shared.linkRegenerated'))

const onDelete = () =>
  run(async () => {
    await deleteList(listId)
    await router.replace({ name: 'shared-lists' })
  })
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 pt-10 pb-28">
      <div class="flex items-start justify-between gap-4">
        <PageHeader
          :kicker="list?.name ?? t('shared.listFallback')"
          :count="items.length"
          :unit="[t('unit.titleOne'), t('unit.titleMany')]"
          class="min-w-0 flex-1"
        />

        <!-- Los ajustes viven aqui y no en un bloque fijo: el enlace de
             invitacion ocupaba media pantalla para algo que se usa una vez. -->
        <ListSettings
          v-if="list"
          :list="list"
          :role="myRole"
          :invite-link="link"
          :profiles="profiles"
          :my-uid="user?.uid"
          @rename="onRename"
          @role="onRole"
          @regenerate="onRegenerate"
          @remove="onDelete"
        />
      </div>

      <div v-if="canWrite" class="mt-6 flex">
        <AnimeSearchInput @select="onAdd" />
      </div>
      <p v-else-if="list" class="mt-6 text-xs text-faint">
        {{ t('shared.readOnly') }}
      </p>

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
          :empty="t('shared.itemsEmpty')"
          :manage="canWrite"
          @remove="onRemove"
          @status="onStatus"
        />
      </div>
    </main>
  </div>
</template>
