/**
 * Genera public/anime-index.json: el indice local de titulos que permite buscar
 * por subcadena.
 *
 * Por que existe: el `search` de AniList indexa PALABRAS COMPLETAS y tolera
 * erratas, pero no hace prefijos ni subcadenas. "jobless" encuentra Mushoku
 * Tensei (es una palabra de su titulo ingles) y "musho" no encuentra nada. Con
 * el indice en local, filtrar por subcadena es un `includes` y sale gratis.
 *
 *   node scripts/build-anime-index.mjs
 *
 * Ojo: AniList corta la paginacion en 5000 resultados por consulta, asi que
 * ordenando por popularidad esto es todo lo que se puede recorrer de una vez.
 * Cubre el catalogo conocido; lo de nicho lo resuelve el respaldo contra la API.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDPOINT = 'https://graphql.anilist.co'
const PER_PAGE = 50
const MAX_PAGES = 100 // 100 x 50 = 5000, el techo de AniList
const DELAY_MS = 1500 // ~40 peticiones/minuto, holgado frente al limite

/**
 * Prefijo comun de las portadas. Va en el JSON para que un cambio de CDN se
 * arregle regenerando el indice, sin tocar el codigo del cliente.
 *
 * Ojo con los nombres de los campos de AniList, que no coinciden con la ruta:
 * coverImage.medium sirve /cover/small/, y coverImage.large sirve /cover/medium/.
 * Se usa `large` para que las portadas del indice tengan la misma resolucion que
 * las que llegan por la API en el respaldo.
 */
const COVER_BASE = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/'

const QUERY = `
  query Index($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        id
        episodes
        averageScore
        genres
        title { romaji english userPreferred }
        coverImage { large color }
      }
    }
  }
`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(page, attempt = 1) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { page, perPage: PER_PAGE } }),
  })

  if (response.status === 429) {
    const wait = (Number(response.headers.get('Retry-After')) || 60) + 1
    console.warn(`  limite alcanzado en la pagina ${page}: esperando ${wait}s`)
    await sleep(wait * 1000)
    return fetchPage(page, attempt)
  }

  if (!response.ok) {
    if (attempt >= 3) throw new Error(`pagina ${page}: HTTP ${response.status}`)
    await sleep(3000 * attempt)
    return fetchPage(page, attempt + 1)
  }

  const payload = await response.json()
  if (payload.errors?.length) {
    throw new Error(`pagina ${page}: ${payload.errors[0]?.message ?? 'error de GraphQL'}`)
  }
  return payload.data.Page
}

/**
 * Tabla de generos compartida. AniList usa una lista cerrada de una veintena, y
 * guardarlos como indices en lugar de repetir "Adventure" 3000 veces ahorra
 * cientos de KB: cada genero pasa de ~12 bytes a 1 o 2.
 */
const genreTable = []
const genreIds = new Map()

function toGenreIds(list) {
  return (list ?? []).map((genre) => {
    let id = genreIds.get(genre)
    if (id === undefined) {
      id = genreTable.length
      genreTable.push(genre)
      genreIds.set(genre, id)
    }
    return id
  })
}

/**
 * Cada entrada es un array y no un objeto: con 5000 titulos, repetir los nombres
 * de campo costaria mas de 200 KB de nada.
 *
 *   [id, preferred, romaji, english, episodios, portada, color, nota, generos]
 *
 * romaji y english se guardan como null cuando coinciden con preferred, que es
 * el caso de la mayoria, para no duplicar la misma cadena. `nota` es el
 * averageScore de AniList (0-100); el cliente lo pasa a estrellas.
 */
function toRow(media) {
  const preferred = media.title.userPreferred ?? media.title.romaji ?? media.title.english
  if (!preferred) return null

  const dedupe = (value) => (value && value !== preferred ? value : null)
  const url = media.coverImage?.large ?? null
  // Solo el nombre del fichero: el prefijo va una vez en el JSON. Si algun dia
  // la ruta del CDN cambia, se guarda la URL completa y sigue funcionando.
  const cover = url?.startsWith(COVER_BASE) ? url.slice(COVER_BASE.length) : url

  return [
    media.id,
    preferred,
    dedupe(media.title.romaji),
    dedupe(media.title.english),
    media.episodes ?? null,
    cover,
    media.coverImage?.color ?? null,
    media.averageScore ?? null,
    toGenreIds(media.genres),
  ]
}

const rows = []
const seen = new Set()

for (let page = 1; page <= MAX_PAGES; page++) {
  const data = await fetchPage(page)

  for (const media of data.media ?? []) {
    if (!media || seen.has(media.id)) continue
    const row = toRow(media)
    if (!row) continue
    seen.add(media.id)
    rows.push(row)
  }

  if (page % 10 === 0 || !data.pageInfo?.hasNextPage) {
    console.log(`  pagina ${page}/${MAX_PAGES} — ${rows.length} titulos`)
  }
  if (!data.pageInfo?.hasNextPage) break
  await sleep(DELAY_MS)
}

const output = {
  generatedAt: new Date().toISOString(),
  source: 'AniList (type: ANIME, sort: POPULARITY_DESC, isAdult: false)',
  coverBase: COVER_BASE,
  fields: [
    'id',
    'preferred',
    'romaji',
    'english',
    'episodes',
    'cover',
    'color',
    'score',
    'genres',
  ],
  // Los generos de cada entrada son indices dentro de esta tabla.
  genreTable,
  count: rows.length,
  items: rows,
}

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../public/anime-index.json')
await mkdir(dirname(target), { recursive: true })
await writeFile(target, JSON.stringify(output))

const kb = (JSON.stringify(output).length / 1024).toFixed(0)
console.log(`\n${rows.length} titulos escritos en public/anime-index.json (${kb} KB)`)
