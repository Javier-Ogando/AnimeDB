<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAnimeSearch } from '@/composables/useAnimeSearch'
import { useI18n } from '@/lib/i18n'
import AnimeRow from './AnimeRow.vue'
import type { MediaSummary } from '@/types/anilist'

/** Destino al que puede ir un anime: una lista concreta. */
export interface SearchDestination {
  id: string
  label: string
}

/** Se emite al elegir destino. Todavia sin implementar el guardado. */
const props = withDefaults(
  defineProps<{
    /**
     * Listas a las que se puede anadir. Con una sola (o ninguna) el boton dice
     * "Anadir"; con varias, se muestra una por lista.
     */
    destinations?: SearchDestination[]
  }>(),
  { destinations: () => [] },
)

const emit = defineEmits<{ select: [media: MediaSummary, destinationId: string] }>()

const { term, results, isLoading, error, minLength, reset } = useAnimeSearch()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
/** Fila resaltada por teclado (no implica seleccion). */
const activeIndex = ref(-1)
/** Fila marcada al pulsar, la que despliega los destinos. */
const selectedId = ref<number | null>(null)

const hasQuery = computed(() => term.value.trim().length >= minLength)
const showPanel = computed(() => isOpen.value && hasQuery.value)

const targets = computed<SearchDestination[]>(() =>
  props.destinations.length ? props.destinations : [{ id: '', label: t('search.add') }],
)

watch(results, (list) => {
  activeIndex.value = list.length ? 0 : -1
  // Una busqueda nueva invalida lo que hubiera marcado.
  selectedId.value = null
})

watch(term, () => {
  if (hasQuery.value) isOpen.value = true
})

function move(step: number) {
  if (!results.value.length) return
  isOpen.value = true
  const total = results.value.length
  activeIndex.value = (activeIndex.value + step + total) % total
  void scrollActiveIntoView()
}

async function scrollActiveIntoView() {
  await nextTick()
  const media = results.value[activeIndex.value]
  if (!media) return
  document.getElementById(`anime-row-${media.id}`)?.scrollIntoView({ block: 'nearest' })
}

/** Marcar y desmarcar: volver a pulsar la fila cierra los destinos. */
function toggle(media: MediaSummary) {
  selectedId.value = selectedId.value === media.id ? null : media.id
}

function pick(media: MediaSummary, destinationId: string) {
  emit('select', media, destinationId)
  selectedId.value = null
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Enter': {
      const media = results.value[activeIndex.value]
      if (showPanel.value && media) {
        event.preventDefault()
        toggle(media)
      }
      break
    }
    case 'Escape':
      // Primero cierra los destinos; si no hay ninguno abierto, cierra el panel.
      if (selectedId.value !== null) selectedId.value = null
      else isOpen.value = false
      break
  }
}

// Cerrar al pulsar fuera. pointerdown y no click: se cierra antes de que el
// navegador mueva el foco, que da menos parpadeo.
function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) isOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <!-- z-30 sobre las cards de abajo (z-0) para que el desplegable las tape. -->
  <div ref="root" class="relative z-30 w-full max-w-xl">
    <div class="relative">
      <svg
        class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>

      <input
        ref="input"
        v-model="term"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :aria-label="t('search.ariaLabel')"
        :placeholder="t('search.placeholder')"
        class="w-full rounded-full border border-line bg-surface/70 py-3 pr-11 pl-11 text-sm text-body transition placeholder:text-faint hover:border-line-strong focus:border-accent/60 focus:outline-none"
        @focus="isOpen = true"
        @keydown="onKeydown"
      />

      <!-- Spinner mientras se consulta; boton de limpiar cuando ya hay texto. -->
      <span
        v-if="isLoading"
        class="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line-strong border-t-accent"
        aria-hidden="true"
      />
      <button
        v-else-if="term"
        type="button"
        class="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-faint transition hover:bg-surface-2 hover:text-body"
        :aria-label="t('search.clear')"
        @click="reset(), input?.focus()"
      >
        <svg
          class="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Desplegable de coincidencias -->
    <div
      v-if="showPanel"
      class="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-2xl shadow-shade backdrop-blur-md"
    >
      <p class="sr-only" aria-live="polite">
        {{ t('search.results', { count: results.length, term: term.trim() }) }}
      </p>

      <p v-if="error" class="px-4 py-3 text-xs text-red-400">{{ error }}</p>

      <p v-else-if="isLoading && !results.length" class="px-4 py-3 text-xs text-muted">
        {{ t('search.searching') }}
      </p>

      <p v-else-if="!results.length" class="px-4 py-3 text-xs text-muted">
        {{ t('search.noMatches', { term: term.trim() }) }}
      </p>

      <ul v-else class="max-h-96 overflow-y-auto p-1.5">
        <li v-for="(media, index) in results" :key="media.id">
          <!-- La fila es un boton de verdad, no un role="option": las opciones
               de un listbox no pueden contener controles, y aqui despliegan
               dos botones de destino. -->
          <button
            :id="`anime-row-${media.id}`"
            type="button"
            :aria-pressed="selectedId === media.id"
            class="w-full cursor-pointer rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            :class="[
              selectedId === media.id
                ? 'bg-accent/12 ring-1 ring-accent/45'
                : index === activeIndex
                  ? 'bg-surface-2'
                  : 'hover:bg-surface-2/60',
            ]"
            @click="toggle(media)"
            @pointerenter="activeIndex = index"
          >
            <AnimeRow :media="media" />
          </button>

          <!-- Destino: aparece solo en la fila marcada. -->
          <div
            v-if="selectedId === media.id"
            class="rise flex flex-wrap items-center gap-2 px-2.5 pt-1 pb-3"
          >
            <span class="text-[11px] tracking-wide text-faint">{{ t('search.saveTo') }}</span>
            <button
              v-for="destination in targets"
              :key="destination.id"
              type="button"
              class="cursor-pointer rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:border-accent/60 hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              @click="pick(media, destination.id)"
            >
              {{ destination.label }}
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
