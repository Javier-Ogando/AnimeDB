<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { createSharedList, watchMyLists, type ListWithId } from '@/lib/lists'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'

const { user } = useAuth()
const router = useRouter()

const lists = ref<ListWithId[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const isCreating = ref(false)
const showForm = ref(false)
const name = ref('')

let unsubscribe: (() => void) | null = null

function describe(e: Error): string {
  return e.message.includes('permission')
    ? 'Firestore ha denegado el acceso. Despliega las reglas: npx firebase deploy --only firestore:rules'
    : 'No se han podido cargar las listas.'
}

const uid = user.value?.uid
if (uid) {
  unsubscribe = watchMyLists(
    uid,
    'shared',
    (next) => {
      lists.value = next
      isLoading.value = false
    },
    (e) => {
      error.value = describe(e)
      isLoading.value = false
    },
  )
}

onUnmounted(() => unsubscribe?.())

async function onCreate() {
  if (!user.value || isCreating.value) return

  isCreating.value = true
  error.value = null
  try {
    const { listId } = await createSharedList(user.value.uid, name.value)
    name.value = ''
    showForm.value = false
    // Se entra directo: la lista recien creada ya tiene su enlace de invitacion.
    await router.push({ name: 'shared-list', params: { listId } })
  } catch (e) {
    error.value = describe(e as Error)
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 py-10">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          kicker="Con quien quieras"
          title="Listas compartidas"
          :count="lists.length"
          :unit="['lista', 'listas']"
          hint="Cada lista tiene su propio enlace de invitación. Quien lo abra entra y puede añadir."
          class="min-w-0 flex-1"
        />

        <button
          type="button"
          class="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-medium transition hover:border-accent/60 hover:bg-accent/10"
          @click="showForm = !showForm"
        >
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva lista
        </button>
      </div>

      <form
        v-if="showForm"
        class="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4"
        @submit.prevent="onCreate"
      >
        <input
          v-model="name"
          type="text"
          placeholder="Nombre de la lista"
          maxlength="60"
          class="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm text-body transition placeholder:text-faint hover:border-line-strong focus:border-accent/60 focus:outline-none"
        />
        <button
          type="submit"
          :disabled="isCreating"
          class="cursor-pointer rounded-full border border-accent/50 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ isCreating ? 'Creando…' : 'Crear' }}
        </button>
      </form>

      <p
        v-if="error"
        role="alert"
        class="mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted"
      >
        {{ error }}
      </p>

      <p v-if="isLoading" class="mt-8 text-sm text-muted">Cargando…</p>

      <p
        v-else-if="!lists.length"
        class="mt-8 rounded-2xl border border-line bg-surface/60 px-4 py-8 text-center text-sm text-muted"
      >
        No tienes ninguna lista compartida. Crea una con el botón de arriba y comparte su enlace.
      </p>

      <ul v-else class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="list in lists" :key="list.id">
          <RouterLink
            :to="{ name: 'shared-list', params: { listId: list.id } }"
            class="block rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-accent/40"
          >
            <p class="font-display text-lg tracking-tight">{{ list.name }}</p>
            <p class="mt-1 text-xs text-muted tabular-nums">
              {{ list.itemCount ?? 0 }} {{ (list.itemCount ?? 0) === 1 ? 'título' : 'títulos' }}
              ·
              {{ list.memberUids?.length ?? 1 }}
              {{ (list.memberUids?.length ?? 1) === 1 ? 'miembro' : 'miembros' }}
            </p>
            <p v-if="list.ownerUid === user?.uid" class="mt-4 text-[11px] text-faint uppercase">
              Tuya
            </p>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>
