<script setup lang="ts">
import { computed } from 'vue'
import type { ItemStatus } from '@/types/models'

/**
 * Circulo de estado. Mismo tamano y radio que el boton de opciones para que
 * formen pareja en la esquina de la card.
 *
 * El color es un codigo que el usuario aprende, asi que los tonos son fijos en
 * ambos temas. Lleva title y aria-label porque el color a solas no informa a
 * quien no lo distingue.
 */
const props = defineProps<{ status: ItemStatus }>()

const STATUS = {
  pending: { label: 'Pendiente', color: 'bg-status-pending' },
  watching: { label: 'En seguimiento', color: 'bg-status-watching' },
  done: { label: 'Terminado', color: 'bg-status-done' },
} as const

const current = computed(() => STATUS[props.status])
</script>

<template>
  <span
    class="float-pill grid size-7 place-items-center"
    :title="current.label"
    role="img"
    :aria-label="`Estado: ${current.label}`"
  >
    <span class="size-3 rounded-full" :class="current.color" />
  </span>
</template>
