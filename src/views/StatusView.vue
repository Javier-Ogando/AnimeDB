<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchLastIndexRun, indexWorkflowUrl, type WorkflowRun } from '@/lib/admin'
import { allIndexedMedia, getIndexMeta, type IndexMeta } from '@/lib/animeIndex'
import { scoreToStars, translateGenre } from '@/lib/media'
import BrandMark from '@/components/BrandMark.vue'
import type { MediaSummary } from '@/types/anilist'

const media = ref<MediaSummary[]>([])
const meta = ref<IndexMeta | null>(null)
const isLoading = ref(true)
const loadError = ref(false)

const run = ref<WorkflowRun | null>(null)
const runError = ref<'rate-limit' | 'unavailable' | null>(null)

onMounted(async () => {
  media.value = await allIndexedMedia()
  meta.value = getIndexMeta()
  loadError.value = media.value.length === 0
  isLoading.value = false

  const result = await fetchLastIndexRun()
  if ('error' in result) runError.value = result.error
  else run.value = result.run
})

/** Huecos que conviene vigilar. La card los degrada sola, pero saber cuántos
 *  hay dice si merece la pena regenerar o cambiar la consulta del script. */
const CHECKS = [
  {
    id: 'no-score',
    label: 'Sin valoración',
    hint: 'Estrenos sin votos suficientes en AniList',
    test: (m: MediaSummary) => m.averageScore == null,
  },
  {
    id: 'no-genres',
    label: 'Sin género',
    hint: 'Entradas incompletas en AniList',
    test: (m: MediaSummary) => !(m.genres ?? []).length,
  },
  {
    id: 'no-cover',
    label: 'Sin portada',
    hint: 'Se pintan con el color dominante',
    test: (m: MediaSummary) => !m.coverImage,
  },
  {
    id: 'no-english',
    label: 'Sin título inglés',
    hint: 'Solo se pueden buscar por romaji',
    test: (m: MediaSummary) => !m.titleEnglish,
  },
  {
    id: 'no-episodes',
    label: 'Sin nº de capítulos',
    hint: 'En emisión o sin anunciar',
    test: (m: MediaSummary) => !m.episodes,
  },
] as const

type CheckId = (typeof CHECKS)[number]['id']

const counts = computed(() =>
  Object.fromEntries(
    CHECKS.map((check) => [check.id, media.value.filter(check.test).length]),
  ) as Record<CheckId, number>,
)

const filter = ref<'all' | CheckId>('all')
const search = ref('')
const page = ref(1)
const PER_PAGE = 25

const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const check = CHECKS.find((c) => c.id === filter.value)

  return media.value.filter((m) => {
    if (check && !check.test(m)) return false
    if (!needle) return true
    return [m.titlePreferred, m.titleRomaji, m.titleEnglish, String(m.id)].some((value) =>
      value?.toLowerCase().includes(needle),
    )
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)))
const paged = computed(() => {
  const start = (Math.min(page.value, pageCount.value) - 1) * PER_PAGE
  return filtered.value.slice(start, start + PER_PAGE)
})

function apply(next: 'all' | CheckId) {
  filter.value = next
  page.value = 1
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const generatedLabel = computed(() => {
  const iso = meta.value?.generatedAt
  if (!iso) return '—'

  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'hoy'
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
})

const generatedExact = computed(() =>
  meta.value?.generatedAt ? new Date(meta.value.generatedAt).toLocaleString('es-ES') : '',
)

/** Estado del workflow con texto propio: nunca solo color. */
const runLabel = computed(() => {
  if (runError.value === 'rate-limit') return 'Límite de la API de GitHub alcanzado'
  if (runError.value === 'unavailable') return 'No se ha podido consultar GitHub'
  if (!run.value) return 'Nunca se ha ejecutado'

  const { status, conclusion, createdAt } = run.value
  const when = new Date(createdAt).toLocaleString('es-ES')
  if (status !== 'completed') return `En marcha desde ${when}`
  return conclusion === 'success' ? `Correcta · ${when}` : `${conclusion ?? 'fallida'} · ${when}`
})

const runIsOk = computed(() => run.value?.status === 'completed' && run.value.conclusion === 'success')
</script>

<template>
  <div class="min-h-dvh">
    <header class="relative">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-5">
        <div class="float-pill flex items-baseline gap-3 px-4 py-2">
          <BrandMark class="text-lg" />
          <span class="text-xs tracking-[0.18em] text-faint uppercase">Estado de la app</span>
        </div>

        <RouterLink
          to="/"
          class="float-pill ml-auto px-4 py-2 text-xs font-medium text-muted transition hover:text-body"
        >
          Volver
        </RouterLink>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
      <h1 class="font-display text-3xl tracking-tight">Índice de títulos</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        El archivo estático que permite buscar por subcadena. Se genera desde AniList y se sirve con
        la aplicación.
      </p>

      <p v-if="isLoading" class="mt-8 text-sm text-muted">Cargando el índice…</p>

      <p
        v-else-if="loadError"
        class="mt-8 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted"
      >
        No se ha podido cargar <code>anime-index.json</code>. Genéralo con
        <code class="text-body">npm run build:index</code>.
      </p>

      <template v-else>
        <!-- Cifras del archivo -->
        <div class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-line bg-surface/60 p-4">
            <p class="text-[11px] tracking-[0.16em] text-faint uppercase">Títulos</p>
            <p class="mt-1 font-display text-2xl tabular-nums">
              {{ media.length.toLocaleString('es-ES') }}
            </p>
          </div>
          <div class="rounded-2xl border border-line bg-surface/60 p-4">
            <p class="text-[11px] tracking-[0.16em] text-faint uppercase">Generado</p>
            <p class="mt-1 font-display text-2xl" :title="generatedExact">{{ generatedLabel }}</p>
          </div>
          <div class="rounded-2xl border border-line bg-surface/60 p-4">
            <p class="text-[11px] tracking-[0.16em] text-faint uppercase">Peso</p>
            <p class="mt-1 font-display text-2xl tabular-nums">
              {{ meta ? formatBytes(meta.bytes) : '—' }}
            </p>
          </div>
          <div class="rounded-2xl border border-line bg-surface/60 p-4">
            <p class="text-[11px] tracking-[0.16em] text-faint uppercase">Géneros</p>
            <p class="mt-1 font-display text-2xl tabular-nums">
              {{ meta?.genreTable.length ?? 0 }}
            </p>
          </div>
        </div>

        <!-- Huecos en los datos -->
        <section class="mt-10">
          <h2 class="font-display text-xl tracking-tight">Datos incompletos</h2>
          <div class="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            <button
              v-for="check in CHECKS"
              :key="check.id"
              type="button"
              class="flex w-full cursor-pointer items-center gap-4 bg-surface/60 px-4 py-3 text-left transition hover:bg-surface-2/60"
              :class="filter === check.id ? 'bg-accent/8' : ''"
              @click="apply(filter === check.id ? 'all' : check.id)"
            >
              <span class="w-14 shrink-0 text-right font-display text-lg tabular-nums">
                {{ counts[check.id] }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm text-body">{{ check.label }}</span>
                <span class="block text-xs text-faint">{{ check.hint }}</span>
              </span>
              <span class="shrink-0 text-xs text-accent">
                {{ filter === check.id ? 'Quitar filtro' : 'Ver' }}
              </span>
            </button>
          </div>
        </section>

        <!-- Regeneracion -->
        <section class="mt-10">
          <h2 class="font-display text-xl tracking-tight">Actualizar el índice</h2>
          <div class="mt-4 rounded-2xl border border-line bg-surface/60 p-5">
            <p class="text-sm leading-relaxed text-muted">
              El generador es un script de Node y esta página es estática, así que el navegador no
              puede ejecutarlo. Se lanza desde GitHub Actions —tarda unos tres minutos y son cien
              peticiones a AniList— o en local.
            </p>

            <dl class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <dt class="text-faint">Última ejecución:</dt>
              <dd class="flex items-center gap-2">
                <span
                  class="size-1.5 shrink-0 rounded-full"
                  :class="runIsOk ? 'bg-accent' : 'bg-line-strong'"
                  aria-hidden="true"
                />
                <span class="text-body">{{ runLabel }}</span>
                <a
                  v-if="run"
                  :href="run.htmlUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-accent underline underline-offset-2"
                >
                  #{{ run.runNumber }}
                </a>
              </dd>
            </dl>

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <a
                :href="indexWorkflowUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-full border border-line px-4 py-2 text-xs font-medium text-body transition hover:border-accent/60 hover:bg-accent/10"
              >
                Lanzar en GitHub Actions ↗
              </a>
              <code class="rounded-lg bg-surface-2/70 px-3 py-2 text-xs text-muted">
                npm run build:index
              </code>
            </div>
          </div>
        </section>

        <!-- Listado -->
        <section class="mt-10">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-xl tracking-tight">
              Títulos registrados
              <span class="text-sm font-normal text-faint tabular-nums">
                ({{ filtered.length.toLocaleString('es-ES') }})
              </span>
            </h2>

            <div class="flex items-center gap-2">
              <button
                v-if="filter !== 'all'"
                type="button"
                class="cursor-pointer rounded-full border border-accent/50 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10"
                @click="apply('all')"
              >
                Quitar filtro
              </button>
              <input
                v-model="search"
                type="search"
                placeholder="Filtrar por título o id…"
                class="w-56 rounded-full border border-line bg-surface/70 px-4 py-2 text-sm text-body transition placeholder:text-faint hover:border-line-strong focus:border-accent/60 focus:outline-none"
                @input="page = 1"
              />
            </div>
          </div>

          <div class="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table class="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr class="border-b border-line bg-surface-2/40 text-left">
                  <th class="w-14 px-3 py-2 font-medium text-faint"></th>
                  <th class="px-3 py-2 font-medium text-faint">Título</th>
                  <th class="w-20 px-3 py-2 text-right font-medium text-faint">id</th>
                  <th class="w-20 px-3 py-2 text-right font-medium text-faint">Nota</th>
                  <th class="w-20 px-3 py-2 text-right font-medium text-faint">Caps.</th>
                  <th class="w-64 px-3 py-2 font-medium text-faint">Géneros</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in paged"
                  :key="item.id"
                  class="border-b border-line/60 last:border-0"
                >
                  <td class="px-3 py-2">
                    <div
                      class="aspect-2/3 h-10 overflow-hidden rounded border border-overlay bg-surface-2"
                      :style="
                        item.coverColor
                          ? { background: `linear-gradient(150deg, ${item.coverColor}59, var(--surface-2) 70%)` }
                          : undefined
                      "
                    >
                      <img
                        v-if="item.coverImage"
                        :src="item.coverImage"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        class="size-full object-cover"
                      />
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <span class="block truncate text-body">{{ item.titleRomaji }}</span>
                    <span v-if="item.titleEnglish" class="block truncate text-xs text-faint">
                      {{ item.titleEnglish }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right text-xs text-faint tabular-nums">
                    {{ item.id }}
                  </td>
                  <td class="px-3 py-2 text-right text-muted tabular-nums">
                    {{ scoreToStars(item.averageScore)?.toFixed(2) ?? '—' }}
                  </td>
                  <td class="px-3 py-2 text-right text-muted tabular-nums">
                    {{ item.episodes ?? '—' }}
                  </td>
                  <td class="px-3 py-2 text-xs text-muted">
                    {{ (item.genres ?? []).map(translateGenre).join(', ') || '—' }}
                  </td>
                </tr>

                <tr v-if="!paged.length">
                  <td colspan="6" class="px-4 py-6 text-center text-sm text-muted">
                    Nada que mostrar con este filtro.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="pageCount > 1" class="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              class="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/60 hover:text-body disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="page <= 1"
              @click="page = Math.max(1, page - 1)"
            >
              Anterior
            </button>
            <span class="text-xs text-faint tabular-nums">{{ page }} / {{ pageCount }}</span>
            <button
              type="button"
              class="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/60 hover:text-body disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="page >= pageCount"
              @click="page = Math.min(pageCount, page + 1)"
            >
              Siguiente
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
