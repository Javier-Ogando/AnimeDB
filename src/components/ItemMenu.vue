<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '@/lib/i18n'

export interface MenuAction {
  id: string
  label: string
  /** Acciones destructivas: se pintan en rojo. */
  danger?: boolean
}

/**
 * Boton de tres puntos con acciones.
 *
 * Abre al PULSAR, y ademas al pasar el cursor solo en dispositivos con raton.
 * Depender unicamente de hover era un fallo en tactil: alli no existe, y que
 * funcionase quedaba a merced de que el navegador diese foco al boton al
 * tocarlo, que no todos hacen igual.
 *
 * size-9 (36 px) y no size-7: es el UNICO acceso a cambiar el estado o eliminar
 * un anime, y 28 px se falla con el dedo. Es el suelo que ya usan ThemeToggle y
 * el engranaje de ListSettings. StatusDot lo acompana con la misma medida.
 */
defineProps<{ actions: MenuAction[] }>()
const emit = defineEmits<{ pick: [id: string] }>()

const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const isOpen = ref(false)

/** Solo los dispositivos con puntero fino abren al pasar por encima. */
const hasHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

function onEnter() {
  if (hasHover()) isOpen.value = true
}

function onLeave() {
  if (hasHover()) isOpen.value = false
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) isOpen.value = false
}

function pick(id: string) {
  emit('pick', id)
  isOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="relative" @pointerenter="onEnter" @pointerleave="onLeave">
    <button
      type="button"
      class="float-pill grid size-9 cursor-pointer place-items-center text-faint transition hover:text-body"
      :aria-label="t('menu.options')"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>

    <!-- pt-1 y no mt-1: con margen quedaria un hueco sin cursor entre boton y
         menu, y al ir hacia el con el raton se cerraria. -->
    <div v-if="isOpen" class="absolute top-full right-0 z-30 w-44 pt-1" role="menu">
      <div class="float-pill overflow-hidden !rounded-2xl p-1">
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          role="menuitem"
          class="block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-xs font-medium transition"
          :class="
            action.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-muted hover:bg-surface-2/70 hover:text-body'
          "
          @click="pick(action.id)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </div>
</template>
