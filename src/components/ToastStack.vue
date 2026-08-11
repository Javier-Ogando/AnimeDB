<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/lib/i18n'

/**
 * Pila de avisos temporales, abajo a la derecha.
 *
 * Deja libre la esquina inferior izquierda, que es donde vive el conmutador de
 * tema: de ahi el left-20 en movil, donde el aviso ocupa casi todo el ancho.
 */
const { toasts, dismiss } = useToast()
const { t } = useI18n()
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 left-20 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-88"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition duration-200 ease-in absolute"
      leave-to-class="translate-y-1 opacity-0"
      move-class="transition duration-200"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="float-pill pointer-events-auto flex w-full items-start gap-3 px-4 py-3"
      >
        <!-- Icono ademas del color: el estado no debe depender solo del tono. -->
        <svg
          v-if="toast.tone === 'success'"
          class="mt-0.5 size-4 shrink-0 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m4 12.5 5 5L20 6.5" />
        </svg>
        <svg
          v-else
          class="mt-0.5 size-4 shrink-0 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 8v5M12 16.5v.5" />
          <circle cx="12" cy="12" r="9" />
        </svg>

        <p class="min-w-0 flex-1 text-xs leading-relaxed text-body">{{ toast.message }}</p>

        <button
          type="button"
          class="-mr-1 shrink-0 cursor-pointer rounded-full p-1 text-faint transition hover:text-body"
          :aria-label="t('common.dismiss')"
          @click="dismiss(toast.id)"
        >
          <svg
            class="size-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
