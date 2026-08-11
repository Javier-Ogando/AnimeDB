import { computed, ref } from 'vue'
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/composables/useAuth'
import type { Language, UserDoc, UserPreferences } from '@/types/models'

/**
 * Perfil y ajustes del usuario dentro de la aplicacion.
 *
 * Se guardan en users/{uid} y no en localStorage porque tienen que viajar entre
 * dispositivos: el apodo lo ven los demas y el filtro de contenido debe aplicar
 * igual desde el movil que desde el portatil.
 *
 * El estado es global (fuera de la funcion): una sola suscripcion para toda la
 * aplicacion, igual que con la sesion.
 */

export const DEFAULT_PREFERENCES: UserPreferences = {
  // Por defecto se oculta el contenido para adultos: es lo prudente cuando la
  // aplicacion la puede abrir cualquiera con un enlace de invitacion.
  nsfw: false,
  language: 'es',
}

const nickname = ref<string | null>(null)
const photoOverride = ref<string | null>(null)
const preferences = ref<UserPreferences>({ ...DEFAULT_PREFERENCES })
const isLoaded = ref(false)

let unsubscribe: (() => void) | null = null
let watchedUid: string | null = null

function apply(data: UserDoc | undefined) {
  nickname.value = data?.nickname ?? null
  photoOverride.value = data?.photoOverride ?? null
  preferences.value = { ...DEFAULT_PREFERENCES, ...(data?.preferences ?? {}) }
  isLoaded.value = true
}

/** Arranca la escucha del documento del usuario. Idempotente. */
export function watchPreferences(uid: string) {
  if (watchedUid === uid) return
  unsubscribe?.()
  watchedUid = uid

  unsubscribe = onSnapshot(
    doc(db, 'users', uid),
    (snap) => apply(snap.data() as UserDoc | undefined),
    () => {
      // Sin permisos o sin red, se sigue con los valores por defecto: unas
      // preferencias que no cargan no deben dejar la aplicacion inservible.
      isLoaded.value = true
    },
  )
}

export function stopWatchingPreferences() {
  unsubscribe?.()
  unsubscribe = null
  watchedUid = null
  nickname.value = null
  photoOverride.value = null
  preferences.value = { ...DEFAULT_PREFERENCES }
  isLoaded.value = false
}

export function usePreferences() {
  const { user } = useAuth()

  /** Lo que debe verse en la interfaz: manda el apodo sobre el nombre del proveedor. */
  const displayName = computed(
    () => nickname.value?.trim() || user.value?.displayName || user.value?.email || 'Usuario',
  )

  /** Igual con la foto: la propia de la aplicacion tiene prioridad. */
  const photo = computed(() => photoOverride.value?.trim() || user.value?.photoURL || null)

  async function saveProfile(next: { nickname?: string | null; photoOverride?: string | null }) {
    const uid = user.value?.uid
    if (!uid) return

    await setDoc(
      doc(db, 'users', uid),
      {
        ...(next.nickname !== undefined ? { nickname: next.nickname?.trim() || null } : {}),
        ...(next.photoOverride !== undefined
          ? { photoOverride: next.photoOverride?.trim() || null }
          : {}),
      },
      { merge: true },
    )
  }

  async function savePreferences(next: Partial<UserPreferences>) {
    const uid = user.value?.uid
    if (!uid) return

    // Se escribe el objeto completo y no campos anidados sueltos: asi la lista
    // blanca de las reglas solo tiene que contemplar la clave 'preferences'.
    const merged = { ...preferences.value, ...next }
    await setDoc(doc(db, 'users', uid), { preferences: merged }, { merge: true })
    preferences.value = merged
  }

  /** Lectura puntual, para cuando no interesa la suscripcion. */
  async function reload() {
    const uid = user.value?.uid
    if (!uid) return
    const snap = await getDoc(doc(db, 'users', uid))
    apply(snap.data() as UserDoc | undefined)
  }

  return {
    nickname,
    photoOverride,
    preferences,
    isLoaded,
    displayName,
    photo,
    saveProfile,
    savePreferences,
    reload,
    language: computed<Language>(() => preferences.value.language),
    nsfw: computed(() => preferences.value.nsfw),
  }
}
