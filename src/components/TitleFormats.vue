<script setup lang="ts">
import { computed } from 'vue'
import type { MediaSummary } from '@/types/anilist'

/**
 * Los tres formatos de titulo de AniList. Es el cuerpo de la card en el login:
 * explica de un vistazo que se puede buscar por cualquiera de los tres.
 */
const props = defineProps<{ media: MediaSummary }>()

/**
 * Se muestran los tres SIN deduplicar, aunque coincidan entre si: en la mayoria
 * de titulos romaji y preferred son la misma cadena, y ocultar la repetida haria
 * desaparecer una fila justo en la card que existe para ensenar que hay tres
 * formatos. Solo se omite lo que AniList no trae.
 */
const formats = computed(() =>
  [
    { label: 'Romaji', value: props.media.titleRomaji },
    { label: 'English', value: props.media.titleEnglish },
    { label: 'Preferred', value: props.media.titlePreferred },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value)),
)
</script>

<template>
  <dl class="space-y-2">
    <div v-for="format in formats" :key="format.label">
      <dt class="text-[9px] font-medium tracking-[0.16em] text-accent/70 uppercase">
        {{ format.label }}
      </dt>
      <dd class="text-[12px] leading-snug text-muted">{{ format.value }}</dd>
    </div>
  </dl>
</template>
