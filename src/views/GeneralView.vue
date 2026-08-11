<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/lib/i18n'
import {
  addAnimeToList,
  ensurePersonalList,
  fetchMyLibrary,
  fetchRegisteredMedia,
  fetchUserProfiles,
} from '@/lib/lists'
import { translateGenre } from '@/lib/media'
import AnimeGrid from '@/components/AnimeGrid.vue'
import AnimeSearchInput from '@/components/AnimeSearchInput.vue'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { MenuAction } from '@/components/ItemMenu.vue'
import type { MediaSummary } from '@/types/anilist'
import type { ListWithId } from '@/lib/lists'

/**
 * Catalogo general: todo lo que alguien ha registrado en la aplicacion.
 *
 * Sale de la coleccion `media`, que se rellena en cada alta a cualquier lista,
 * asi que ya es el registro global sin necesidad de duplicar nada.
 */
const { user } = useAuth()
const { notify } = useToast()
const { t } = useI18n()

/** Id ficticio del destino "Pendientes": la lista personal puede no existir aun. */
const PERSONAL_TARGET = '__personal__'

const media = ref<MediaSummary[]>([])
const profiles = ref(new Map<string, { displayName: string | null; photoURL: string | null }>())
const sharedLists = ref<ListWithId[]>([])
const ownedIds = ref(new Set<number>())
const isLoading = ref(true)
const error = ref<string | null>(null)
/** Genero canonico (en ingles) por el que se filtra; null es "Todas". */
const genreFilter = ref<string | null>(null)

/**
 * Los destinos del menu de las cards. El buscador recibe esta misma lista: son
 * los mismos sitios a los que se puede llevar un anime, y mantener dos arrays
 * en paralelo solo garantiza que uno se quede atras.
 */
const addTargets = computed<MenuAction[]>(() => [
  { id: PERSONAL_TARGET, label: t('nav.pending') },
  ...sharedLists.value.map((list) => ({ id: list.id, label: list.name })),
])

/**
 * Las categorias salen de lo cargado, no de la lista cerrada de AniList: asi
 * ninguna opcion del filtro puede acabar en cero resultados.
 *
 * Se ordenan por la etiqueta traducida porque es la que se lee en pantalla; el
 * orden alfabetico en ingles se veria arbitrario en castellano.
 */
const genres = computed(() => {
  const present = new Set<string>()
  for (const item of media.value) {
    for (const genre of item.genres ?? []) present.add(genre)
  }

  return [...present].sort((a, b) => translateGenre(a).localeCompare(translateGenre(b)))
})

/** Las pastillas del filtro: "Todas" (id null, no filtra) y un genero por opcion. */
const genreOptions = computed<Array<{ id: string | null; label: string }>>(() => [
  { id: null, label: t('general.filterAll') },
  ...genres.value.map((genre) => ({ id: genre, label: translateGenre(genre) })),
])

/** Filtrado en cliente: el catalogo ya esta en memoria, no hace falta releerlo. */
const visibleMedia = computed(() => {
  const genre = genreFilter.value
  if (!genre) return media.value
  return media.value.filter((item) => item.genres?.includes(genre) ?? false)
})

async function load() {
  try {
    media.value = await fetchRegisteredMedia()
  } catch (e) {
    error.value = (e as Error).message.includes('permission')
      ? t('error.permissionRead')
      : t('general.loadError')
    isLoading.value = false
    return
  }

  isLoading.value = false

  // Los avatares y el menu son adornos del catalogo: si fallan, la rejilla ya
  // esta en pantalla y no merece el mensaje de error de la carga principal.
  try {
    const uid = user.value?.uid
    const [loadedProfiles, library] = await Promise.all([
      fetchUserProfiles(media.value.flatMap((item) => item.watchedBy ?? [])),
      uid ? fetchMyLibrary(uid) : null,
    ])

    profiles.value = loadedProfiles
    if (library) {
      sharedLists.value = library.lists.filter((list) => list.type === 'shared')
      ownedIds.value = library.mediaIds
    }
  } catch (e) {
    console.warn('[AnimeDB] No se han podido cargar los perfiles ni tus listas:', e)
  }
}

void load()

async function onAdd(item: MediaSummary, targetId: string) {
  const uid = user.value?.uid
  if (!uid) return

  const target = addTargets.value.find((action) => action.id === targetId)

  try {
    const listId = targetId === PERSONAL_TARGET ? await ensurePersonalList(uid) : targetId
    await addAnimeToList(listId, item, uid)

    // El id se apunta en cliente: el menu desaparece sin volver a leer nada.
    ownedIds.value = new Set(ownedIds.value).add(item.id)
    notify(t('general.added', { target: target?.label ?? t('general.defaultTarget') }))
  } catch (e) {
    console.error('[AnimeDB] Fallo el alta desde el catálogo general:', e)
    notify(t('general.addError'), 'error')
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 pt-10 pb-28">
      <!-- La cifra cuenta lo que se ve: con filtro puesto, el total enganaria. -->
      <PageHeader
        :kicker="t('general.kicker')"
        :count="visibleMedia.length"
        :unit="[t('unit.titleOne'), t('unit.titleMany')]"
      />

      <!-- Aqui tambien se puede dar de alta: antes habia que volver a la portada
           solo para anadir un anime que ya estabas viendo en el catalogo. -->
      <div class="mt-6 flex">
        <AnimeSearchInput :destinations="addTargets" @select="onAdd" />
      </div>

      <p
        v-if="error"
        role="alert"
        class="relative z-0 mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted"
      >
        {{ error }}
      </p>

      <!-- Pastillas y no un desplegable: son pocas y se ve de un vistazo cual
           esta activa. Solo aparecen si hay generos que ofrecer. -->
      <div
        v-if="genres.length"
        class="relative z-0 mt-6 flex flex-wrap gap-2"
        role="group"
        :aria-label="t('general.filterLabel')"
      >
        <button
          v-for="option in genreOptions"
          :key="option.id ?? '__all__'"
          type="button"
          :aria-pressed="genreFilter === option.id"
          class="cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition"
          :class="
            genreFilter === option.id
              ? 'border-accent/50 bg-accent/12 text-body'
              : 'border-line text-muted hover:bg-surface-2/60 hover:text-body'
          "
          @click="genreFilter = option.id"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- z-0 explicito: el desplegable del buscador debe quedar por encima. -->
      <div class="relative z-0 mt-8">
        <p v-if="isLoading" class="text-sm text-muted">{{ t('common.loading') }}</p>
        <AnimeGrid
          v-else
          :media="visibleMedia"
          :profiles="profiles"
          :add-targets="addTargets"
          :owned-ids="ownedIds"
          :empty="genreFilter ? t('general.noMatches') : t('general.empty')"
          @add="onAdd"
        />
      </div>
    </main>
  </div>
</template>
