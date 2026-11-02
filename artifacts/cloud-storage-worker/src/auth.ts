// Server-Side Firebase Auth & Session Token Verifier for Cloudflare Workers
// Implements JWKS verification against https://securetoken.google.com/ayatrisya

import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export interface AuthContext {
  uid: string;
  email?: string;
}

export async function verifyWorkerAuth(
  request: Request,
  firebaseProjectId = "ayatrisya",
  sessionSecret?: string
): Promise<{ ok: true; auth: AuthContext } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Authentication required. Provide a valid Bearer token." };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, error: "Empty authorization token." };
  }

  // 1. Try Firebase ID Token verification
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    });

    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid || !/^[\w-]{1,128}$/.test(uid)) {
      return { ok: false, status: 401, error: "Invalid Firebase token identity." };
    }

    return {
      ok: true,
      auth: {
        uid,
        email: typeof payload.email === "string" ? payload.email : undefined,
      },
    };
  } catch (firebaseErr) {
    // 2. Try Ayatrisya Desktop session secret verification (fallback for desktop client)
    if (sessionSecret) {
      try {
        const secretBytes = new TextEncoder().encode(sessionSecret);
        const { payload } = await jwtVerify(token, secretBytes, {
          issuer: "ayatrisya-api",
          audience: "ayatrisya-desktop",
        });

        const uid = typeof payload.sub === "string" ? payload.sub : "";
        if (uid && /^[\w-]{1,128}$/.test(uid)) {
          return {
            ok: true,
            auth: {
              uid,
              email: typeof payload.email === "string" ? payload.email : undefined,
            },
          };
        }
      } catch {
        // Fall through to invalid session
      }
    }

    return {
      ok: false,
      status: 401,
      error: "Your sign-in session expired or is invalid. Sign in again to access cloud storage.",
    };
  }
}
