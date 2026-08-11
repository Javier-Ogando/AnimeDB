<script setup lang="ts">
import AnimeCard from './AnimeCard.vue'
import ItemMenu, { type MenuAction } from './ItemMenu.vue'
import StatusDot from './StatusDot.vue'
import type { MediaSummary } from '@/types/anilist'
import type { ItemStatus } from '@/types/models'

const props = withDefaults(
  defineProps<{
    media: MediaSummary[]
    /** Texto cuando no hay nada que mostrar. */
    empty?: string
    /**
     * Modo lista: cada card muestra su estado y el menu de opciones. En el
     * catalogo general se deja en false, porque ahi los animes no pertenecen a
     * ninguna lista del usuario.
     */
    manage?: boolean
  }>(),
  { empty: 'Todavía no hay nada por aquí.', manage: false },
)

const emit = defineEmits<{
  remove: [media: MediaSummary]
  status: [media: MediaSummary, status: ItemStatus]
}>()

/**
 * Las opciones dependen del estado, para no ofrecer lo que no toca:
 *   pendiente  -> Seguir
 *   siguiendo  -> Dejar de seguir · Terminar
 *   terminado  -> Volver a pendiente
 */
function actionsFor(status: ItemStatus): MenuAction[] {
  const actions: MenuAction[] =
    status === 'pending'
      ? [{ id: 'watching', label: 'Seguir' }]
      : status === 'watching'
        ? [
            { id: 'pending', label: 'Dejar de seguir' },
            { id: 'done', label: 'Terminar' },
          ]
        : [{ id: 'pending', label: 'Volver a pendiente' }]

  return [...actions, { id: 'remove', label: 'Eliminar', danger: true }]
}

function onPick(media: MediaSummary, id: string) {
  if (id === 'remove') emit('remove', media)
  else emit('status', media, id as ItemStatus)
}
</script>

<template>
  <!-- Estado vacio con la silueta de una card: comunica que va a haber cards
       aqui, cosa que una frase en un recuadro no hace. -->
  <div
    v-if="!props.media.length"
    class="grid place-items-center rounded-3xl border border-dashed border-line px-6 py-16"
  >
    <div class="flex items-center gap-4 opacity-40" aria-hidden="true">
      <div class="aspect-2/3 h-20 rounded-xl border border-line bg-surface-2/60" />
      <div class="space-y-2">
        <div class="h-2.5 w-32 rounded-full bg-surface-2" />
        <div class="h-2 w-20 rounded-full bg-surface-2/70" />
        <div class="h-2 w-24 rounded-full bg-surface-2/70" />
      </div>
    </div>

    <p class="mt-8 max-w-sm text-center font-display text-lg leading-snug text-balance text-muted">
      {{ props.empty }}
    </p>
  </div>

  <!-- gap-4: los controles sobresalen 8 px de la esquina y con menos hueco
       pisarian la card vecina. -->
  <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <div v-for="item in props.media" :key="item.id" class="relative">
      <AnimeCard :media="item" dense />

      <!-- Fuera de la card a proposito: no es contenido del anime sino acciones
           sobre el, asi que se superponen en la esquina en vez de ocupar una
           columna dentro y estrechar el texto. -->
      <div v-if="props.manage" class="absolute -top-2 -right-2 z-10 flex items-center gap-1.5">
        <StatusDot :status="item.status ?? 'pending'" />
        <ItemMenu
          :actions="actionsFor(item.status ?? 'pending')"
          @pick="(id) => onPick(item, id)"
        />
      </div>
    </div>
  </div>
</template>
