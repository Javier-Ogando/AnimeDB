<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/lib/i18n'
import { translateGenre } from '@/lib/media'

/**
 * Categorias de un anime. Los generos llegan en ingles (canonicos de AniList) y
 * se traducen aqui.
 *
 * `max` es cuantas se pintan; el resto se resume en un chip "+X" que al pasar el
 * cursor —o al recibir el foco— despliega el listado completo, asi que ninguna
 * categoria se pierde por el camino.
 *
 * `singleLine` es cosa de las cards: ahi la fila NO puede envolver (ver el
 * comentario de la plantilla). En la ficha, donde hay ancho de sobra y se pintan
 * hasta seis, envolver es lo correcto y por eso es el comportamiento por
 * defecto.
 */
const props = withDefaults(
  defineProps<{ genres: string[]; max?: number; singleLine?: boolean }>(),
  { max: 3, singleLine: false },
)

const { t } = useI18n()

const labels = computed(() => props.genres.map(translateGenre))
const visible = computed(() => labels.value.slice(0, props.max))
const hidden = computed(() => labels.value.length - visible.value.length)

/*
 * La ventanita flotante es decorativa (aria-hidden): un lector de pantalla no
 * pasa el cursor por encima. Lo que se lee es esta etiqueta del chip "+X", con
 * el mismo titulo que se ve y la lista entera detras.
 */
const allGenresLabel = computed(() => `${t('card.allGenres')}: ${labels.value.join(', ')}`)
</script>

<template>
  <!--
    Con singleLine, flex-nowrap en vez de flex-wrap: con envoltura, un nombre
    largo ("Recuentos de la vida" ocupa lo que dos) saltaba de linea y esa card
    quedaba mas alta que sus vecinas, algo muy visible en la rejilla de cuatro
    columnas.

    La altura no depende de la suerte con los nombres: los chips llevan min-w-0
    + truncate, asi que se recortan en vez de empujar, y el "+X" es shrink-0 para
    seguir legible cuando los de al lado se estrechan. Dos chips y el "+X" caben
    siempre en una linea, por corto o largo que sea el genero.
  -->
  <div
    v-if="labels.length"
    class="flex min-w-0 items-center gap-1"
    :class="singleLine ? 'flex-nowrap' : 'flex-wrap'"
  >
    <span
      v-for="label in visible"
      :key="label"
      class="min-w-0 truncate rounded-full border border-overlay bg-surface-2/80 px-2 py-0.5 text-[9px] tracking-wide text-muted"
    >
      {{ label }}
    </span>

    <!--
      El listado completo se abre con hover Y con focus-within. Solo-hover ya
      fue un fallo en este proyecto (el menu de la card era inservible en
      tactil): sin puntero, el chip se alcanza con el tabulador y ahi el foco es
      lo unico que queda. focus-within cubre los dos casos porque tambien casa
      con el propio elemento enfocado.
    -->
    <span
      v-if="hidden > 0"
      class="group relative shrink-0"
      tabindex="0"
      role="img"
      :aria-label="allGenresLabel"
    >
      <span
        class="block rounded-full border border-overlay bg-surface-2/80 px-2 py-0.5 text-[9px] font-medium tracking-wide text-muted tabular-nums"
      >
        +{{ hidden }}
      </span>

      <!--
        pt-1 y no mt-1: con margen quedaria una franja sin cursor entre el chip
        y la ventanita, y al ir hacia ella con el raton se cerraria.
        z-30 la deja por encima de las cards vecinas, y por debajo de los avisos.
      -->
      <span
        class="absolute top-full left-0 z-30 hidden w-44 max-w-[70vw] pt-1 group-hover:block group-focus-within:block"
        aria-hidden="true"
      >
        <span class="float-pill block !rounded-2xl p-2.5">
          <span class="block text-[9px] tracking-[0.18em] text-faint uppercase">
            {{ t('card.allGenres') }}
          </span>
          <!-- Aqui si se envuelve: la ventanita flota, su alto no afecta a la card. -->
          <span class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="label in labels"
              :key="`all-${label}`"
              class="rounded-full border border-overlay bg-surface-2/80 px-2 py-0.5 text-[9px] tracking-wide text-muted"
            >
              {{ label }}
            </span>
          </span>
        </span>
      </span>
    </span>
  </div>
</template>
