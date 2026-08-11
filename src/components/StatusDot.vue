<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/lib/i18n'
import type { ItemStatus } from '@/types/models'

/**
 * Circulo de estado. Mismo tamano y radio que el boton de opciones para que
 * formen pareja en la esquina de la card: si uno cambia de medida, el otro
 * tambien (ahora size-9, el suelo tactil del proyecto).
 *
 * El color es un codigo que el usuario aprende, asi que los tonos son fijos en
 * ambos temas. Lleva title y aria-label porque el color a solas no informa a
 * quien no lo distingue.
 */
const props = defineProps<{ status: ItemStatus }>()

const { t } = useI18n()

const STATUS: Record<ItemStatus, { labelKey: string; color: string }> = {
  pending: { labelKey: 'card.statusPending', color: 'bg-status-pending' },
  watching: { labelKey: 'card.statusWatching', color: 'bg-status-watching' },
  done: { labelKey: 'card.statusDone', color: 'bg-status-done' },
}

const current = computed(() => ({
  label: t(STATUS[props.status].labelKey),
  color: STATUS[props.status].color,
}))
</script>

<template>
  <span
    class="float-pill grid size-9 place-items-center"
    :title="current.label"
    role="img"
    :aria-label="t('card.statusAria', { status: current.label })"
  >
    <span class="size-3.5 rounded-full" :class="current.color" />
  </span>
</template>
