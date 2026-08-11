import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, GithubAuthProvider, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Fallar aqui con un mensaje claro es mucho mas barato que depurar un
// "auth/invalid-api-key" en runtime porque falta el .env.
const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length) {
  throw new Error(
    `Falta configuracion de Firebase (${missing.join(', ')}). ` +
      'Copia .env.example a .env y rellena las claves del proyecto.',
  )
}

export const app = initializeApp(config)
export const auth = getAuth(app)
export const db = getFirestore(app)

export const googleProvider = new GoogleAuthProvider()

/**
 * GitHub como segundo proveedor. La URL de retorno que hay que registrar en la
 * OAuth App de GitHub la sirve Firebase:
 *   https://<authDomain>/__/auth/handler
 */
export const githubProvider = new GithubAuthProvider()
