// Firebase client-side singletons for the web app.
// All three services (Firestore, Auth, Messaging) are lazily initialised so
// the module is safe to import in both SSR and browser contexts.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'],
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'],
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Guard against duplicate initialisation during Next.js Hot Module Replacement.
function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

// Firestore security rules require an authenticated user — call this before any
// Firestore read/write. Anonymous auth is sufficient and requires no user action.
export async function ensureAnonymousAuth(): Promise<string | null> {
  const authInstance = getFirebaseAuth();
  if (authInstance.currentUser) return authInstance.currentUser.uid;

  try {
    const cred = await signInAnonymously(authInstance);
    return cred.user.uid;
  } catch {
    return null;
  }
}

// FCM Messaging is browser-only — the SDK throws if loaded during SSR.
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  try {
    return getMessaging(getFirebaseApp());
  } catch {
    return null;
  }
}
