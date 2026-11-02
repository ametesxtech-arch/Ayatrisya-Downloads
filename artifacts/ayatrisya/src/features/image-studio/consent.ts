/**
 * Cloud Image Generation Consent Manager
 *
 * Enforces explicit, user-controlled consent before sending any image prompts
 * or generation parameters to Ayatrisya's configured cloud image provider.
 *
 * Supported scopes:
 * - "session": valid for the current browser/app tab session only (sessionStorage & in-memory)
 * - "device": persisted locally on this device/browser (localStorage) until revoked
 * - "none": prompts before any cloud generation request
 */

import type { CloudImageConsentScope } from './types';

export const CLOUD_IMAGE_CONSENT_DEVICE_KEY = 'ayatrisya:cloud-image-consent:device:v1';
export const CLOUD_IMAGE_CONSENT_SESSION_KEY = 'ayatrisya:cloud-image-consent:session:v1';

let inMemorySessionConsent = false;

// Event listeners for consent status changes so Settings and Studio react dynamically
const listeners = new Set<(scope: CloudImageConsentScope) => void>();

export function subscribeCloudImageConsent(listener: (scope: CloudImageConsentScope) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  const current = getCloudImageConsentScope();
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Checks the current active consent scope.
 * Device consent takes precedence, followed by active session consent.
 */
export function getCloudImageConsentScope(): CloudImageConsentScope {
  if (typeof window === 'undefined') {
    return inMemorySessionConsent ? 'session' : 'none';
  }

  // 1. Check persistent device consent
  try {
    const deviceRaw = window.localStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY);
    if (deviceRaw) {
      const parsed = JSON.parse(deviceRaw);
      if (parsed && parsed.granted === true && parsed.version === 1) {
        return 'device';
      }
    }
  } catch {
    // Ignore storage errors
  }

  // 2. Check session consent
  if (inMemorySessionConsent) {
    return 'session';
  }

  try {
    const sessionRaw = window.sessionStorage?.getItem(CLOUD_IMAGE_CONSENT_SESSION_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && parsed.granted === true && parsed.version === 1) {
        inMemorySessionConsent = true;
        return 'session';
      }
    }
  } catch {
    // Ignore storage errors
  }

  return 'none';
}

/**
 * Returns true if valid consent (either session or device) is active.
 */
export function hasCloudImageConsent(): boolean {
  return getCloudImageConsentScope() !== 'none';
}

/**
 * Grants cloud image generation consent under the specified scope.
 */
export function grantCloudImageConsent(scope: 'device' | 'session'): void {
  if (scope === 'device') {
    inMemorySessionConsent = true;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          CLOUD_IMAGE_CONSENT_DEVICE_KEY,
          JSON.stringify({ granted: true, scope: 'device', version: 1, grantedAt: Date.now() }),
        );
      } catch {}
    }
  } else if (scope === 'session') {
    inMemorySessionConsent = true;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem(
          CLOUD_IMAGE_CONSENT_SESSION_KEY,
          JSON.stringify({ granted: true, scope: 'session', version: 1, grantedAt: Date.now() }),
        );
      } catch {}
    }
  }
  notifyListeners();
}

/**
 * Revokes all cloud image generation consent (both device and session).
 * Forces the user to be asked again before any future cloud generation.
 */
export function revokeCloudImageConsent(): void {
  inMemorySessionConsent = false;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY);
    } catch {}
    try {
      window.sessionStorage?.removeItem(CLOUD_IMAGE_CONSENT_SESSION_KEY);
    } catch {}
  }
  notifyListeners();
}
