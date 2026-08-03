import type { AniListMedia, MediaSummary } from '@/types/anilist'

const ENDPOINT = 'https://graphql.anilist.co'

/**
 * AniList es GraphQL, no SQL. `search` ya cruza los distintos titulos, y
 * pedimos los tres formatos para poder mostrar el que toque.
 *
 * NO pedimos `relations`. AniList modela cada temporada como una entrada
 * independiente encadenada por SEQUEL/PREQUEL, y contar la cadena desde aqui da
 * numeros falsos: Shingeki no Kyojin encadena siete nodos, asi que cada entrada
 * ve una ventana distinta y devuelve un total distinto (T3/49, T4/59, T5/75
 * para la misma serie). Anidar mas niveles multiplica las aristas de la query y
 * sigue sin cubrir las cadenas largas.
 *
 * El total real de una franquicia se resolvera recorriendo la cadena en el
 * momento de anadir a una lista (una sola vez, cacheado en media/{anilistId}),
 * no en cada pulsacion del teclado.
 */
const SEARCH_QUERY = `
  query Search($search: String!, $perPage: Int!) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
        id
        episodes
        format
        seasonYear
        title {
          romaji
          english
          userPreferred
        }
        coverImage {
          large
          color
        }
      }
    }
  }
`

/** AniList limita las peticiones por minuto; distinguimos este caso del resto. */
export class AniListRateLimitError extends Error {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super('Demasiadas peticiones a AniList.')
    this.name = 'AniListRateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Caché en memoria: teclear "fri" y volver a "fri" no debe costar peticion. */
const cache = new Map<string, MediaSummary[]>()
const CACHE_LIMIT = 60

export async function searchAnime(
  term: string,
  options: { perPage?: number; signal?: AbortSignal } = {},
): Promise<MediaSummary[]> {
  const key = term.trim().toLowerCase()
  if (!key) return []

  const hit = cache.get(key)
  if (hit) return hit

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { search: term, perPage: options.perPage ?? 8 },
    }),
    signal: options.signal,
  })

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 60
    throw new AniListRateLimitError(retryAfter)
  }

  if (!response.ok) {
    throw new Error(`AniList respondio ${response.status}`)
  }

  const payload = (await response.json()) as {
    data?: { Page?: { media?: Array<AniListMedia | null> | null } | null }
    errors?: Array<{ message?: string }>
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? 'Error en la consulta a AniList')
  }

  const results = (payload.data?.Page?.media ?? [])
    .filter((media): media is AniListMedia => media !== null)
    .map(toSummary)

  // Cache con desalojo del mas antiguo: Map conserva orden de insercion.
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, results)

  return results
}

export function toSummary(media: AniListMedia): MediaSummary {
  return {
    id: media.id,
    titlePreferred:
      media.title.userPreferred ?? media.title.romaji ?? media.title.english ?? 'Sin titulo',
    titleEnglish: media.title.english,
    titleRomaji: media.title.romaji,
    coverImage: media.coverImage?.large ?? null,
    coverColor: media.coverImage?.color ?? null,
    format: media.format,
    seasonYear: media.seasonYear,
    episodes: media.episodes,
    // Se rellenan al resolver la franquicia completa (ver nota en SEARCH_QUERY).
    seasons: null,
    totalEpisodes: null,
  }
}
