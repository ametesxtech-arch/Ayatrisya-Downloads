/**
 * Session-scoped AI Model Data-Transfer Consent Manager
 *
 * Implements privacy-preserving, session-scoped consent for sending
 * conversation text and attachments to the configured Ayatrisya model connection.
 *
 * Key behaviors:
 * 1. Prompts on the first request of a session.
 * 2. Remembers the user's decision for the active browser/app session.
 * 3. Never treats closing the dialog or "Keep local only" as consent.
 * 4. Respects the "Do not ask again until I reload this page" guarantee:
 *    reloading the page terminates consent suppression.
 * 5. Uses versioned sessionStorage; never uses permanent localStorage.
 */

export const MODEL_CONSENT_SESSION_KEY = 'ayatrisya:model-consent:v1';

let inMemoryConsent = false;
let pageInstanceId = generatePageInstanceId();

function generatePageInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface GrantConsentOptions {
  /**
   * If true (default), consent is scoped to this page session and ends when the page is reloaded.
   * If false, consent is granted only in-memory for the active session and not stored in sessionStorage.
   */
  rememberUntilReload?: boolean;
}

/**
 * Checks whether model data-transfer consent is currently active for this session.
 */
export function hasModelConsent(): boolean {
  if (inMemoryConsent) return true;
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return inMemoryConsent;
  }

  try {
    const raw = sessionStorage.getItem(MODEL_CONSENT_SESSION_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.granted) return false;

    // Verify whether consent belongs to the current page instance.
    // If it was tagged with a pageInstanceId from a previous page load that has reloaded,
    // consent suppression ends on page reload as promised in the UI.
    if (!data.pageInstanceId || data.pageInstanceId !== pageInstanceId) {
      sessionStorage.removeItem(MODEL_CONSENT_SESSION_KEY);
      inMemoryConsent = false;
      return false;
    }

    inMemoryConsent = true;
    return true;
  } catch {
    return inMemoryConsent;
  }
}

/**
 * Grants model data-transfer consent for the current session.
 */
export function grantModelConsent(options: GrantConsentOptions = {}): void {
  inMemoryConsent = true;

  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    if (options.rememberUntilReload === false) {
      // User unchecked "Do not ask again until I reload this page":
      // In-memory consent handles the active session without persisting to sessionStorage.
      sessionStorage.removeItem(MODEL_CONSENT_SESSION_KEY);
      return;
    }

    const payload = {
      version: 1,
      granted: true,
      pageInstanceId,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(MODEL_CONSENT_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Storage quota or security error fallback
  }
}

/**
 * Revokes consent and clears session storage.
 */
export function revokeModelConsent(): void {
  inMemoryConsent = false;
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(MODEL_CONSENT_SESSION_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * Testing helper: resets in-memory consent and optionally simulates page reload.
 */
export function _resetConsentForTesting(options?: { simulateReload?: boolean }): void {
  inMemoryConsent = false;
  if (options?.simulateReload) {
    pageInstanceId = generatePageInstanceId();
  } else {
    revokeModelConsent();
  }
}
