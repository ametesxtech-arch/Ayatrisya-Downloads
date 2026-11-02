import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { defaultTrustKernel } from "./trust-kernel";

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

    const issuedAtSec = typeof payload.auth_time === "number"
      ? payload.auth_time
      : typeof payload.iat === "number"
      ? payload.iat
      : Math.floor(Date.now() / 1000);
    const issuedAtMs = issuedAtSec * 1000;

    if (defaultTrustKernel.isUserSessionRevoked(payload.sub, issuedAtMs)) {
      defaultTrustKernel.logEvent({
        userId: payload.sub,
        role: "user",
        action: "session_validation",
        resource: "auth:session",
        decision: "deny",
        reason: "Session has been revoked on server.",
      });
      res.status(401).json({ error: messages.invalid });
      return undefined;
    }

    return payload.sub;
  } catch (firebaseErr) {
    // Check for guest authorization (e.g. Bearer guest or guest:...)
    if (match[1] === "guest" || match[1].startsWith("guest:")) {
      const clientIp = req.ip || req.socket.remoteAddress || "guest";
      const guestUid = `guest-${clientIp.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      return guestUid;
    }

    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret) {
      try {
        const secret = new TextEncoder().encode(sessionSecret);
        const { payload } = await jwtVerify(match[1], secret, {
          issuer: "ayatrisya-api",
          audience: "ayatrisya-desktop",
        });
        if (typeof payload.sub === "string" && /^[\w-]{1,128}$/.test(payload.sub)) {
          const issuedAtMs = typeof payload.iat === "number" ? payload.iat * 1000 : Date.now();
          if (defaultTrustKernel.isUserSessionRevoked(payload.sub, issuedAtMs)) {
            res.status(401).json({ error: messages.invalid });
            return undefined;
          }
          return payload.sub;
        }
      } catch {}
    }
    res.status(401).json({ error: messages.invalid });
    return undefined;
  }
}
