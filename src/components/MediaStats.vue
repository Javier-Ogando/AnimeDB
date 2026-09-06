<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/lib/i18n'
import type { AnimeStats } from '@/lib/tagStats'

/**
 * Los 5 coeficientes narrativos (accion, drama, misterio, ritmo, profundidad)
 * calculados por computeAnimeStats a partir de generos y tags de AniList; ver
 * lib/tagStats.js para el detalle de la heuristica y sus limites.
 *
 * `dense` es la version compacta del buscador: una tira horizontal con las 5
 * etiquetas completas repartidas a lo ancho de la fila, cada una con su barra
 * debajo. Sin `dense` se pinta la version de la ficha: una lista vertical con
 * nombre completo y valor.
 */
const props = withDefaults(defineProps<{ stats: AnimeStats | null; dense?: boolean }>(), {
  dense: false,
})

const { t } = useI18n()

const AXIS_KEYS = ['action', 'drama', 'mystery', 'pacing', 'depth'] as const

const rows = computed(() => {
  if (!props.stats) return []
  const stats = props.stats
  return AXIS_KEYS.map((key) => ({ key, label: t(`stats.${key}`), value: stats[key] }))
})
</script>

<template>
  <div
    v-if="rows.length"
    class="flex min-w-0"
    :class="dense ? 'w-full items-start justify-between gap-2' : 'flex-col gap-1.5'"
    role="group"
    :aria-label="t('stats.title')"
  >
    <div
      v-for="row in rows"
      :key="row.key"
      class="flex min-w-0"
      :class="dense ? 'flex-1 flex-col items-center gap-0.5' : 'items-center gap-2'"
    >
      <span
        v-if="dense"
        class="text-[8px] leading-none font-medium tracking-wide text-faint uppercase"
      >
        {{ row.label }}
      </span>
      <span v-else class="w-24 shrink-0 text-[10px] tracking-wide text-muted">
        {{ row.label }}
      </span>

      <span
        class="block overflow-hidden rounded-full bg-surface-2/80"
        :class="dense ? 'h-1 w-full' : 'h-1.5 flex-1 shrink-0'"
        role="img"
        :aria-label="t('stats.valueAria', { label: row.label, value: row.value })"
      >
        <span
          class="block h-full rounded-full bg-accent/70"
          :style="{ width: `${row.value * 10}%` }"
        />
      </span>

      <span v-if="!dense" class="w-4 shrink-0 text-right text-[10px] text-faint tabular-nums">
        {{ row.value }}
      </span>
    </div>
  </div>
</template>
