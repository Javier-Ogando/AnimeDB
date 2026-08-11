<script setup lang="ts">
export interface MenuAction {
  id: string
  label: string
  /** Acciones destructivas: se pintan en rojo. */
  danger?: boolean
}

/**
 * Boton de tres puntos que despliega acciones al pasar el cursor.
 *
 * Se abre con hover Y con focus-within, para que tambien funcione con teclado.
 * El panel arranca pegado al boton (sin hueco) porque un espacio entre ambos
 * haria que el menu se cerrase al intentar llegar a el con el raton.
 */
defineProps<{ actions: MenuAction[] }>()
defineEmits<{ pick: [id: string] }>()
</script>

<template>
  <div class="group/menu relative">
    <button
      type="button"
      class="float-pill grid size-7 cursor-pointer place-items-center text-faint transition hover:text-body"
      aria-label="Opciones"
      aria-haspopup="menu"
    >
      <svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>

    <div
      class="invisible absolute top-full right-0 z-30 w-44 pt-1 opacity-0 transition-opacity duration-150 group-hover/menu:visible group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:opacity-100"
      role="menu"
    >
      <div class="float-pill overflow-hidden !rounded-2xl p-1">
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          role="menuitem"
          class="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-xs font-medium transition"
          :class="
            action.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-muted hover:bg-surface-2/70 hover:text-body'
          "
          @click="$emit('pick', action.id)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </div>
</template>
