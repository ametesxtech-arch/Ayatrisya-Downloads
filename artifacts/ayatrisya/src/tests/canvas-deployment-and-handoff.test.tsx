import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCanvasAppUrl,
  isAllowedCanvasOrigin,
  openCanvasWithAuth,
  ensureCanvasHandoffListener,
  broadcastSignOutToCanvas,
  createHandshakeTicketForCanvas,
  appendTicketToUrl,
  ALLOWED_CANVAS_ORIGINS,
} from '@/lib/canvasHandoff';

describe('Ayatrisya Canvas Deployment and Auth Handoff Protocol', () => {
  let originalWindow: typeof globalThis.window;
  let mockWindow: any;
  let messageListeners: Array<(event: any) => void> = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    originalWindow = globalThis.window;
    messageListeners = [];

    mockWindow = {
      open: vi.fn(),
      addEventListener: vi.fn((event: string, cb: any) => {
        if (event === 'message') messageListeners.push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: any) => {
        if (event === 'message') {
          messageListeners = messageListeners.filter((l) => l !== cb);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        for (const listener of messageListeners) {
          listener(event);
        }
        return true;
      }),
    };
    (globalThis as any).window = mockWindow;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('Canvas URL and Origin Validation', () => {
    it('defaults to the deployed Firebase Hosting URL for Canvas', () => {
      const url = getCanvasAppUrl();
      expect(url).toBe('https://ayatrisya-canvas.web.app');
    });

    it('accepts designated Canvas origins', () => {
      expect(isAllowedCanvasOrigin('https://ayatrisya-canvas.web.app')).toBe(true);
      expect(isAllowedCanvasOrigin('https://canvas.ayatrisya.web.app')).toBe(true);
      expect(isAllowedCanvasOrigin('https://ayatrisya-canvas.firebaseapp.com')).toBe(true);
      expect(isAllowedCanvasOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedCanvasOrigin('http://localhost:5173')).toBe(true);
    });

    it('rejects untrusted or malicious origins', () => {
      expect(isAllowedCanvasOrigin('https://evil-attacker.com')).toBe(false);
      expect(isAllowedCanvasOrigin('https://phishing-ayatrisya.com')).toBe(false);
      expect(isAllowedCanvasOrigin('https://canvas.attacker.com')).toBe(false);
      expect(isAllowedCanvasOrigin('null')).toBe(false);
      expect(isAllowedCanvasOrigin('')).toBe(false);
    });
  });

  describe('Canvas Launch and Handshake Mechanics', () => {
    it('opens Canvas in a new browser tab with one-time nonce and NO credentials in the URL', () => {
      let openedUrl = '';
      let target = '';
      mockWindow.open.mockImplementation((url: string, t: string) => {
        openedUrl = String(url);
        target = String(t);
        return {
          closed: false,
          postMessage: vi.fn(),
        };
      });

      const win = openCanvasWithAuth();
      expect(win).not.toBeNull();
      expect(target).toBe('_blank');

      const parsedUrl = new URL(openedUrl);
      expect(parsedUrl.origin).toBe('https://ayatrisya-canvas.web.app');
      expect(parsedUrl.searchParams.get('handoff')).toBe('1');

      const nonce = parsedUrl.searchParams.get('nonce');
      expect(nonce).toBeDefined();
      expect(nonce!.length).toBeGreaterThan(10);

      // CRITICAL SECURITY REQUIREMENT: No tokens, credentials, or secrets in URL
      expect(parsedUrl.searchParams.get('token')).toBeNull();
      expect(parsedUrl.searchParams.get('idToken')).toBeNull();
      expect(parsedUrl.searchParams.get('apiKey')).toBeNull();
      expect(parsedUrl.searchParams.get('auth')).toBeNull();
      expect(parsedUrl.searchParams.get('user')).toBeNull();
    });

    it('handles custom target subpaths safely', () => {
      let openedUrl = '';
      mockWindow.open.mockImplementation((url: string) => {
        openedUrl = String(url);
        return { closed: false, postMessage: vi.fn() };
      });

      openCanvasWithAuth('/settings');
      const parsedUrl = new URL(openedUrl);
      expect(parsedUrl.pathname).toBe('/settings');
      expect(parsedUrl.searchParams.get('handoff')).toBe('1');
    });

    it('enforces single-use nonce for the auth handshake', async () => {
      let openedUrl = '';
      const mockPostMessage = vi.fn();
      mockWindow.open.mockImplementation((url: string) => {
        openedUrl = String(url);
        return { closed: false, postMessage: mockPostMessage };
      });

      openCanvasWithAuth();
      const parsedUrl = new URL(openedUrl);
      const nonce = parsedUrl.searchParams.get('nonce')!;

      // Simulate handshake request from Canvas
      const messageEvent = {
        origin: 'https://ayatrisya-canvas.web.app',
        data: {
          type: 'AYATRISYA_CANVAS_AUTH_REQUEST',
          nonce,
        },
        source: {
          postMessage: mockPostMessage,
          closed: false,
        },
      };

      mockWindow.dispatchEvent(messageEvent);

      // Wait a tick for async token retrieval
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const [responsePayload, targetOrigin] = mockPostMessage.mock.calls[0];

      expect(responsePayload.type).toBe('AYATRISYA_CANVAS_AUTH_RESPONSE');
      expect(responsePayload.nonce).toBe(nonce);
      expect(targetOrigin).toBe('https://ayatrisya-canvas.web.app'); // NEVER '*'

      // Attempting to reuse the exact same nonce MUST be rejected
      mockPostMessage.mockClear();
      mockWindow.dispatchEvent(messageEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('rejects handshake requests originating from disallowed origins', async () => {
      let openedUrl = '';
      const mockPostMessage = vi.fn();
      mockWindow.open.mockImplementation((url: string) => {
        openedUrl = String(url);
        return { closed: false, postMessage: mockPostMessage };
      });

      openCanvasWithAuth();
      const parsedUrl = new URL(openedUrl);
      const nonce = parsedUrl.searchParams.get('nonce')!;

      // Malicious origin attempting handshake
      const messageEvent = {
        origin: 'https://malicious-site.com',
        data: {
          type: 'AYATRISYA_CANVAS_AUTH_REQUEST',
          nonce,
        },
        source: {
          postMessage: mockPostMessage,
          closed: false,
        },
      };

      mockWindow.dispatchEvent(messageEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('Sign-out Synchronization', () => {
    it('dispatches sign-out synchronization to opened Canvas instances', () => {
      const mockPostMessage = vi.fn();
      mockWindow.open.mockImplementation(() => {
        return {
          closed: false,
          postMessage: mockPostMessage,
        };
      });

      openCanvasWithAuth();
      broadcastSignOutToCanvas();

      expect(mockPostMessage).toHaveBeenCalled();
      const calledWithSignOut = mockPostMessage.mock.calls.some(([msg]: [any]) => msg?.type === 'AYATRISYA_AUTH_SIGNOUT');
      expect(calledWithSignOut).toBe(true);
    });
  });

  describe('Single-Use Ticket Handoff for Direct Canvas Access', () => {
    it('appends ticket code cleanly to target Canvas URL', () => {
      const target = 'https://canvas.ayatrisya.web.app/workspace/project_abc';
      const urlWithCode = appendTicketToUrl(target, 'cac_mock_code_123');
      expect(urlWithCode).toBe('https://canvas.ayatrisya.web.app/workspace/project_abc?code=cac_mock_code_123');
    });

    it('generates a single-use Canvas ticket for authenticated user', async () => {
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url.includes('/api/auth/canvas/ticket')) {
          return new Response(JSON.stringify({ code: 'cac_generated_ticket_456', expiresInSeconds: 60 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not found', { status: 404 });
      }));

      const mockUser = {
        uid: 'user_123',
        email: 'user@ayatrisya.ai',
        displayName: 'User',
        getIdToken: async () => 'mock_token',
      } as any;

      const code = await createHandshakeTicketForCanvas('https://canvas.ayatrisya.web.app', mockUser);
      expect(code).toBe('cac_generated_ticket_456');
    });

    it('rejects ticket generation for untrusted origin', async () => {
      const mockUser = {
        uid: 'user_123',
        getIdToken: async () => 'mock_token',
      } as any;

      const code = await createHandshakeTicketForCanvas('https://evil-site.com', mockUser);
      expect(code).toBeNull();
    });
  });
});
