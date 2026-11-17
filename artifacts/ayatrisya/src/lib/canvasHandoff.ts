import { firebaseAuth, firebaseConfigured } from '@/integrations/firebase/client';
import { buildApiUrl } from '@/lib/api-config';
import type { User } from 'firebase/auth';

export const ALLOWED_CANVAS_ORIGINS = [
  'https://canvas.ayatrisya.web.app',
  'https://ayatrisya-canvas.web.app',
  'https://ayatrisya-canvas.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

export function isAllowedCanvasOrigin(origin: string): boolean {
  if (!origin || typeof origin !== 'string') return false;
  if (ALLOWED_CANVAS_ORIGINS.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if ((host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) && host.includes('canvas')) {
      return true;
    }
  } catch {}
  return false;
}

export function getCanvasAppUrl(): string {
  const envUrl = (import.meta.env.VITE_CANVAS_APP_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  return 'https://canvas.ayatrisya.web.app';
}

export function appendTicketToUrl(rawUrl: string, code: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('code', code);
    return url.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}code=${encodeURIComponent(code)}`;
  }
}

export async function createHandshakeTicketForCanvas(
  targetUrl: string,
  user: User,
): Promise<string | null> {
  try {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return null;
    }

    if (!isAllowedCanvasOrigin(parsed.origin)) {
      return null;
    }

    const token = await user.getIdToken();
    const apiUrl = buildApiUrl('/api/auth/canvas/ticket');
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetOrigin: parsed.origin,
        returnPath: parsed.pathname + parsed.search,
        email: user.email || undefined,
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { code?: string };
    return data?.code || null;
  } catch {
    return null;
  }
}

interface PendingHandoff {
  targetOrigin: string;
  createdAt: number;
  expiresAt: number;
}

const pendingNonces = new Map<string, PendingHandoff>();
const activeCanvasWindows = new Set<Window>();
let currentAttachedWindow: (Window & typeof globalThis) | null = null;

export function ensureCanvasHandoffListener(): void {
  if (typeof window === 'undefined') return;
  if (currentAttachedWindow === window) return;
  currentAttachedWindow = window;

  window.addEventListener('message', async (event) => {
    // 1. Strict exact origin validation
    if (!isAllowedCanvasOrigin(event.origin)) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // 2. Process handshake auth request
    if (data.type === 'AYATRISYA_CANVAS_AUTH_REQUEST') {
      const nonce = data.nonce;
      if (typeof nonce !== 'string' || !nonce) return;

      const record = pendingNonces.get(nonce);
      if (!record) {
        // Nonce not found, already consumed, or expired
        return;
      }

      // Strictly single-use nonce
      pendingNonces.delete(nonce);

      if (Date.now() > record.expiresAt) {
        return;
      }

      // 3. Acquire short-lived Firebase ID token
      let idToken: string | null = null;
      let userSummary: {
        uid: string;
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
      } | null = null;

      try {
        if (firebaseConfigured) {
          const auth = firebaseAuth();
          const currentUser = auth.currentUser;
          if (currentUser) {
            idToken = await currentUser.getIdToken(false);
            userSummary = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
            };
          }
        }
      } catch {
        // Safe: failure simply transmits null auth without throwing or leaking
      }

      const sourceWin = event.source as Window | null;
      if (sourceWin && !sourceWin.closed) {
        // 4. Send response with explicit target origin (NEVER '*')
        sourceWin.postMessage({
          type: 'AYATRISYA_CANVAS_AUTH_RESPONSE',
          nonce,
          user: userSummary,
          idToken,
        }, event.origin);
      }
    }
  });
}

export function openCanvasWithAuth(targetPath?: string): Window | null {
  ensureCanvasHandoffListener();

  const baseUrl = getCanvasAppUrl();
  const nonce = crypto.randomUUID();
  let targetUrl: URL;
  try {
    targetUrl = new URL(baseUrl);
  } catch {
    targetUrl = new URL('https://ayatrisya-canvas.web.app');
  }

  if (targetPath) {
    targetUrl.pathname = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  }

  // Pure nonce query params; no credentials, tokens, or personal info in the URL
  targetUrl.searchParams.set('handoff', '1');
  targetUrl.searchParams.set('nonce', nonce);

  const targetOrigin = targetUrl.origin;
  const now = Date.now();
  pendingNonces.set(nonce, {
    targetOrigin,
    createdAt: now,
    expiresAt: now + 45_000,
  });

  // Clean expired nonces
  for (const [key, val] of pendingNonces.entries()) {
    if (now > val.expiresAt) {
      pendingNonces.delete(key);
    }
  }

  // Open in new tab (window.opener preserved for postMessage handshake)
  const opened = window.open(targetUrl.toString(), '_blank');
  if (opened) {
    activeCanvasWindows.add(opened);
  }
  return opened;
}

export function broadcastSignOutToCanvas(): void {
  // 1. Synchronize to open child tabs
  for (const win of activeCanvasWindows) {
    try {
      if (!win.closed) {
        for (const origin of ALLOWED_CANVAS_ORIGINS) {
          win.postMessage({ type: 'AYATRISYA_AUTH_SIGNOUT' }, origin);
        }
      } else {
        activeCanvasWindows.delete(win);
      }
    } catch {
      activeCanvasWindows.delete(win);
    }
  }

  // 2. BroadcastChannel for cross-tab notifications
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('ayatrisya_canvas_auth');
      channel.postMessage({ type: 'AYATRISYA_AUTH_SIGNOUT' });
      channel.close();
    }
  } catch {}
}
