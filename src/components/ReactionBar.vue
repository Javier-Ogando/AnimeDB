<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/lib/i18n'
import {
  REACTION_EMOJIS,
  toggleReaction,
  watchReactions,
  type ReactionEmoji,
  type ReviewReaction,
} from '@/lib/threads'

/**
 * Fila de reacciones de una resena.
 *
 * Cada usuario tiene una sola reaccion (el documento se llama como su uid), asi
 * que pulsar la que ya tenias la quita y pulsar otra la cambia de sitio. Se
 * resalta la propia para que se vea de un vistazo cual has puesto tu.
 */
const props = defineProps<{ mediaId: number; reviewUid: string }>()

const { user } = useAuth()
const { notify } = useToast()
const { t } = useI18n()

const reactions = ref<ReviewReaction[]>([])
const isBusy = ref(false)

let unsubscribe: (() => void) | null = null

// Una suscripcion por resena. Son colecciones diminutas (un documento por
// persona) y a cambio la reaccion de otro aparece sin recargar.
watch(
  () => [props.mediaId, props.reviewUid] as const,
  () => {
    unsubscribe?.()
    unsubscribe = watchReactions(
      props.mediaId,
      props.reviewUid,
      (next) => (reactions.value = next),
      // Un fallo aqui no merece un aviso en pantalla por cada resena de la
      // ficha: la fila se queda simplemente a cero.
      () => (reactions.value = []),
    )
  },
  { immediate: true },
)

onUnmounted(() => unsubscribe?.())

/** Recuento por emoji. Se ignora cualquier valor fuera del juego conocido. */
const counts = computed(() => {
  const tally = new Map<string, number>()
  for (const reaction of reactions.value) {
    tally.set(reaction.emoji, (tally.get(reaction.emoji) ?? 0) + 1)
  }
  return tally
})

const mine = computed(
  () => reactions.value.find((reaction) => reaction.id === user.value?.uid)?.emoji ?? null,
)

async function onPick(emoji: ReactionEmoji) {
  if (!user.value || isBusy.value) return

  isBusy.value = true
  try {
    await toggleReaction(props.mediaId, props.reviewUid, user.value.uid, emoji, mine.value)
  } catch (e) {
    notify(
      (e as Error).message.includes('permission')
        ? t('detail.reactionPermission')
        : t('detail.reactionError'),
      'error',
    )
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-for="emoji in REACTION_EMOJIS"
      :key="emoji"
      type="button"
      :disabled="!user || isBusy"
      :aria-pressed="mine === emoji"
      :title="mine === emoji ? t('detail.reactionRemove') : t('detail.react')"
      class="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        mine === emoji
          ? 'border-accent/50 bg-accent/10 text-accent'
          : 'border-overlay bg-surface-2/70 text-muted hover:border-line-strong hover:text-body'
      "
      @click="onPick(emoji)"
    >
      <span aria-hidden="true">{{ emoji }}</span>
      <span v-if="counts.get(emoji)" class="tabular-nums">{{ counts.get(emoji) }}</span>
    </button>
  </div>
</template>
