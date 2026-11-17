import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { verifiedFirebaseUid } from "../lib/firebase-auth";

const router: IRouter = Router();

export const ALLOWED_CANVAS_ORIGINS = [
  "https://ayatrisya-canvas.web.app",
  "https://ayatrisya-canvas.firebaseapp.com",
  "https://canvas.ayatrisya.web.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

export function isAllowedCanvasOrigin(origin: string | undefined): boolean {
  if (!origin || typeof origin !== "string") return false;
  if (ALLOWED_CANVAS_ORIGINS.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if ((host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) && host.includes("canvas")) {
      return true;
    }
  } catch {}
  return false;
}

export interface CanvasAuthTicket {
  code: string;
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  targetOrigin: string;
  returnPath?: string;
  idToken: string;
  expiresAt: number;
  used: boolean;
}

const TICKET_TTL_MS = 60_000; // 60 seconds strict single-use lifetime
const tickets = new Map<string, CanvasAuthTicket>();

// Periodic cleanup of expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of tickets.entries()) {
    if (entry.expiresAt <= now) {
      tickets.delete(code);
    }
  }
}, 30_000).unref();

export function clearAllCanvasTickets(): void {
  tickets.clear();
}

/**
 * Initiated by the authenticated main Ayatrisya application.
 * Issues a cryptographically secure, short-lived, single-use ticket
 * to hand off the user's verified identity to Canvas.
 */
router.post("/auth/canvas/ticket", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res);
  if (!uid) return;

  const authHeader = req.headers.authorization || "";
  const rawIdToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!rawIdToken) {
    res.status(401).json({ error: "Missing Bearer token." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  const rawTarget = body?.targetOrigin || req.query?.targetOrigin || "https://ayatrisya-canvas.web.app";
  const targetOrigin = String(rawTarget).trim().replace(/\/+$/, "");

  if (!isAllowedCanvasOrigin(targetOrigin)) {
    res.status(400).json({ error: "Invalid target Canvas origin." });
    return;
  }

  const returnPath = typeof body?.returnPath === "string" ? body.returnPath.trim() : undefined;
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : undefined;
  const photoURL = typeof body?.photoURL === "string" ? body.photoURL.trim() : undefined;

  const code = `cac_${randomBytes(32).toString("base64url")}`;
  const now = Date.now();
  const expiresAt = now + TICKET_TTL_MS;

  tickets.set(code, {
    code,
    uid,
    email,
    displayName,
    photoURL,
    targetOrigin,
    returnPath,
    idToken: rawIdToken,
    expiresAt,
    used: false,
  });

  res.status(200).json({
    code,
    expiresInSeconds: 60,
    targetOrigin,
  });
});

/**
 * Initiated by Canvas upon loading with a one-time code.
 * Immediately invalidates the single-use ticket and returns the credentials.
 */
router.post("/auth/canvas/exchange", async (req: Request, res: Response) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code || !code.startsWith("cac_")) {
    res.status(400).json({ error: "A valid authorization code is required." });
    return;
  }

  const ticket = tickets.get(code);
  if (!ticket) {
    res.status(401).json({ error: "Invalid, expired, or already consumed Canvas authorization code." });
    return;
  }

  // Strictly single-use: delete immediately
  tickets.delete(code);

  if (ticket.used || Date.now() > ticket.expiresAt) {
    res.status(401).json({ error: "Canvas authorization code has expired or was already consumed." });
    return;
  }

  ticket.used = true;

  // Validate request origin if present
  const reqOrigin = req.headers.origin;
  if (reqOrigin && !isAllowedCanvasOrigin(reqOrigin)) {
    res.status(403).json({ error: "Origin not permitted for Canvas ticket exchange." });
    return;
  }

  res.status(200).json({
    user: {
      uid: ticket.uid,
      email: ticket.email || null,
      displayName: ticket.displayName || null,
      photoURL: ticket.photoURL || null,
    },
    idToken: ticket.idToken,
    expiresAt: ticket.expiresAt,
  });
});

/**
 * Session verification endpoint for Canvas.
 * Confirms whether the provided Firebase ID token is still active.
 */
router.post("/auth/canvas/verify-session", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res);
  if (!uid) return;

  res.status(200).json({
    valid: true,
    uid,
  });
});

export default router;
