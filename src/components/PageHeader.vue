<script setup lang="ts">
/**
 * Encabezado de una pantalla, deliberadamente minimo: rotulo en versalitas y un
 * filete corto. Sin titular grande ni parrafo de apoyo, que se comian una
 * pantalla de alto sin aportar nada que la navegacion no diga ya.
 */
defineProps<{
  /** Rotulo pequeno que identifica la pantalla. */
  kicker: string
  /** Cifra destacada (titulos de la lista, miembros...). */
  count?: number | null
  /** Que cuenta esa cifra, en singular y plural. */
  unit?: [string, string]
}>()
</script>

<template>
  <header class="relative">
    <div class="flex items-center justify-between gap-6">
      <p class="text-[11px] font-medium tracking-[0.3em] text-accent/70 uppercase">
        {{ kicker }}
      </p>

      <!-- La cifra en un cuerpo contenido: con el titular fuera, un numeral
           enorme seria lo unico alto del bloque y no habriamos ganado espacio. -->
      <p
        v-if="count != null"
        class="shrink-0 font-display text-2xl leading-none text-line-strong tabular-nums"
      >
        {{ count }}
        <span v-if="unit" class="text-[10px] tracking-[0.2em] text-faint uppercase">
          {{ count === 1 ? unit[0] : unit[1] }}
        </span>
      </p>
    </div>

    <!-- Filete corto: cierra el bloque sin la pesadez de una linea entera. -->
    <div class="mt-3 h-px w-14 bg-accent/50" aria-hidden="true" />

    <slot />
  </header>
</template>
