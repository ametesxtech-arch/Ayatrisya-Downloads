import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { SignJWT } from "jose";
import { verifiedFirebaseUid } from "../lib/firebase-auth";

const router: IRouter = Router();

export interface DesktopHandoff {
  uid: string;
  email?: string;
  challenge: string;
  state: string;
  expiresAt: number;
  used: boolean;
}

const HANDOFF_TTL_MS = 60_000; // 60 seconds single-use lifetime
const handoffs = new Map<string, DesktopHandoff>();

// Periodic cleanup of expired handoffs
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of handoffs.entries()) {
    if (entry.expiresAt <= now) {
      handoffs.delete(code);
    }
  }
}, 30_000).unref();

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "ayatrisya_super_secret_session_key_32bytes_min_length_secure";
  return new TextEncoder().encode(secret);
}

/**
 * Initiated by the browser once the user is signed in to Firebase.
 * Generates a short-lived, single-use handoff code bound to the PKCE challenge.
 */
router.post("/auth/desktop/handoff", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res);
  if (!uid) return;

  const { state, challenge } = req.body ?? {};
  if (
    typeof state !== "string" ||
    !/^[a-f0-9]{16,128}$/i.test(state) ||
    typeof challenge !== "string" ||
    !/^[a-zA-Z0-9_-]{40,128}$/.test(challenge)
  ) {
    res.status(400).json({ error: "Invalid state or challenge parameter." });
    return;
  }

  const code = randomBytes(32).toString("hex");
  const email = typeof req.body?.email === "string" ? req.body.email : undefined;

  handoffs.set(code, {
    uid,
    email,
    challenge,
    state,
    expiresAt: Date.now() + HANDOFF_TTL_MS,
    used: false,
  });

  res.status(200).json({ code });
});

/**
 * Initiated by the desktop app when it receives the ayatrisya://auth/callback URL.
 * Exchanges the single-use code + PKCE verifier for a verified session token.
 */
router.post("/auth/desktop/exchange", async (req: Request, res: Response) => {
  const { code, verifier, state } = req.body ?? {};

  if (
    typeof code !== "string" ||
    typeof verifier !== "string" ||
    typeof state !== "string"
  ) {
    res.status(400).json({ error: "Missing required parameters (code, verifier, state)." });
    return;
  }

  const entry = handoffs.get(code);
  if (!entry || entry.expiresAt <= Date.now() || entry.used) {
    res.status(400).json({ error: "The desktop authentication code has expired or was already used." });
    return;
  }

  // Mark used immediately to prevent replay attacks
  entry.used = true;
  handoffs.delete(code);

  // Validate state (CSRF mitigation)
  if (entry.state !== state) {
    res.status(400).json({ error: "Authentication state mismatch." });
    return;
  }

  // Validate PKCE Proof-of-Possession: SHA256(verifier) base64url === challenge
  const computedChallenge = createHash("sha256").update(verifier).digest("base64url");
  if (computedChallenge !== entry.challenge) {
    res.status(401).json({ error: "Invalid PKCE proof of possession." });
    return;
  }

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const token = await new SignJWT({
    sub: entry.uid,
    email: entry.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("ayatrisya-api")
    .setAudience("ayatrisya-desktop")
    .setExpirationTime("30d")
    .sign(getSecretKey());

  res.status(200).json({
    uid: entry.uid,
    email: entry.email,
    token,
    expiresAt,
  });
});

export default router;
