import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Public client-side Firebase web configuration (non-secret project identifiers)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAsTIhiNu7UhTwOh-gfY5exLLIX9qGRtyk",
  authDomain: "ayatrisya.firebaseapp.com",
  projectId: "ayatrisya",
  appId: "1:663542830691:web:70912ddce81c1ecd284a56",
} as const;

export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey)?.trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain)?.trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId)?.trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId)?.trim(),
};
export const firebaseConfigured = Object.values(firebaseConfig).every(v => typeof v === "string" && v.length > 0);
let auth: Auth | undefined;
export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase is not configured for this app.");
  return getApps().find(app=>app.name==="ayatrisya") ?? initializeApp(firebaseConfig,"ayatrisya");
}
export function firebaseAuth(): Auth {
  if (!firebaseConfigured) throw new Error("Firebase Authentication is not configured. Sign in or create an account to continue.");
  auth ??= getAuth(firebaseApp());
  return auth;
}
export function authError(error: unknown): string {
  if (!error) return "";
  const rawCode = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const messageStr = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const code = rawCode || messageStr.match(/auth\/[a-z0-9-]+/i)?.[0]?.toLowerCase() || "";

  // Safe diagnostic logging (excludes passwords, tokens, API keys, or raw secrets)
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    const sanitizedMsg = messageStr
      ? messageStr.replace(/([?&](?:key|token|auth|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
      : undefined;
    console.warn("[Ayatrisya Auth Diagnostic]", {
      name: error instanceof Error ? error.name : typeof error,
      code: code || undefined,
      message: sanitizedMsg,
    });
  }

  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/network-request-failed": "Could not reach Firebase. Check your connection and retry.",
    "auth/too-many-requests": "Too many attempts. Wait a moment before trying again.",
    "auth/popup-blocked": "Your browser blocked sign-in. Allow popups for this site and retry.",
    "auth/popup-closed-by-user": "Sign-in was closed before completion.",
    "auth/account-exists-with-different-credential": "An account already uses this email with a different sign-in method. Sign in with that method first.",
    "auth/unauthorized-domain": "This app's domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase Authentication.",
    "auth/invalid-api-key": "Invalid Firebase configuration API key.",
    "auth/app-deleted": "Firebase instance was deleted.",
    "auth/app-not-authorized": "App is not authorized to use Firebase Authentication.",
    "auth/argument-error": "Authentication configuration argument error.",
    "auth/invalid-user-token": "Your session has expired. Please sign in again.",
    "auth/user-token-expired": "Your session has expired. Please sign in again.",
    "auth/requires-recent-login": "Please sign in again to perform this sensitive action.",
    "auth/quota-exceeded": "Authentication quota exceeded. Please try again later.",
    "auth/admin-restricted-operation": "This operation is restricted by Firebase administrative settings.",
    "auth/internal-error": "Firebase Authentication encountered an internal error. Check your connection or try again.",
    "auth/credential-already-in-use": "This credential is already associated with a different user account.",
    "auth/timeout": "Authentication request timed out. Check your connection and retry.",
  };
  if (code && messages[code]) {
    return messages[code];
  }
  if (code && code.startsWith("auth/")) {
    const formatted = code.replace(/^auth\//, "").replace(/-/g, " ");
    return `Authentication error: ${formatted}.`;
  }

  // Network / fetch failures without a Firebase code
  if (
    error instanceof TypeError &&
    (messageStr.includes("fetch") || messageStr.includes("Network") || messageStr.includes("Failed"))
  ) {
    return "Could not reach Firebase Authentication. Check your network connection and retry.";
  }

  return firebaseConfigured
    ? "Authentication could not be completed. Check your configuration or try again."
    : "Firebase Authentication is not configured. Ask the deployment administrator to complete setup.";
}
