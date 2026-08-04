import { onScopeDispose, ref, watch } from 'vue'
import { AniListRateLimitError, searchAnime } from '@/lib/anilist'
import { LOCAL_LIMIT, searchAnimeIndex } from '@/lib/animeIndex'
import type { MediaSummary } from '@/types/anilist'

interface Options {
  /** Caracteres minimos antes de buscar. */
  minLength?: number
  /** Espera tras la ultima pulsacion, solo para la peticion a AniList. */
  delay?: number
  perPage?: number
}

/**
 * Si el indice local ya da al menos estos resultados, no se molesta a AniList:
 * lo que busca el usuario esta claramente en el catalogo conocido.
 */
const ENOUGH_LOCAL = 5

/** Tope de la lista una vez mezclado lo local con lo remoto. */
const MAX_RESULTS = 10

export function useAnimeSearch(options: Options = {}) {
  const minLength = options.minLength ?? 2
  const delay = options.delay ?? 300

  const term = ref('')
  const results = ref<MediaSummary[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  const currentTerm = () => term.value.trim()

  function cancelPending() {
    clearTimeout(timer)
    // Abortar la anterior evita que una respuesta lenta de "fri" pise a la
    // de "frieren" y evita gastar cupo de peticiones.
    controller?.abort()
    controller = undefined
  }

  /** Indice local: subcadenas de verdad, sin red mas alla de la primera carga. */
  async function runLocal(value: string) {
    const local = await searchAnimeIndex(value, LOCAL_LIMIT)
    if (currentTerm() !== value) return local

    results.value = local
    return local
  }

  /** AniList: cubre lo que no esta en el indice (nicho, estrenos recientes). */
  async function runRemote(value: string) {
    const own = new AbortController()
    controller = own

    try {
      const remote = await searchAnime(value, {
        perPage: options.perPage,
        signal: own.signal,
      })
      if (controller !== own || currentTerm() !== value) return

      // Lo local va primero: es lo que el usuario reconoce.
      const merged = [...results.value]
      const seen = new Set(merged.map((media) => media.id))
      for (const media of remote) {
        if (seen.has(media.id)) continue
        seen.add(media.id)
        merged.push(media)
      }
      results.value = merged.slice(0, MAX_RESULTS)
    } catch (e) {
      // Una peticion abortada no es un error que mostrar. No se comprueba
      // `instanceof DOMException` porque no todos los entornos rechazan con esa
      // clase, y confundir un aborto con un fallo real vaciaria la lista.
      if ((e as Error | undefined)?.name === 'AbortError' || own.signal.aborted) return
      if (controller !== own) return

      // Si el indice local ya dio algo, un fallo de red no debe borrarlo.
      if (!results.value.length) {
        error.value =
          e instanceof AniListRateLimitError
            ? `Demasiadas búsquedas seguidas. Prueba en ${e.retryAfterSeconds}s.`
            : 'No se ha podido consultar AniList.'
      }
      console.error('[AnimeDB] Busqueda en AniList fallida:', e)
    } finally {
      if (controller === own) isLoading.value = false
    }
  }

  async function start(value: string) {
    const local = await runLocal(value)
    if (currentTerm() !== value) return

    // Con suficientes coincidencias locales no hace falta la API.
    if (local.length >= ENOUGH_LOCAL) {
      isLoading.value = false
      return
    }

    timer = setTimeout(() => void runRemote(value), delay)
  }

  watch(term, (value) => {
    cancelPending()
    const trimmed = value.trim()

    if (trimmed.length < minLength) {
      results.value = []
      error.value = null
      isLoading.value = false
      return
    }

    // Feedback inmediato: el spinner aparece al teclear, no al lanzar la peticion.
    isLoading.value = true
    error.value = null
    void start(trimmed)
  })

  function reset() {
    cancelPending()
    term.value = ''
    results.value = []
    error.value = null
    isLoading.value = false
  }

  onScopeDispose(cancelPending)

  return { term, results, isLoading, error, minLength, reset }
}
