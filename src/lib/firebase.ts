/**
 * Firebase client initialization.
 *
 * Exposes the shared app, auth, firestore and functions instances. When
 * VITE_USE_EMULATORS is "true" all three are wired to the local emulators so
 * the project is runnable end-to-end with `firebase emulators:start`.
 */
import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import type { Analytics } from 'firebase/analytics'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

/** Cloud Functions are deployed to asia-southeast1. */
export const FUNCTIONS_REGION = 'asia-southeast1'

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const functions = getFunctions(app, FUNCTIONS_REGION)
export const googleProvider = new GoogleAuthProvider()

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  // eslint-disable-next-line no-console
  console.info('[EcoGraph AI] Connected to Firebase emulators.')
}

/** Analytics is browser-only and skipped while running against emulators. */
export let analytics: Analytics | null = null
if (!useEmulators) {
  isSupported()
    .then((supported) => {
      if (supported) analytics = getAnalytics(app)
    })
    .catch(() => {
      analytics = null
    })
}
