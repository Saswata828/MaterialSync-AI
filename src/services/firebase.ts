import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
  Auth
} from "firebase/auth";

// Load configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "MY_FIREBASE_API_KEY" &&
    firebaseConfig.projectId
  );
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

try {
  if (isFirebaseConfigured()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  }
} catch (error) {
  console.warn("[Firebase] Initialization error:", error);
}

export interface FirebaseUserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Sign in using Google OAuth via Firebase popup
 */
export async function signInWithGoogle(): Promise<{ success: boolean; user?: FirebaseUserInfo; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: "Firebase is not configured yet. Please enter your VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in .env."
    };
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    };
  } catch (error: any) {
    console.error("[Firebase Google Sign-In Error]:", error);
    let errorMessage = error.message || "Failed to sign in with Google.";
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = "Google sign-in popup was closed before completing.";
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = "This domain is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.";
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = "Popup request cancelled.";
    }
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Sign out from Firebase
 */
export async function signOutFirebase(): Promise<void> {
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn("[Firebase] Error signing out:", err);
    }
  }
}

/**
 * Subscribe to Firebase Auth state changes
 */
export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
