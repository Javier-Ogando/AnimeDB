<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/lib/i18n'
import { getMyReview, saveReview } from '@/lib/reviews'
import StarRating from './StarRating.vue'
import type { MediaSummary } from '@/types/anilist'

/**
 * Puntuar y comentar un anime sin salir de la lista.
 *
 * Se abre desde el menu de la card cuando el anime esta terminado, para no
 * obligar a entrar en la ficha y volver solo para dejar una nota.
 *
 * El componente vive mientras el dialogo esta abierto: quien lo usa lo monta con
 * v-if y escucha `close`. Asi cada apertura relee la resena guardada en vez de
 * arrastrar la del anime anterior.
 */
const props = defineProps<{ media: MediaSummary }>()
const emit = defineEmits<{ close: [] }>()

const { user } = useAuth()
const { notify } = useToast()
const { t } = useI18n()

const panel = ref<HTMLElement | null>(null)

const score = ref(4)
const comment = ref('')
const isLoading = ref(true)
const isSaving = ref(false)
/** Ya existia resena: el dialogo se presenta como edicion, no como alta. */
const isEditing = ref(false)

const title = computed(() => props.media.titleRomaji ?? props.media.titlePreferred)
const heading = computed(() => (isEditing.value ? t('detail.editRating') : t('detail.myRating')))

function close() {
  // Guardando no se cierra: al cerrar se desmonta el componente y con el se
  // iria la peticion en vuelo sin que nadie cuente el resultado.
  if (isSaving.value) return
  emit('close')
}

/*
 * Cierre al pulsar fuera y con Escape, mismo patron que ItemMenu.vue (pointerdown
 * en document + contains) y ListSettings.vue (que anade Escape). Se comprueba
 * contra el panel y no contra el velo, de modo que pulsar el velo cuenta como
 * fuera.
 */
function onPointerDown(event: PointerEvent) {
  if (!panel.value?.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
  // El foco entra en el dialogo: si se quedase en el menu de la card, el
  // tabulador seguiria paseando por las cards de detras.
  panel.value?.focus()
  void load()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

/*
 * Solo hay UNA resena por usuario y anime (el uid es el ID del documento), asi
 * que lo primero es traer la que ya exista. Sin esto el dialogo se abriria en
 * blanco y el usuario creeria estar escribiendo una nueva cuando en realidad
 * sobreescribe la suya, perdiendo el comentario anterior.
 */
async function load() {
  const uid = user.value?.uid
  if (!uid) {
    isLoading.value = false
    return
  }

  try {
    const mine = await getMyReview(props.media.id, uid)
    if (mine) {
      score.value = mine.score
      comment.value = mine.comment
      isEditing.value = true
    }
  } catch {
    // Tu resena es dato opcional: si la lectura falla se ofrece el formulario
    // en blanco, mejor que un dialogo bloqueado.
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

async function onSave() {
  const uid = user.value?.uid
  if (!uid || isSaving.value) return

  isSaving.value = true
  try {
    await saveReview(props.media.id, uid, score.value, comment.value)
    notify(t('detail.saved'))
    emit('close')
  } catch (e) {
    notify(
      (e as Error).message.includes('permission')
        ? t('detail.savePermission')
        : t('detail.saveError'),
      'error',
    )
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <!-- z-40 y no mas: los avisos (z-50) cuentan el resultado y deben quedar
       encima del velo. -->
  <div class="fixed inset-0 z-40 grid place-items-center bg-canvas/70 p-4 backdrop-blur-sm">
    <div
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="heading"
      :aria-busy="isLoading"
      tabindex="-1"
      class="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-2xl shadow-shade focus:outline-none"
    >
      <p class="font-display text-lg tracking-tight text-body">{{ heading }}</p>
      <p class="mt-0.5 truncate text-xs text-muted">{{ title }}</p>

      <!-- Mientras se lee la resena guardada los campos estan atenuados y
           bloqueados: si se pudiera escribir, la carga pisaria lo escrito. -->
      <div class="mt-4" :class="isLoading ? 'opacity-50' : ''">
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-xs text-faint" for="review-score">{{ t('detail.score') }}</label>
          <input
            id="review-score"
            v-model.number="score"
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            :disabled="isLoading || isSaving"
            class="h-1.5 flex-1 cursor-pointer accent-accent disabled:cursor-not-allowed"
          />
          <StarRating :value="score" size="md" />
          <span class="w-8 text-right text-sm text-muted tabular-nums">{{ score }}</span>
        </div>

        <textarea
          v-model="comment"
          rows="4"
          maxlength="2000"
          :disabled="isLoading || isSaving"
          :placeholder="t('detail.commentPlaceholder')"
          class="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:border-accent/60 focus:outline-none disabled:cursor-not-allowed"
        />

        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="text-[11px] text-faint tabular-nums">{{ comment.length }}/2000</span>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="isSaving"
              class="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-medium text-muted transition hover:border-line-strong hover:text-body disabled:cursor-not-allowed disabled:opacity-60"
              @click="close"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              :disabled="isLoading || isSaving"
              class="cursor-pointer rounded-full border border-accent/50 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              @click="onSave"
            >
              {{ isSaving ? t('detail.saving') : t('detail.saveRating') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
