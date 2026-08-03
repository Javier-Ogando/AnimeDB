import { onScopeDispose, ref, watch } from 'vue'
import { AniListRateLimitError, searchAnime } from '@/lib/anilist'
import type { MediaSummary } from '@/types/anilist'

interface Options {
  /** Caracteres minimos antes de molestar a AniList. */
  minLength?: number
  /** Espera tras la ultima pulsacion. */
  delay?: number
  perPage?: number
}

export function useAnimeSearch(options: Options = {}) {
  const minLength = options.minLength ?? 2
  const delay = options.delay ?? 300

  const term = ref('')
  const results = ref<MediaSummary[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  function cancelPending() {
    clearTimeout(timer)
    // Abortar la anterior evita que una respuesta lenta de "fri" pise a la
    // de "frieren" y evita gastar cupo de peticiones.
    controller?.abort()
    controller = undefined
  }

  async function run(value: string) {
    controller = new AbortController()
    isLoading.value = true
    error.value = null

    try {
      results.value = await searchAnime(value, {
        perPage: options.perPage,
        signal: controller.signal,
      })
    } catch (e) {
      // Una peticion abortada no es un error que mostrar.
      if (e instanceof DOMException && e.name === 'AbortError') return

      results.value = []
      error.value =
        e instanceof AniListRateLimitError
          ? `Demasiadas búsquedas seguidas. Prueba en ${e.retryAfterSeconds}s.`
          : 'No se ha podido consultar AniList.'
      console.error('[AnimeDB] Busqueda en AniList fallida:', e)
    } finally {
      isLoading.value = false
    }
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
    timer = setTimeout(() => void run(trimmed), delay)
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
