<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '@/lib/i18n'
import type { ListRole } from '@/types/models'
import type { ListWithId } from '@/lib/lists'

/**
 * Ajustes de una lista compartida, tras un engranaje. Lo que se ve depende del
 * rol: un viewer no ve nada editable, un manager puede renombrar e invitar, y
 * solo el owner toca roles y puede borrar la lista.
 *
 * El componente no escribe en Firestore: emite intenciones y la vista decide.
 */
const props = defineProps<{
  list: ListWithId
  role: ListRole | null
  inviteLink: string | null
  /** Nombre y avatar por uid, para la lista de miembros. */
  profiles: Map<string, { displayName: string | null; photoURL: string | null }>
  myUid: string | undefined
}>()

const emit = defineEmits<{
  rename: [name: string]
  role: [uid: string, role: ListRole]
  regenerate: []
  remove: []
}>()

const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const name = ref(props.list.name)
const isCopied = ref(false)
const confirmDelete = ref(false)

/*
 * Al cerrar se desarma TODO el estado transitorio. Sin esto, la secuencia
 * "Eliminar la lista" -> "¿Seguro?" -> cerrar el panel creyendo que has
 * cancelado -> reabrir dejaba la confirmacion armada, y un solo toque en "Si"
 * borraba la lista y todos sus items sin vuelta atras.
 */
watch(isOpen, (open) => {
  if (open) return
  confirmDelete.value = false
  isCopied.value = false
  name.value = props.list.name
})

/*
 * Cierre al pulsar fuera y con Escape. El patron es el mismo que en
 * ItemMenu.vue: pointerdown en document y comprobacion de contains, que cierra
 * antes de que el navegador mueva el foco.
 */
function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) isOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) isOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

// Si la lista se renombra desde otra sesion, el campo debe reflejarlo.
watch(
  () => props.list.name,
  (next) => {
    if (!isOpen.value) name.value = next
  },
)

const ROLES = computed<Array<{ id: ListRole; label: string; hint: string }>>(() => [
  { id: 'owner', label: t('shared.roleOwner'), hint: t('shared.roleOwnerHint') },
  { id: 'manager', label: t('shared.roleManager'), hint: t('shared.roleManagerHint') },
  { id: 'viewer', label: t('shared.roleViewer'), hint: t('shared.roleViewerHint') },
])

async function onCopy() {
  if (!props.inviteLink) return
  try {
    await navigator.clipboard.writeText(props.inviteLink)
    isCopied.value = true
    window.setTimeout(() => (isCopied.value = false), 2000)
  } catch {
    isCopied.value = false
  }
}

function roleOfMember(uid: string): ListRole {
  if (props.list.ownerUid === uid) return 'owner'
  return props.list.roles?.[uid] ?? 'manager'
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      aria-haspopup="dialog"
      class="float-pill grid size-9 cursor-pointer place-items-center text-muted transition hover:text-body"
      :aria-expanded="isOpen"
      :aria-label="t('shared.settingsAria')"
      @click="isOpen = !isOpen"
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.2" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.4.64.73.83"
        />
      </svg>
    </button>

    <!-- El ancho se limita al hueco disponible: con w-80 fijo, en un movil de
         320 px el panel se salia por la izquierda. -->
    <div
      v-if="isOpen"
      class="float-pill absolute top-full right-0 z-40 mt-2 w-[min(20rem,calc(100vw-3rem))] !rounded-2xl p-4"
    >
      <p class="text-[11px] tracking-[0.2em] text-faint uppercase">{{ t('shared.settings') }}</p>

      <!-- Nombre -->
      <template v-if="role === 'owner' || role === 'manager'">
        <form class="mt-3 flex items-center gap-2" @submit.prevent="emit('rename', name)">
          <input
            v-model="name"
            type="text"
            maxlength="60"
            :aria-label="t('shared.name')"
            class="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-body focus:border-accent/60 focus:outline-none"
          />
          <button
            type="submit"
            :disabled="name.trim() === list.name"
            class="shrink-0 cursor-pointer rounded-full border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {{ t('prefs.save') }}
          </button>
        </form>

        <!-- Enlace de invitacion -->
        <div class="mt-4">
          <p class="text-[10px] tracking-[0.18em] text-faint uppercase">{{ t('shared.invite') }}</p>
          <div v-if="inviteLink" class="mt-2 flex items-center gap-2">
            <input
              :value="inviteLink"
              readonly
              :aria-label="t('shared.inviteLink')"
              class="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted focus:outline-none"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="shrink-0 cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/60 hover:text-body"
              @click="onCopy"
            >
              {{ isCopied ? t('shared.copied') : t('shared.copy') }}
            </button>
          </div>
          <button
            type="button"
            class="mt-2 cursor-pointer text-[11px] text-accent underline underline-offset-2"
            @click="emit('regenerate')"
          >
            {{ inviteLink ? t('shared.regenerate') : t('shared.generateLink') }}
          </button>
        </div>
      </template>

      <!-- Miembros y roles: solo el propietario -->
      <div class="mt-4">
        <p class="text-[10px] tracking-[0.18em] text-faint uppercase">
          {{ t('shared.members', { count: list.memberUids?.length ?? 1 }) }}
        </p>

        <ul class="mt-2 space-y-2">
          <li
            v-for="uid in list.memberUids ?? []"
            :key="uid"
            class="flex items-center gap-2"
          >
            <img
              v-if="profiles.get(uid)?.photoURL"
              :src="profiles.get(uid)!.photoURL!"
              alt=""
              class="size-6 shrink-0 rounded-full ring-1 ring-line"
              referrerpolicy="no-referrer"
            />
            <span v-else class="size-6 shrink-0 rounded-full bg-surface-2" aria-hidden="true" />

            <span class="min-w-0 flex-1 truncate text-xs text-body">
              {{ profiles.get(uid)?.displayName ?? t('common.user') }}
              <span v-if="uid === myUid" class="text-faint">{{ t('common.you') }}</span>
            </span>

            <!-- Al propietario no se le cambia el rol: perderia el control. -->
            <select
              v-if="role === 'owner' && uid !== list.ownerUid"
              :value="roleOfMember(uid)"
              class="shrink-0 cursor-pointer rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-muted focus:border-accent/60 focus:outline-none"
              :aria-label="
                t('shared.roleOf', {
                  name: profiles.get(uid)?.displayName ?? t('common.userLowercase'),
                })
              "
              @change="emit('role', uid, ($event.target as HTMLSelectElement).value as ListRole)"
            >
              <option v-for="option in ROLES" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </select>
            <span v-else class="shrink-0 text-[11px] text-faint">
              {{ ROLES.find((r) => r.id === roleOfMember(uid))?.label }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Borrar: solo el propietario -->
      <div v-if="role === 'owner'" class="mt-4 border-t border-line pt-3">
        <button
          v-if="!confirmDelete"
          type="button"
          class="cursor-pointer text-xs font-medium text-red-400 transition hover:text-red-300"
          @click="confirmDelete = true"
        >
          {{ t('shared.deleteList') }}
        </button>
        <div v-else class="flex items-center gap-2">
          <span class="text-xs text-muted">{{ t('shared.deleteConfirm') }}</span>
          <button
            type="button"
            class="cursor-pointer rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400"
            @click="emit('remove')"
          >
            {{ t('common.yes') }}
          </button>
          <button
            type="button"
            class="cursor-pointer text-xs text-faint"
            @click="confirmDelete = false"
          >
            {{ t('common.no') }}
          </button>
        </div>
      </div>

      <p v-if="role === 'viewer'" class="mt-3 text-xs leading-relaxed text-faint">
        {{ t('shared.viewerNoteBefore')
        }}<strong class="text-muted">{{ t('shared.roleViewer') }}</strong
        >{{ t('shared.viewerNoteAfter') }}
      </p>
    </div>
  </div>
</template>
