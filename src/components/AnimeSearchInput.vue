<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAnimeSearch } from '@/composables/useAnimeSearch'
import MediaCard from './MediaCard.vue'
import type { MediaSummary } from '@/types/anilist'

const emit = defineEmits<{ select: [media: MediaSummary] }>()

const { term, results, isLoading, error, minLength, reset } = useAnimeSearch()

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const activeIndex = ref(-1)

const hasQuery = computed(() => term.value.trim().length >= minLength)
const showPanel = computed(() => isOpen.value && hasQuery.value)
const listboxId = 'anime-search-listbox'

const activeOptionId = computed(() =>
  activeIndex.value >= 0 && results.value[activeIndex.value]
    ? `anime-option-${results.value[activeIndex.value]!.id}`
    : undefined,
)

watch(results, (list) => {
  activeIndex.value = list.length ? 0 : -1
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
  const id = activeOptionId.value
  if (!id) return
  document.getElementById(id)?.scrollIntoView({ block: 'nearest' })
}

function choose(media: MediaSummary) {
  emit('select', media)
  isOpen.value = false
  reset()
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
        choose(media)
      }
      break
    }
    case 'Escape':
      isOpen.value = false
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
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        :aria-controls="listboxId"
        :aria-expanded="showPanel"
        :aria-activedescendant="activeOptionId"
        placeholder="Busca un anime en AniList…"
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
        aria-label="Limpiar búsqueda"
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
      <p v-if="error" class="px-4 py-3 text-xs text-red-400">{{ error }}</p>

      <p v-else-if="isLoading && !results.length" class="px-4 py-3 text-xs text-muted">
        Buscando en AniList…
      </p>

      <p v-else-if="!results.length" class="px-4 py-3 text-xs text-muted">
        Sin coincidencias para «{{ term.trim() }}».
      </p>

      <ul v-else :id="listboxId" role="listbox" class="max-h-80 overflow-y-auto p-1.5">
        <li
          v-for="(media, index) in results"
          :id="`anime-option-${media.id}`"
          :key="media.id"
          role="option"
          :aria-selected="index === activeIndex"
          class="cursor-pointer rounded-xl px-2.5 py-2 transition-colors"
          :class="index === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2/60'"
          @pointerenter="activeIndex = index"
          @click="choose(media)"
        >
          <MediaCard :media="media" variant="search" />
        </li>
      </ul>
    </div>
  </div>
</template>
