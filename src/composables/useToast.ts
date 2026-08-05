import { ref } from 'vue'

export type ToastTone = 'success' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

/** Cuantos avisos se apilan a la vez: mas seria una pared de mensajes. */
const MAX_VISIBLE = 3

const DURATION: Record<ToastTone, number> = {
  success: 4000,
  // Un error se lee mas despacio, y suele traer instrucciones.
  error: 7000,
}

// Estado global: una sola pila para toda la aplicacion.
const toasts = ref<Toast[]>([])
const timers = new Map<number, number>()
let nextId = 1

function clearTimer(id: number) {
  const timer = timers.get(id)
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
}

export function useToast() {
  function dismiss(id: number) {
    clearTimer(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function notify(message: string, tone: ToastTone = 'success'): number {
    const id = nextId++
    toasts.value = [...toasts.value, { id, message, tone }]

    // Si se acumulan, se van los mas antiguos; y hay que matar su temporizador
    // o dispararia un dismiss sobre un id que ya no existe.
    while (toasts.value.length > MAX_VISIBLE) {
      const [oldest] = toasts.value
      if (!oldest) break
      dismiss(oldest.id)
    }

    timers.set(id, window.setTimeout(() => dismiss(id), DURATION[tone]))
    return id
  }

  return { toasts, notify, dismiss }
}
