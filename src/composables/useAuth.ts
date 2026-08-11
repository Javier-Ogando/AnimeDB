import { computed, ref } from 'vue'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, githubProvider, googleProvider } from '@/lib/firebase'

// Estado global (fuera de la funcion): un unico listener de Firebase para
// toda la app, no uno por componente que la use.
const user = ref<User | null>(null)
const isReady = ref(false)
const isBusy = ref(false)
const error = ref<string | null>(null)

/**
 * Se resuelve cuando Firebase ya nos ha dicho si habia sesion previa.
 * El router lo espera: sin esto, al recargar /  saldria un parpadeo al login
 * porque en el primer tick user siempre es null.
 */
let markReady: () => void
export const authReady = new Promise<void>((resolve) => {
  markReady = resolve
})

/** users/{uid}: se crea al primer login y se refresca en cada entrada. */
async function syncUserDoc(u: User): Promise<void> {
  const ref = doc(db, 'users', u.uid)
  const snap = await getDoc(ref)

  await setDoc(
    ref,
    {
      uid: u.uid,
      displayName: u.displayName,
      photoURL: u.photoURL,
      email: u.email,
      lastLoginAt: serverTimestamp(),
      // createdAt solo la primera vez, para no perder la fecha real de alta.
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
}

onAuthStateChanged(auth, (u) => {
  user.value = u

  // El login no depende de Firestore: si las reglas no estan desplegadas
  // todavia, avisamos pero dejamos entrar.
  if (u) {
    syncUserDoc(u).catch((e) => {
      console.warn(
        '[AnimeDB] No se pudo escribir users/%s. Si el error es permission-denied, ' +
          'despliega firestore.rules (firebase deploy --only firestore:rules).',
        u.uid,
        e,
      )
    })
  }

  if (!isReady.value) {
    isReady.value = true
    markReady()
  }
})

export function useAuth() {
  async function signInWithGoogle(): Promise<void> {
    return signIn(googleProvider)
  }

  async function signInWithGithub(): Promise<void> {
    return signIn(githubProvider)
  }

  async function signIn(provider: typeof googleProvider | typeof githubProvider): Promise<void> {
    isBusy.value = true
    error.value = null
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      // Cerrar el popup no es un fallo que merezca mensaje en pantalla.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        error.value = describeAuthError(code)
        console.error('[AnimeDB] Fallo el login con Google:', e)
      }
    } finally {
      isBusy.value = false
    }
  }

  async function signOut(): Promise<void> {
    isBusy.value = true
    try {
      await firebaseSignOut(auth)
    } finally {
      isBusy.value = false
    }
  }

  return {
    user,
    isReady,
    isBusy,
    error,
    isSignedIn: computed(() => user.value !== null),
    signInWithGoogle,
    signInWithGithub,
    signOut,
  }
}

function describeAuthError(code: string): string {
  switch (code) {
    case 'auth/popup-blocked':
      return 'El navegador ha bloqueado la ventana de Google. Permite los popups e intentalo de nuevo.'
    case 'auth/unauthorized-domain':
      return 'Este dominio no esta autorizado en Firebase Authentication > Settings > Dominios autorizados.'
    case 'auth/operation-not-allowed':
      return 'Ese proveedor no esta habilitado en Firebase Authentication.'
    case 'auth/account-exists-with-different-credential':
      // Mismo correo dado de alta con otro proveedor: Firebase no los une solo.
      return 'Ya existe una cuenta con ese correo creada con otro proveedor. Entra con el que usaste la primera vez.'
    case 'auth/network-request-failed':
      return 'Sin conexion con Firebase. Revisa tu red.'
    default:
      return 'No se ha podido iniciar sesion. Intentalo de nuevo.'
  }
}
