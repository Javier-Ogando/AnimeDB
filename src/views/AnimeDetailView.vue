<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { fetchMediaById } from '@/lib/anilist'
import { useI18n } from '@/lib/i18n'
import { fetchUserProfiles } from '@/lib/lists'
import { scoreToStars } from '@/lib/media'
import { communityScore, getMyReview, saveReview, watchReviews, type Review } from '@/lib/reviews'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AppHeader from '@/components/AppHeader.vue'
import GenreChips from '@/components/GenreChips.vue'
import MediaCover from '@/components/MediaCover.vue'
import MediaStats from '@/components/MediaStats.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import ReviewThread from '@/components/ReviewThread.vue'
import StarRating from '@/components/StarRating.vue'
import type { MediaSummary } from '@/types/anilist'

/**
 * Ficha de un anime: datos de AniList, la valoracion de la comunidad de AnimeDB
 * y las resenas.
 *
 * Los datos se piden a AniList y no a Firestore, para que funcione tambien con
 * animes que nadie ha guardado todavia. De Firestore sale solo lo nuestro: el
 * agregado y las resenas.
 */
const route = useRoute()
const { user } = useAuth()
const { notify } = useToast()
const { t } = useI18n()

const mediaId = computed(() => Number(route.params.id))

const media = ref<MediaSummary | null>(null)
const isLoading = ref(true)

const reviews = ref<Review[]>([])
const profiles = ref(new Map<string, { displayName: string | null; photoURL: string | null }>())
const aggregate = ref<{ sum?: number; count?: number }>({})

const myScore = ref(4)
const myComment = ref('')
const isSaving = ref(false)

/**
 * Solo se admite UNA resena por persona (el uid es el ID del documento), asi que
 * una vez has puntuado el formulario se recoge: dejarlo abierto sugiere que
 * puedes poner otra. Se reabre con "Editar valoracion".
 */
const hasRated = ref(false)
const isEditing = ref(false)
const showForm = computed(() => !hasRated.value || isEditing.value)

let unsubscribe: (() => void) | null = null

const appScore = computed(() => communityScore(aggregate.value.sum, aggregate.value.count))
const anilistScore = computed(() => scoreToStars(media.value?.averageScore))

async function load() {
  isLoading.value = true
  unsubscribe?.()

  try {
    await loadInner()
  } finally {
    // En finally y no al final del cuerpo: cualquier fallo dejaba la pantalla
    // colgada en el estado de carga.
    isLoading.value = false
  }
}

async function loadInner() {
  const id = mediaId.value
  media.value = await fetchMediaById(id)

  // El agregado vive en media/{id}; si nadie lo ha guardado aun, no existe.
  try {
    const snap = await getDoc(doc(db, 'media', String(id)))
    const data = snap.data() as { scoreSum?: number; scoreCount?: number } | undefined
    aggregate.value = { sum: data?.scoreSum, count: data?.scoreCount }
  } catch {
    aggregate.value = {}
  }

  /*
   * En su propio try/catch: tu resena es dato OPCIONAL. Antes, si esta lectura
   * fallaba (permission-denied, red), load() rechazaba, isLoading se quedaba en
   * true para siempre y la pantalla se quedaba en "Cargando la ficha..." sin
   * decir nada, porque el `void load()` se comia el rechazo.
   */
  if (user.value) {
    try {
      const mine = await getMyReview(id, user.value.uid)
      if (mine) {
        myScore.value = mine.score
        myComment.value = mine.comment
        hasRated.value = true
      }
    } catch {
      hasRated.value = false
    }
  }

  unsubscribe = watchReviews(
    id,
    async (next) => {
      reviews.value = next
      profiles.value = await fetchUserProfiles(next.map((review) => review.uid))
    },
    () => notify(t('detail.reviewsError'), 'error'),
  )
}

void load()
watch(mediaId, () => void load())
onUnmounted(() => unsubscribe?.())

async function onSave() {
  if (!user.value || isSaving.value) return

  isSaving.value = true
  try {
    await saveReview(mediaId.value, user.value.uid, myScore.value, myComment.value)
    // El agregado se relee: la suscripcion cubre las resenas, no el documento.
    const snap = await getDoc(doc(db, 'media', String(mediaId.value)))
    const data = snap.data() as { scoreSum?: number; scoreCount?: number } | undefined
    aggregate.value = { sum: data?.scoreSum, count: data?.scoreCount }
    hasRated.value = true
    isEditing.value = false
    notify(t('detail.saved'))
  } catch (e) {
    notify(
      (e as Error).message.includes('permission')
        ? t('detail.savePermission')
        : t('detail.saveError'),
      'error',
    )
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-4xl px-6 pt-10 pb-28">
      <p v-if="isLoading" class="text-sm text-muted">{{ t('detail.loading') }}</p>

      <p v-else-if="!media" class="text-sm text-muted">
        {{ t('detail.notFound') }}
      </p>

      <template v-else>
        <!-- ── Ficha ──────────────────────────────────────────────────── -->
        <div class="flex flex-col gap-6 sm:flex-row">
          <MediaCover
            :src="media.coverImage"
            :color="media.coverColor"
            class="aspect-2/3 w-40 shrink-0 self-start rounded-2xl sm:w-52"
          />

          <div class="min-w-0 flex-1">
            <h1 class="font-display text-3xl leading-tight tracking-tight text-balance">
              {{ media.titleRomaji ?? media.titlePreferred }}
            </h1>
            <p
              v-if="media.titleEnglish && media.titleEnglish !== media.titleRomaji"
              class="mt-1 text-sm text-muted"
            >
              {{ media.titleEnglish }}
            </p>

            <GenreChips :genres="media.genres ?? []" :max="6" class="mt-4" />

            <MediaStats :stats="media.stats ?? null" class="mt-4" />

            <!-- Las dos valoraciones, una al lado de la otra: es el sentido de
                 tener resenas propias ademas de las de AniList. -->
            <dl class="mt-6 grid gap-4 sm:grid-cols-2">
              <div class="rounded-2xl border border-line bg-surface/60 p-4">
                <dt class="text-[10px] tracking-[0.2em] text-faint uppercase">AniList</dt>
                <dd class="mt-2 flex items-center gap-2">
                  <StarRating v-if="anilistScore != null" :value="anilistScore" size="md" />
                  <span class="text-sm text-muted tabular-nums">
                    {{ anilistScore != null ? anilistScore.toFixed(2) : 'N/A' }}
                  </span>
                </dd>
              </div>

              <div class="rounded-2xl border border-line bg-surface/60 p-4">
                <dt class="text-[10px] tracking-[0.2em] text-accent/70 uppercase">AnimeDB</dt>
                <dd class="mt-2 flex items-center gap-2">
                  <StarRating v-if="appScore != null" :value="appScore" size="md" />
                  <span class="text-sm text-muted tabular-nums">
                    {{ appScore != null ? appScore.toFixed(2) : t('detail.noVotes') }}
                  </span>
                  <span v-if="aggregate.count" class="text-xs text-faint tabular-nums">
                    ({{ aggregate.count }})
                  </span>
                </dd>
              </div>
            </dl>

            <p class="mt-6 text-sm leading-relaxed text-muted">
              {{ media.description ?? t('detail.noSynopsis') }}
            </p>
          </div>
        </div>

        <!-- ── Tu valoracion ──────────────────────────────────────────── -->
        <section class="mt-12">
          <h2 class="font-display text-xl tracking-tight">{{ t('detail.myRating') }}</h2>

          <!-- Ya puntuado y sin editar: se muestra lo guardado, no el formulario. -->
          <div
            v-if="!showForm"
            class="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface/60 p-4"
          >
            <StarRating :value="myScore" size="md" />
            <span class="text-sm text-muted tabular-nums">{{ myScore }}</span>
            <p class="min-w-0 flex-1 text-xs leading-relaxed text-faint">
              {{ t('detail.ratingSavedHint') }}
            </p>
            <button
              type="button"
              class="shrink-0 cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-medium text-muted transition hover:border-accent/60 hover:text-body"
              @click="isEditing = true"
            >
              {{ t('detail.editRating') }}
            </button>
          </div>

          <div v-else class="mt-4 rounded-2xl border border-line bg-surface/60 p-4">
            <div class="flex flex-wrap items-center gap-3">
              <label class="text-xs text-faint" for="score">{{ t('detail.score') }}</label>
              <input
                id="score"
                v-model.number="myScore"
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                class="h-1.5 flex-1 cursor-pointer accent-accent"
              />
              <StarRating :value="myScore" size="md" />
              <span class="w-8 text-right text-sm text-muted tabular-nums">{{ myScore }}</span>
            </div>

            <textarea
              v-model="myComment"
              rows="3"
              maxlength="2000"
              :placeholder="t('detail.commentPlaceholder')"
              class="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />

            <div class="mt-3 flex items-center justify-between gap-3">
              <span class="text-[11px] text-faint tabular-nums">
                {{ myComment.length }}/2000
              </span>
              <button
                type="button"
                :disabled="isSaving"
                class="cursor-pointer rounded-full border border-accent/50 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                @click="onSave"
              >
                {{ isSaving ? t('detail.saving') : t('detail.saveRating') }}
              </button>
            </div>
          </div>
        </section>

        <!-- ── Resenas ────────────────────────────────────────────────── -->
        <section class="mt-10">
          <h2 class="font-display text-xl tracking-tight">
            {{ t('detail.reviews') }}
            <span class="text-sm font-normal text-faint tabular-nums">({{ reviews.length }})</span>
          </h2>

          <p
            v-if="!reviews.length"
            class="mt-4 rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted"
          >
            {{ t('detail.reviewsEmpty') }}
          </p>

          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="review in reviews"
              :key="review.id"
              class="rounded-2xl border border-line bg-surface/60 p-4"
            >
              <div class="flex items-center gap-3">
                <img
                  v-if="profiles.get(review.uid)?.photoURL"
                  :src="profiles.get(review.uid)!.photoURL!"
                  alt=""
                  class="size-8 shrink-0 rounded-full ring-1 ring-line"
                  referrerpolicy="no-referrer"
                />
                <span v-else class="size-8 shrink-0 rounded-full bg-surface-2" aria-hidden="true" />

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-body">
                    {{ profiles.get(review.uid)?.displayName ?? t('common.user') }}
                    <span v-if="review.uid === user?.uid" class="text-faint">
                      {{ t('common.you') }}
                    </span>
                  </p>
                </div>

                <StarRating :value="review.score" />
              </div>

              <p v-if="review.comment" class="mt-3 text-sm leading-relaxed text-muted">
                {{ review.comment }}
              </p>

              <!-- Reacciones e hilo: cada uno se suscribe a su propia
                   subcoleccion de la resena, asi que se pintan aqui y la vista
                   no tiene que saber nada de ellos. -->
              <!-- review.id, no review.uid: el ID del documento es lo que forma
                   la ruta de las subcolecciones. Son el mismo valor, pero el que
                   manda es el ID. -->
              <ReactionBar :media-id="mediaId" :review-uid="review.id" class="mt-3" />
              <ReviewThread :media-id="mediaId" :review-uid="review.id" />
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
