<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/lib/i18n'
import { fetchUserProfiles } from '@/lib/lists'
import {
  addReply,
  buildThread,
  deleteReply,
  MAX_REPLY_DEPTH,
  MAX_REPLY_LENGTH,
  watchReplies,
  type ReviewReply,
} from '@/lib/threads'
import type { Timestamp } from 'firebase/firestore'

/**
 * Hilo de conversacion de una resena.
 *
 * El arbol lo arma buildThread() a partir de parentId y llega aqui como lista
 * plana con su nivel: asi se pinta con un v-for normal y no hace falta un
 * componente recursivo, que ademas obligaria a repetir el formulario en cada
 * nivel.
 */
const props = defineProps<{ mediaId: number; reviewUid: string }>()

const { user } = useAuth()
const { notify } = useToast()
const { t, locale } = useI18n()

const replies = ref<ReviewReply[]>([])
const profiles = ref(new Map<string, { displayName: string | null; photoURL: string | null }>())

/**
 * Formulario abierto, si hay alguno: parentId es la respuesta a la que se
 * contesta, o null para el primer nivel. Un unico estado para todo el hilo
 * porque tambien hay un unico borrador: dos cajas abiertas a la vez se pisarian
 * el texto.
 */
const form = ref<{ parentId: string | null } | null>(null)
const draft = ref('')
const isSending = ref(false)
/** Los hilos largos empiezan recogidos: si no, una resena tapa la siguiente. */
const isExpanded = ref(false)

let unsubscribe: (() => void) | null = null

/** Cuantas respuestas se ven antes de tener que desplegar el hilo. */
const COLLAPSED_COUNT = 4

const thread = computed(() => buildThread(replies.value))
const visible = computed(() =>
  isExpanded.value ? thread.value : thread.value.slice(0, COLLAPSED_COUNT),
)
const hidden = computed(() => thread.value.length - visible.value.length)

/**
 * Sangria por nivel. Las clases se escriben literales y no calculadas porque
 * Tailwind mira el codigo fuente: una clase montada con `ml-${n}` no existiria
 * en el CSS final.
 */
const INDENT = ['', 'ml-5 sm:ml-8', 'ml-10 sm:ml-16'] as const
const indentFor = (depth: number) => INDENT[Math.min(depth, MAX_REPLY_DEPTH - 1)] ?? ''

watch(
  () => [props.mediaId, props.reviewUid] as const,
  () => {
    unsubscribe?.()
    replies.value = []
    unsubscribe = watchReplies(
      props.mediaId,
      props.reviewUid,
      (next) => {
        replies.value = next
        void loadProfiles(next)
      },
      () => notify(t('detail.repliesError'), 'error'),
    )
  },
  { immediate: true },
)

onUnmounted(() => unsubscribe?.())

/**
 * Perfiles de quienes escriben en el hilo. Solo se piden los que faltan: cada
 * respuesta nueva dispara un snapshot, y volver a leer todos los perfiles en
 * cada uno seria una lectura por autor y por mensaje.
 */
async function loadProfiles(list: ReviewReply[]) {
  const missing = [...new Set(list.map((reply) => reply.uid))].filter(
    (uid) => !profiles.value.has(uid),
  )
  if (!missing.length) return

  const fetched = await fetchUserProfiles(missing)
  profiles.value = new Map([...profiles.value, ...fetched])
}

function openForm(parentId: string | null) {
  form.value = { parentId }
  draft.value = ''
}

function closeForm() {
  form.value = null
  draft.value = ''
}

async function onSend() {
  if (!user.value || !form.value || isSending.value || !draft.value.trim()) return

  isSending.value = true
  try {
    await addReply(
      props.mediaId,
      props.reviewUid,
      user.value.uid,
      draft.value,
      form.value.parentId,
    )
    closeForm()
    // Enviar y no ver tu mensaje porque el hilo sigue recogido es desconcertante.
    isExpanded.value = true
  } catch (e) {
    notify(
      (e as Error).message.includes('permission')
        ? t('detail.replyPermission')
        : t('detail.replyError'),
      'error',
    )
  } finally {
    isSending.value = false
  }
}

async function onDelete(replyId: string) {
  try {
    await deleteReply(props.mediaId, props.reviewUid, replyId)
  } catch {
    notify(t('detail.replyDeleteError'), 'error')
  }
}

/** El formateador sigue al idioma activo: "hace 3 horas" / "3 hours ago". */
const relative = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }))

const UNITS = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
] as const

/**
 * Fecha en relativo ("hace 3 horas"). createdAt llega vacio en el instante entre
 * enviar y que el servidor sello la marca de tiempo, y ahi no se pinta nada.
 */
function when(createdAt: Timestamp | null | undefined): string {
  if (!createdAt) return ''

  const elapsed = createdAt.toMillis() - Date.now()
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) return relative.value.format(Math.round(elapsed / ms), unit)
  }
  return t('detail.now')
}

/*
 * Borrar una respuesta pedia confirmacion en ninguna parte, y el boton esta a 12
 * px de "Responder" con 15 px de alto: en movil el error es facil y la respuesta
 * no se recupera. Se confirma en dos pasos, como en ListSettings.
 */
const confirmingDelete = ref<string | null>(null)
</script>

<template>
  <div class="mt-3 border-t border-line pt-3">
    <p v-if="thread.length" class="text-[10px] tracking-[0.2em] text-faint uppercase">
      {{ t(thread.length === 1 ? 'detail.replyOne' : 'detail.replyMany', { count: thread.length }) }}
    </p>

    <ul v-if="visible.length" class="mt-2 space-y-2">
      <li v-for="node in visible" :key="node.reply.id" :class="indentFor(node.depth)">
        <div class="rounded-xl border border-overlay bg-surface-2/50 px-3 py-2">
          <div class="flex items-center gap-2">
            <img
              v-if="profiles.get(node.reply.uid)?.photoURL"
              :src="profiles.get(node.reply.uid)!.photoURL!"
              alt=""
              class="size-6 shrink-0 rounded-full ring-1 ring-line"
              referrerpolicy="no-referrer"
            />
            <span v-else class="size-6 shrink-0 rounded-full bg-surface" aria-hidden="true" />

            <p class="min-w-0 flex-1 truncate text-xs text-body">
              {{ profiles.get(node.reply.uid)?.displayName ?? t('common.user') }}
              <span v-if="node.reply.uid === user?.uid" class="text-faint">
                {{ t('common.you') }}
              </span>
            </p>

            <span class="shrink-0 text-[11px] text-faint">{{ when(node.reply.createdAt) }}</span>
          </div>

          <p class="mt-1.5 text-sm leading-relaxed break-words text-muted">
            {{ node.reply.text }}
          </p>

          <div class="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              class="cursor-pointer text-[11px] text-faint transition hover:text-accent"
              @click="openForm(node.reply.id)"
            >
              {{ t('detail.reply') }}
            </button><template v-if="confirmingDelete === node.reply.id">
              <span class="text-[11px] text-faint">{{ t('shared.deleteConfirm') }}</span>
              <button
                type="button"
                class="cursor-pointer rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400"
                @click="confirmingDelete = null; onDelete(node.reply.id)"
              >
                {{ t('common.yes') }}
              </button>
              <button
                type="button"
                class="cursor-pointer px-1 text-[11px] text-faint"
                @click="confirmingDelete = null"
              >
                {{ t('common.no') }}
              </button>
            </template>
            <button
              v-else
              type="button"
              class="cursor-pointer px-1 py-1.5 text-[11px] text-faint transition hover:text-red-400"
              @click="confirmingDelete = node.reply.id"
            >
              {{ t('detail.delete') }}
            </button>
          </div>

          <!-- Formulario en linea: contesta a ESTA respuesta. -->
          <form
            v-if="form?.parentId === node.reply.id"
            class="mt-2 flex flex-col gap-2"
            @submit.prevent="onSend"
          >
            <textarea
              v-model="draft"
              rows="2"
              :maxlength="MAX_REPLY_LENGTH"
              :placeholder="t('detail.replyPlaceholder')"
              class="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="cursor-pointer text-[11px] text-faint transition hover:text-body"
                @click="closeForm"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="isSending || !draft.trim()"
                class="cursor-pointer rounded-full border border-accent/50 px-3 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ isSending ? t('detail.sending') : t('detail.send') }}
              </button>
            </div>
          </form>
        </div>
      </li>
    </ul>

    <button
      v-if="hidden > 0"
      type="button"
      class="mt-2 cursor-pointer text-[11px] text-accent transition hover:underline"
      @click="isExpanded = true"
    >
      {{ t(hidden === 1 ? 'detail.showMoreOne' : 'detail.showMoreMany', { count: hidden }) }}
    </button>

    <!-- Respuesta de primer nivel. La caja no se pinta hasta que se pide: en una
         ficha con diez resenas, diez textareas abiertas son ruido. -->
    <template v-if="user">
      <button
        v-if="!form"
        type="button"
        class="mt-2 cursor-pointer text-[11px] text-faint transition hover:text-accent"
        @click="openForm(null)"
      >
        {{ t('detail.writeReply') }}
      </button>

      <form
        v-else-if="form.parentId === null"
        class="mt-2 flex flex-col gap-2"
        @submit.prevent="onSend"
      >
        <textarea
          v-model="draft"
          rows="2"
          :maxlength="MAX_REPLY_LENGTH"
          :placeholder="t('detail.writeReplyPlaceholder')"
          class="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:border-accent/60 focus:outline-none"
        />
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] text-faint tabular-nums">
            {{ draft.length }}/{{ MAX_REPLY_LENGTH }}
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="cursor-pointer text-[11px] text-faint transition hover:text-body"
              @click="closeForm"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="isSending || !draft.trim()"
              class="cursor-pointer rounded-full border border-accent/50 px-3 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ isSending ? t('detail.sending') : t('detail.reply') }}
            </button>
          </div>
        </div>
      </form>
    </template>
  </div>
</template>
