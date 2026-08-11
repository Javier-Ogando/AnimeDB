<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from '@/lib/i18n'
import AnimeCard from './AnimeCard.vue'
import ItemMenu, { type MenuAction } from './ItemMenu.vue'
import ReviewDialog from './ReviewDialog.vue'
import StatusDot from './StatusDot.vue'
import type { MediaSummary } from '@/types/anilist'
import type { ItemStatus } from '@/types/models'

/** Cuantos avatares caben en la esquina antes de resumir en un "+N". */
const MAX_AVATARS = 3

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
    /**
     * Perfiles de los uid que aparecen en `watchedBy`, para poner cara a los
     * avatares. Sin perfil se pinta el circulo de respaldo.
     */
    profiles?: Map<string, { displayName: string | null; photoURL: string | null }>
    /**
     * Listas a las que se puede anadir un anime desde aqui. Vacio (el caso de
     * las vistas de lista, que ya usan `manage`) significa sin menu de alta.
     */
    addTargets?: MenuAction[]
    /** Ids que el usuario ya tiene guardados: a esos no se les ofrece el alta. */
    ownedIds?: Set<number>
  }>(),
  {
    manage: false,
    profiles: () => new Map(),
    addTargets: () => [],
    ownedIds: () => new Set(),
  },
)

const emit = defineEmits<{
  remove: [media: MediaSummary]
  status: [media: MediaSummary, status: ItemStatus]
  add: [media: MediaSummary, targetId: string]
}>()

const { t } = useI18n()

/** El texto del hueco vacio no puede ir en withDefaults: t() no existe todavia. */
const emptyText = computed(() => props.empty || t('card.empty'))

/**
 * Las opciones dependen del estado, para no ofrecer lo que no toca:
 *   pendiente  -> Seguir
 *   siguiendo  -> Dejar de seguir · Terminar
 *   terminado  -> Volver a pendiente · Resenar
 *
 * Resenar solo en terminado: es cuando hay algo que contar, y ahi es la accion
 * natural que sigue a haberlo acabado.
 */
function actionsFor(status: ItemStatus): MenuAction[] {
  const actions: MenuAction[] =
    status === 'pending'
      ? [{ id: 'watching', label: t('card.follow') }]
      : status === 'watching'
        ? [
            { id: 'pending', label: t('card.unfollow') },
            { id: 'done', label: t('card.finish') },
          ]
        : [
            { id: 'pending', label: t('card.backToPending') },
            { id: 'review', label: t('menu.review') },
          ]

  return [...actions, { id: 'remove', label: t('card.remove'), danger: true }]
}

/**
 * El anime que se esta resenando, o null si el dialogo esta cerrado.
 *
 * La resena se resuelve aqui y no se emite a la vista: el punto de "Resenar" es
 * no salir de la lista, asi que quien la muestra no tiene que enterarse.
 */
const reviewTarget = ref<MediaSummary | null>(null)

function onPick(media: MediaSummary, id: string) {
  // Antes de tratar el id como estado: 'review' no es uno, y llegaria a
  // Firestore como estado invalido.
  if (id === 'review') reviewTarget.value = media
  else if (id === 'remove') emit('remove', media)
  else emit('status', media, id as ItemStatus)
}

/** El alta solo se ofrece si hay destinos y el anime no esta ya guardado. */
function canAdd(media: MediaSummary): boolean {
  return props.addTargets.length > 0 && !props.ownedIds.has(media.id)
}

function watchersOf(media: MediaSummary): string[] {
  return media.watchedBy ?? []
}

function nameOf(uid: string): string {
  return props.profiles.get(uid)?.displayName ?? t('common.user')
}

/** Los nombres completos van al aria-label: los avatares solos no dicen quien. */
function watchedByLabel(media: MediaSummary): string {
  return t('card.watchedBy', { names: watchersOf(media).map(nameOf).join(', ') })
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
      {{ emptyText }}
    </p>
  </div>

  <!-- gap-4: los controles sobresalen 8 px de la esquina y con menos hueco
       pisarian la card vecina. -->
  <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <div v-for="item in props.media" :key="item.id" class="relative">
      <!-- La card entera lleva a su ficha. Los controles de la esquina quedan
           fuera de este enlace a proposito: pulsarlos no debe navegar. -->
      <RouterLink
        :to="{ name: 'anime', params: { id: item.id } }"
        class="block transition hover:brightness-110"
      >
        <AnimeCard :media="item" dense />
      </RouterLink>

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

      <!-- En el catalogo general no hay estado que mostrar (el anime no es de
           ninguna lista del usuario), solo el menu para llevarselo a una. -->
      <div v-else-if="canAdd(item)" class="absolute -top-2 -right-2 z-10">
        <ItemMenu :actions="props.addTargets" @pick="(id) => emit('add', item, id)" />
      </div>

      <!-- Quien lo ha visto. Abajo a la derecha, en la esquina opuesta a las
           acciones, para que se lea como informacion y no como un boton. -->
      <div
        v-if="watchersOf(item).length"
        class="absolute -right-2 -bottom-2 z-10 flex items-center"
        role="img"
        :aria-label="watchedByLabel(item)"
        :title="watchedByLabel(item)"
      >
        <template v-for="uid in watchersOf(item).slice(0, MAX_AVATARS)" :key="uid">
          <img
            v-if="props.profiles.get(uid)?.photoURL"
            :src="props.profiles.get(uid)!.photoURL!"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            class="-ml-2 size-6 rounded-full bg-surface-2 ring-1 ring-line first:ml-0"
          />
          <span
            v-else
            class="-ml-2 size-6 rounded-full bg-surface-2 ring-1 ring-line first:ml-0"
            aria-hidden="true"
          />
        </template>

        <span
          v-if="watchersOf(item).length > MAX_AVATARS"
          class="-ml-2 grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-medium text-muted ring-1 ring-line tabular-nums"
          aria-hidden="true"
        >
          +{{ watchersOf(item).length - MAX_AVATARS }}
        </span>
      </div>
    </div>

    <!-- Al body, por dos motivos: dentro de la rejilla el dialogo heredaria el
         contexto de apilamiento del `relative z-0` con el que las vistas
         envuelven la rejilla, y su z-40 no serviria de nada frente a lo que
         venga despues; y fuera de la rejilla no hay riesgo de acabar dentro del
         RouterLink de una card, donde cualquier clic navegaria a la ficha. -->
    <Teleport to="body">
      <ReviewDialog
        v-if="reviewTarget"
        :key="reviewTarget.id"
        :media="reviewTarget"
        @close="reviewTarget = null"
      />
    </Teleport>
  </div>
</template>
