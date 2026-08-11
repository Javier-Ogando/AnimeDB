<script setup lang="ts">
import { ref, watch } from 'vue'
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

const isOpen = ref(false)
const name = ref(props.list.name)
const isCopied = ref(false)
const confirmDelete = ref(false)

// Si la lista se renombra desde otra sesion, el campo debe reflejarlo.
watch(
  () => props.list.name,
  (next) => {
    if (!isOpen.value) name.value = next
  },
)

const ROLES: Array<{ id: ListRole; label: string; hint: string }> = [
  { id: 'owner', label: 'Propietario', hint: 'Todo, incluidos roles y borrar' },
  { id: 'manager', label: 'Gestor', hint: 'Añadir, quitar, renombrar, invitar' },
  { id: 'viewer', label: 'Visor', hint: 'Solo ver' },
]

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
  <div class="relative">
    <button
      type="button"
      class="float-pill grid size-9 cursor-pointer place-items-center text-muted transition hover:text-body"
      :aria-expanded="isOpen"
      aria-label="Ajustes de la lista"
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

    <div
      v-if="isOpen"
      class="float-pill absolute top-full right-0 z-40 mt-2 w-80 !rounded-2xl p-4"
    >
      <p class="text-[11px] tracking-[0.2em] text-faint uppercase">Ajustes</p>

      <!-- Nombre -->
      <template v-if="role === 'owner' || role === 'manager'">
        <form class="mt-3 flex items-center gap-2" @submit.prevent="emit('rename', name)">
          <input
            v-model="name"
            type="text"
            maxlength="60"
            aria-label="Nombre de la lista"
            class="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-body focus:border-accent/60 focus:outline-none"
          />
          <button
            type="submit"
            :disabled="name.trim() === list.name"
            class="shrink-0 cursor-pointer rounded-full border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar
          </button>
        </form>

        <!-- Enlace de invitacion -->
        <div class="mt-4">
          <p class="text-[10px] tracking-[0.18em] text-faint uppercase">Invitación</p>
          <div v-if="inviteLink" class="mt-2 flex items-center gap-2">
            <input
              :value="inviteLink"
              readonly
              aria-label="Enlace de invitación"
              class="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted focus:outline-none"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="shrink-0 cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/60 hover:text-body"
              @click="onCopy"
            >
              {{ isCopied ? '¡Hecho!' : 'Copiar' }}
            </button>
          </div>
          <button
            type="button"
            class="mt-2 cursor-pointer text-[11px] text-accent underline underline-offset-2"
            @click="emit('regenerate')"
          >
            {{ inviteLink ? 'Generar uno nuevo (invalida el anterior)' : 'Generar enlace' }}
          </button>
        </div>
      </template>

      <!-- Miembros y roles: solo el propietario -->
      <div class="mt-4">
        <p class="text-[10px] tracking-[0.18em] text-faint uppercase">
          Miembros ({{ list.memberUids?.length ?? 1 }})
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
              {{ profiles.get(uid)?.displayName ?? 'Usuario' }}
              <span v-if="uid === myUid" class="text-faint">(tú)</span>
            </span>

            <!-- Al propietario no se le cambia el rol: perderia el control. -->
            <select
              v-if="role === 'owner' && uid !== list.ownerUid"
              :value="roleOfMember(uid)"
              class="shrink-0 cursor-pointer rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-muted focus:border-accent/60 focus:outline-none"
              :aria-label="`Rol de ${profiles.get(uid)?.displayName ?? 'usuario'}`"
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
          Eliminar la lista
        </button>
        <div v-else class="flex items-center gap-2">
          <span class="text-xs text-muted">¿Seguro? No se puede deshacer.</span>
          <button
            type="button"
            class="cursor-pointer rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400"
            @click="emit('remove')"
          >
            Sí
          </button>
          <button
            type="button"
            class="cursor-pointer text-xs text-faint"
            @click="confirmDelete = false"
          >
            No
          </button>
        </div>
      </div>

      <p v-if="role === 'viewer'" class="mt-3 text-xs leading-relaxed text-faint">
        Tu rol es <strong class="text-muted">Visor</strong>: puedes ver la lista, pero no añadir ni
        quitar. Pide a quien te invitó que te suba a Gestor.
      </p>
    </div>
  </div>
</template>
