import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(firebaseConfig).every(v => typeof v === "string" && v.trim().length > 0);
let auth: Auth | undefined;
export function firebaseAuth(): Auth {
  if (!firebaseConfigured) throw new Error("Firebase Authentication is not configured. Sign in or create an account to continue.");
  auth ??= getAuth(getApps().find(app=>app.name==="ayatrisya") ?? initializeApp(firebaseConfig,"ayatrisya"));
  return auth;
}
export function authError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages:Record<string,string> = {
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/user-not-found":"Email or password is incorrect.",
    "auth/wrong-password":"Email or password is incorrect.",
    "auth/email-already-in-use":"An account already exists for this email.",
    "auth/invalid-email":"Enter a valid email address.",
    "auth/weak-password":"Use a password with at least 8 characters.",
    "auth/network-request-failed":"Could not reach Firebase. Check your connection and retry.",
    "auth/too-many-requests":"Too many attempts. Wait a moment before trying again.",
    "auth/popup-blocked":"Your browser blocked sign-in. Allow popups for this site and retry.",
    "auth/popup-closed-by-user":"Google sign-in was closed before completion.",
    "auth/unauthorized-domain":"This app's domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed":"This sign-in method is not enabled in Firebase Authentication.",
  };
  return messages[code] ?? (firebaseConfigured ? "Authentication could not be completed. Check your configuration or try again." : "Firebase Authentication is not configured. Ask the deployment administrator to complete setup.");
}
