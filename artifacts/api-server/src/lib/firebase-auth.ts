import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response } from "express";

const FIREBASE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

type AuthMessages = {
  missing: string;
  unavailable: string;
  invalid: string;
};

const defaultMessages: AuthMessages = {
  missing: "Sign in to Ayatrisya before connecting an account.",
  unavailable: "Firebase authentication is not configured on this service.",
  invalid: "Your sign-in session expired. Sign in again and retry.",
};

export async function verifiedFirebaseUid(
  req: Request,
  res: Response,
  messages: AuthMessages = defaultMessages,
): Promise<string | undefined> {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    res.status(401).json({ error: messages.missing });
    return undefined;
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID ?? "";
  if (!firebaseProjectId) {
    res.status(503).json({ error: messages.unavailable });
    return undefined;
  }

  try {
    const { payload } = await jwtVerify(match[1], FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    });
    if (typeof payload.sub !== "string" || !/^[\w-]{1,128}$/.test(payload.sub)) {
      throw new Error("Invalid Firebase subject.");
    }
    return payload.sub;
  } catch {
    res.status(401).json({ error: messages.invalid });
    return undefined;
  }
}
