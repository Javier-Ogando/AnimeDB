/**
 * Heuristica de los 5 coeficientes narrativos (accion, drama, misterio, ritmo,
 * profundidad) a partir de los `genres` y `tags` de AniList.
 *
 * Fichero en JS plano (con .d.ts al lado para el tipado) y no en TypeScript
 * porque lo importan dos entornos distintos: la app (Vite/TS, via el alias @)
 * y scripts/build-anime-index.mjs (Node puro, sin transpilar). Un unico
 * fichero evita que las dos copias diverjan.
 *
 * IMPORTANTE: esto NO es una valoracion editorial como la de un humano viendo
 * la serie (ver especificacion_ficha_anime.md); es una aproximacion barata
 * basada en que tags de AniList aparecen y con que rank (0-100, la relevancia
 * que AniList les asigna). Sirve para dar una idea de "de que va" un anime sin
 * mantener a mano una base de datos editorial, pero puede fallar en casos
 * raros o titulos con pocos tags.
 *
 * `pacing` es el eje mas debil: AniList no tiene un tag de "ritmo", asi que se
 * aproxima con la diferencia entre tags de "accion rapida" y de "vida
 * pausada" alrededor de un valor neutro (5).
 */

/** Relevancia que se asigna a un genero al no tener rank propio como los tags. */
const GENRE_RANK = 80

/** Valor por defecto (escala 1-10) cuando ningun tag/genero conocido aparece. */
const BASELINE = 2
/** Punto neutro del ritmo: ni especialmente rapido ni pausado. */
const PACING_NEUTRAL = 5

const ACTION_TAGS = {
  'Martial Arts': 1,
  Swordplay: 1,
  Spearplay: 1,
  Archery: 1,
  Guns: 1,
  'Battle Royale': 1,
  Espionage: 0.6,
  Fugitive: 0.5,
  War: 0.8,
  Military: 0.6,
  Assassins: 0.7,
  'Criminal Organization': 0.4,
  Gangs: 0.4,
  Mafia: 0.4,
  Yakuza: 0.4,
  Triads: 0.4,
  Terrorism: 0.5,
  'Death Game': 0.6,
  Survival: 0.5,
  'Super Power': 0.5,
  Superhero: 0.5,
  'Real Robot': 0.5,
  'Super Robot': 0.6,
  Kaiju: 0.5,
  Wrestling: 0.3,
  Boxing: 0.3,
  Tanks: 0.4,
  Airsoft: 0.3,
}
const ACTION_GENRES = { Action: 1, Mecha: 0.4, Sports: 0.3 }

const DRAMA_TAGS = {
  Bullying: 0.8,
  'Class Struggle': 0.6,
  'Coming of Age': 0.5,
  Conspiracy: 0.4,
  'Eco-Horror': 0.3,
  'Fake Relationship': 0.3,
  'Kingdom Management': 0.3,
  Rehabilitation: 0.7,
  Revenge: 0.6,
  Suicide: 0.9,
  Tragedy: 1,
  'Estranged Family': 0.6,
  'Found Family': 0.4,
  Marriage: 0.3,
  Pregnancy: 0.3,
  Parenthood: 0.3,
  Adoption: 0.4,
  'Body Image': 0.4,
}
const DRAMA_GENRES = { Drama: 1, Romance: 0.2 }

const MYSTERY_TAGS = {
  Detective: 1,
  Conspiracy: 0.8,
  Noir: 0.6,
  Crime: 0.5,
  Blackmail: 0.4,
  'Memory Manipulation': 0.5,
  Amnesia: 0.5,
  Prophecy: 0.3,
  'Cosmic Horror': 0.3,
}
const MYSTERY_GENRES = { Mystery: 1, Thriller: 0.8, Horror: 0.2 }

const DEPTH_TAGS = {
  'Dissociative Identities': 0.8,
  Philosophy: 1,
  'Body Image': 0.5,
  Suicide: 0.6,
  'Cosmic Horror': 0.4,
  'Body Horror': 0.3,
  'Memory Manipulation': 0.5,
  Brainwashing: 0.6,
  Denpa: 0.7,
  Psychosexual: 0.5,
  Noir: 0.3,
  Meta: 0.4,
  'Coming of Age': 0.4,
  'Estranged Family': 0.3,
  'Primarily Adult Cast': 0.2,
}
const DEPTH_GENRES = { Psychological: 1, Drama: 0.3 }

/** Empuja el ritmo por encima del neutro: eventos que se suceden deprisa. */
const PACING_FAST_TAGS = {
  'Battle Royale': 0.8,
  'Death Game': 0.8,
  'Time Loop': 0.6,
  'Time Manipulation': 0.5,
  Espionage: 0.5,
  Survival: 0.6,
  War: 0.5,
  Assassins: 0.5,
  Military: 0.3,
  Terrorism: 0.4,
  'Proxy Battle': 0.4,
}
const PACING_FAST_GENRES = { Action: 0.8, Thriller: 0.7, Sports: 0.3 }

/** Empuja el ritmo por debajo del neutro: dia a dia sin prisa. */
const PACING_SLOW_TAGS = {
  Iyashikei: 1,
  'Cute Girls Doing Cute Things': 0.7,
  'Cute Boys Doing Cute Things': 0.7,
  Agriculture: 0.5,
  Horticulture: 0.5,
  'Family Life': 0.5,
  Parenthood: 0.4,
  'Coming of Age': 0.2,
}
const PACING_SLOW_GENRES = { 'Slice of Life': 1, Music: 0.3 }

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Media ponderada de `rank` (0-100) sobre las señales (tags + generos) que
 * aparecen en la tabla de pesos de un eje. null si ninguna aparece.
 */
function weightedAverage(signals, weights) {
  let sum = 0
  let weightTotal = 0

  for (const [name, rank] of signals) {
    const weight = weights[name]
    if (!weight) continue
    sum += weight * rank
    weightTotal += weight
  }

  return weightTotal > 0 ? sum / weightTotal : null
}

function toScale(average) {
  return clamp(Math.round(1 + (average / 100) * 9), 1, 10)
}

/**
 * Calcula los 5 coeficientes narrativos de un anime a partir de sus generos y
 * tags de AniList. Devuelve null si no hay ninguna señal (ni generos ni tags
 * con rank), para que la interfaz oculte el bloque entero en vez de pintar
 * ceros que no significan nada.
 *
 * @param {string[] | null | undefined} genres
 * @param {Array<{ name: string; rank?: number | null }> | null | undefined} tags
 * @returns {{ action: number; drama: number; mystery: number; pacing: number; depth: number } | null}
 */
export function computeAnimeStats(genres, tags) {
  const signals = []

  for (const tag of tags ?? []) {
    if (!tag?.name || typeof tag.rank !== 'number') continue
    signals.push([tag.name, tag.rank])
  }
  for (const genre of genres ?? []) {
    if (genre) signals.push([genre, GENRE_RANK])
  }

  if (!signals.length) return null

  const action = weightedAverage(signals, { ...ACTION_TAGS, ...ACTION_GENRES })
  const drama = weightedAverage(signals, { ...DRAMA_TAGS, ...DRAMA_GENRES })
  const mystery = weightedAverage(signals, { ...MYSTERY_TAGS, ...MYSTERY_GENRES })
  const depth = weightedAverage(signals, { ...DEPTH_TAGS, ...DEPTH_GENRES })

  const fast = weightedAverage(signals, { ...PACING_FAST_TAGS, ...PACING_FAST_GENRES }) ?? 0
  const slow = weightedAverage(signals, { ...PACING_SLOW_TAGS, ...PACING_SLOW_GENRES }) ?? 0

  return {
    action: action == null ? BASELINE : toScale(action),
    drama: drama == null ? BASELINE : toScale(drama),
    mystery: mystery == null ? BASELINE : toScale(mystery),
    pacing: clamp(Math.round(PACING_NEUTRAL + (fast - slow) * 0.05), 1, 10),
    depth: depth == null ? BASELINE : toScale(depth),
  }
}
