import type { AniListChainMedia, AniListMedia, FranchiseChain, MediaSummary } from '@/types/anilist'

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
 *
 * Se filtra por genero y no con isAdult: false. isAdult marca como adulto
 * cualquier cosa subida de tono, incluido el ecchi corriente, y dejaba fuera del
 * catalogo titulos como "Isekai Meikyuu de Harem wo" (Drama/Ecchi/Fantasy).
 * genre_not_in excluye el hentai de verdad y deja pasar el resto.
 */
const SEARCH_QUERY = `
  query Search($search: String!, $perPage: Int!, $isAdult: Boolean) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, genre_not_in: ["Hentai"], isAdult: $isAdult) {
        id
        episodes
        format
        seasonYear
        averageScore
        genres
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

/**
 * Sinopsis de un titulo concreto.
 *
 * No va en el indice local a proposito: 5000 descripciones son varios MB, y esto
 * solo se necesita al dar de alta un anime, que es una accion puntual.
 */
const DETAIL_QUERY = `
  query Detail($id: Int!) {
    Media(id: $id, type: ANIME) {
      description(asHtml: false)
    }
  }
`

/** Longitud maxima que se guarda: la card muestra cuatro lineas. */
const DESCRIPTION_LIMIT = 500

function toPlainText(value: string | null): string | null {
  if (!value) return null

  const text = value
    // AniList cuela etiquetas incluso con asHtml: false.
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null
  return text.length > DESCRIPTION_LIMIT ? `${text.slice(0, DESCRIPTION_LIMIT).trimEnd()}…` : text
}

/** Ficha completa de un anime, para la pantalla de detalle. */
const FULL_QUERY = `
  query Full($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      episodes
      format
      seasonYear
      averageScore
      genres
      title { romaji english userPreferred }
      coverImage { large color }
      description(asHtml: false)
    }
  }
`

export async function fetchMediaById(id: number): Promise<MediaSummary | null> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: FULL_QUERY, variables: { id } }),
    })
    if (!response.ok) return null

    const payload = (await response.json()) as {
      data?: { Media?: (AniListMedia & { description?: string | null }) | null }
    }
    const media = payload.data?.Media
    if (!media) return null

    return { ...toSummary(media), description: toPlainText(media.description ?? null) }
  } catch {
    return null
  }
}

/** Devuelve null si falla: una sinopsis ausente no debe impedir el alta. */
export async function fetchDescription(id: number): Promise<string | null> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }),
    })
    if (!response.ok) return null

    const payload = (await response.json()) as {
      data?: { Media?: { description?: string | null } | null }
    }
    return toPlainText(payload.data?.Media?.description ?? null)
  } catch {
    return null
  }
}

/* ---------- temporadas de una franquicia ---------- */

/**
 * Por que esto vive aqui y se llama en el alta y no en el buscador: ver la nota
 * de SEARCH_QUERY. AniList guarda cada temporada como una ENTRADA
 * independiente, y ninguna conoce la cadena entera —solo a su vecino anterior y
 * al siguiente—, asi que el total real exige saltar de nodo en nodo. Eso son
 * varias peticiones, imposible con cada pulsacion del teclado pero asumible una
 * sola vez al dar de alta, guardando el resultado en media/{anilistId}.
 *
 * El recorrido es iterativo y NO una query con `relations` dentro de
 * `relations`: eso ya se probo, multiplica las aristas que AniList tiene que
 * resolver y, aun asi, no llega al final de una cadena de siete nodos como la de
 * Shingeki no Kyojin. Con saltos, la profundidad no tiene limite estructural.
 */
const CHAIN_QUERY = `
  query Chain($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      episodes
      format
      relations {
        edges {
          relationType
          node { id type format }
        }
      }
    }
  }
`

/**
 * Formatos que cuentan como temporada. Una pelicula, un OVA o un especial
 * pertenecen a la franquicia pero no son "la temporada 4", y meterlos inflaria
 * tanto el numero de temporadas como el de capitulos.
 */
const SEASON_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA'])

/**
 * Unicas relaciones que continuan la MISMA serie. Un SIDE_STORY es otra obra, y
 * como los spin-offs tienen sus propios SEQUEL, solo se expanden los nodos ya
 * aceptados como temporada: expandir un spin-off arrastraria su cadena entera a
 * la cuenta de la serie principal.
 */
const SEASON_RELATIONS = new Set(['SEQUEL', 'PREQUEL'])

/**
 * Tope de peticiones por franquicia, para que una cadena inesperadamente larga
 * (o un ciclo raro en los datos de AniList) no dispare peticiones sin fin.
 */
const MAX_CHAIN_REQUESTS = 12

/**
 * Espaciado entre saltos. AniList limita por minuto, y esto encadena una
 * peticion por temporada: sin pausa, una franquicia larga se come el cupo de
 * golpe. 600 ms deja el alta de la cadena mas larga en unos cuatro segundos, que
 * es el precio de calcularlo bien una sola vez.
 */
const CHAIN_DELAY_MS = 600

/** Reintentos ante un 429 antes de rendirse. */
const CHAIN_RATE_LIMIT_RETRIES = 2

const NO_CHAIN: FranchiseChain = { seasons: null, totalEpisodes: null }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Un nodo con sus aristas, o null si no se ha podido leer. */
async function fetchChainNode(id: number, attempt = 0): Promise<AniListChainMedia | null> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: CHAIN_QUERY, variables: { id } }),
  })

  // Retry-After es lo que dice AniList que hay que esperar; ignorarlo solo
  // consigue otro 429. El segundo extra cubre el desfase de reloj.
  if (response.status === 429) {
    if (attempt >= CHAIN_RATE_LIMIT_RETRIES) return null
    const wait = (Number(response.headers.get('Retry-After')) || 60) + 1
    await sleep(wait * 1000)
    return fetchChainNode(id, attempt + 1)
  }

  if (!response.ok) return null

  const payload = (await response.json()) as {
    data?: { Media?: AniListChainMedia | null }
    errors?: Array<{ message?: string }>
  }
  if (payload.errors?.length) return null

  return payload.data?.Media ?? null
}

/**
 * Temporadas y episodios totales de la franquicia a la que pertenece `id`.
 *
 * Da el MISMO resultado desde cualquier temporada de la serie, que es todo el
 * problema: se recorre la cadena en las dos direcciones (SEQUEL y PREQUEL) hasta
 * agotarla, en vez de mirar solo los vecinos de la entrada que se ha buscado.
 *
 * Devuelve todo a null ante cualquier fallo: no saber las temporadas no debe
 * impedir un alta. Y tambien si la cadena no se ha podido agotar, porque un
 * recuento a medias volveria a depender de por donde se empezo, que es
 * exactamente el numero falso que esto viene a arreglar.
 */
export async function resolveFranchiseChain(id: number): Promise<FranchiseChain> {
  try {
    // Los episodios de cada temporada ya visitada. El Map da la unicidad: en una
    // cadena, A dice que su SEQUEL es B y B que su PREQUEL es A, asi que sin
    // esto el recorrido iria y volveria sobre los mismos nodos.
    const episodesById = new Map<number, number | null>()
    const pending: number[] = [id]
    let requests = 0

    while (pending.length > 0) {
      if (requests >= MAX_CHAIN_REQUESTS) return NO_CHAIN

      const current = pending.shift()!
      if (requests > 0) await sleep(CHAIN_DELAY_MS)
      const media = await fetchChainNode(current)
      requests += 1

      // Falta un eslabon: cualquier cuenta a partir de aqui seria incompleta.
      if (!media) return NO_CHAIN

      episodesById.set(media.id, media.episodes ?? null)

      // La entrada de partida puede ser una pelicula o un especial. En ese caso
      // no se expande: sus SEQUEL llevan a la serie, y contarlos convertiria una
      // pelicula en "temporada 5 de algo".
      if (!SEASON_FORMATS.has(media.format ?? '')) break

      for (const edge of media.relations?.edges ?? []) {
        const node = edge?.node
        if (!node) continue
        if (!SEASON_RELATIONS.has(edge?.relationType ?? '')) continue
        // Las relaciones de un anime incluyen el manga original, que comparte
        // relationType pero evidentemente no es una temporada.
        if (node.type !== 'ANIME') continue
        if (!SEASON_FORMATS.has(node.format ?? '')) continue
        if (episodesById.has(node.id) || pending.includes(node.id)) continue
        pending.push(node.id)
      }
    }

    const episodes = [...episodesById.values()]
    // Un solo null (temporada anunciada y sin emitir) invalida el total: sumarlo
    // como cero daria menos capitulos de los que la serie ya tiene emitidos.
    const complete = episodes.every((value) => value !== null)

    return {
      seasons: episodes.length,
      totalEpisodes: complete ? episodes.reduce((sum, value) => sum + (value ?? 0), 0) : null,
    }
  } catch {
    return NO_CHAIN
  }
}

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
  options: { perPage?: number; signal?: AbortSignal; allowAdult?: boolean } = {},
): Promise<MediaSummary[]> {
  // La preferencia entra en la clave de cache: si no, cambiar el filtro seguiria
  // devolviendo los resultados de antes.
  const key = `${options.allowAdult ? 'a' : 's'}:${term.trim().toLowerCase()}`
  if (!term.trim()) return []

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
      variables: {
        search: term,
        perPage: options.perPage ?? 8,
        // null deja pasar todo; false oculta lo marcado como adulto. Con
        // genre_not_in, el hentai queda fuera en ambos casos.
        isAdult: options.allowAdult ? null : false,
      },
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
    genres: media.genres ?? [],
    averageScore: media.averageScore,
    // Se rellenan al resolver la franquicia completa (ver nota en SEARCH_QUERY).
    seasons: null,
    totalEpisodes: null,
  }
}
