import type { MediaSummary } from '@/types/anilist'

/**
 * Indice local de titulos, generado por scripts/build-anime-index.mjs.
 *
 * Existe porque el `search` de AniList indexa palabras completas: "jobless"
 * encuentra Mushoku Tensei y "musho" no encuentra nada. Aqui, buscar por
 * subcadena es un `includes` y sale gratis.
 *
 * Se descarga en la primera busqueda, no al abrir la pagina, y se queda en
 * memoria para el resto de la sesion.
 */

/** [id, preferred, romaji, english, episodios, ficheroPortada, color] */
type IndexRow = [
  number,
  string,
  string | null,
  string | null,
  number | null,
  string | null,
  string | null,
]

interface IndexFile {
  generatedAt: string
  coverBase: string
  count: number
  items: IndexRow[]
}

interface Entry {
  media: MediaSummary
  /** Titulos ya normalizados: no se re-normalizan en cada pulsacion. */
  haystacks: string[]
}

/** Cuantos titulos devuelve el indice como maximo. */
export const LOCAL_LIMIT = 8

let entries: Entry[] | null = null
let pending: Promise<Entry[]> | null = null

export function normalizeTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function toEntry(row: IndexRow, coverBase: string): Entry {
  const [id, preferred, romaji, english, episodes, cover, color] = row

  const media: MediaSummary = {
    id,
    titlePreferred: preferred,
    // En el indice, romaji y english van a null cuando coinciden con preferred.
    titleRomaji: romaji ?? preferred,
    titleEnglish: english,
    coverImage: cover ? (cover.startsWith('http') ? cover : coverBase + cover) : null,
    coverColor: color,
    // El indice no guarda formato ni año para no engordarlo; si hace falta el
    // dato completo (al añadir a una lista) se pide a AniList por id.
    format: null,
    seasonYear: null,
    episodes,
    seasons: null,
    totalEpisodes: null,
  }

  const haystacks = [preferred, romaji, english]
    .filter((value): value is string => Boolean(value))
    .map(normalizeTerm)

  return { media, haystacks }
}

async function load(): Promise<Entry[]> {
  // BASE_URL respeta el subdirectorio de GitHub Pages (/AnimeDB/).
  const url = `${import.meta.env.BASE_URL}anime-index.json`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`indice no disponible (HTTP ${response.status})`)

  const file = (await response.json()) as IndexFile
  return file.items.map((row) => toEntry(row, file.coverBase))
}

export function ensureAnimeIndex(): Promise<Entry[]> {
  if (entries) return Promise.resolve(entries)

  pending ??= load()
    .then((loaded) => {
      entries = loaded
      return loaded
    })
    .catch((e) => {
      // Sin indice la app sigue funcionando contra la API; se avisa una vez y
      // no se reintenta en cada pulsacion.
      console.warn(
        '[AnimeDB] No se pudo cargar anime-index.json; se buscará solo contra AniList. ' +
          'Genéralo con: node scripts/build-anime-index.mjs',
        e,
      )
      entries = []
      return entries
    })

  return pending
}

/**
 * Puntuacion mas baja = mejor coincidencia:
 *   0 titulo exacto
 *   1 el titulo empieza por el texto
 *   2 una palabra del titulo empieza por el texto  ("tensei" en "Mushoku Tensei")
 *   3 aparece en cualquier posicion                ("shoku" en "Mushoku")
 */
function score(haystack: string, needle: string): number {
  if (haystack === needle) return 0
  if (haystack.startsWith(needle)) return 1

  const at = haystack.indexOf(needle)
  if (at < 0) return Number.POSITIVE_INFINITY
  return /[\p{L}\p{N}]/u.test(haystack[at - 1] ?? '') ? 3 : 2
}

export async function searchAnimeIndex(
  term: string,
  limit = LOCAL_LIMIT,
): Promise<MediaSummary[]> {
  const needle = normalizeTerm(term)
  if (!needle) return []

  const index = await ensureAnimeIndex()
  if (!index.length) return []

  const hits: Array<{ media: MediaSummary; score: number; rank: number }> = []

  for (let rank = 0; rank < index.length; rank++) {
    const entry = index[rank]!
    let best = Number.POSITIVE_INFINITY

    for (const haystack of entry.haystacks) {
      const value = score(haystack, needle)
      if (value < best) best = value
      if (best === 0) break
    }

    if (best !== Number.POSITIVE_INFINITY) hits.push({ media: entry.media, score: best, rank })
  }

  // A igual calidad de coincidencia manda la popularidad, que es el orden en
  // que el generador escribio el indice.
  hits.sort((a, b) => a.score - b.score || a.rank - b.rank)

  return hits.slice(0, limit).map((hit) => hit.media)
}
