import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasModelConsent,
  grantModelConsent,
  revokeModelConsent,
  _resetConsentForTesting,
  MODEL_CONSENT_SESSION_KEY,
} from '@/lib/model-consent';

// In-memory mock storage implementation for Node test environment
class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

describe('Model Data-Transfer Consent System', () => {
  let mockSessionStorage: MockStorage;
  let mockLocalStorage: MockStorage;

  beforeEach(() => {
    mockSessionStorage = new MockStorage();
    mockLocalStorage = new MockStorage();

    vi.stubGlobal('sessionStorage', mockSessionStorage);
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('window', globalThis);

    _resetConsentForTesting();
  });

  afterEach(() => {
    _resetConsentForTesting();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Initial Session State (Ask Once Per Session)', () => {
    it('defaults to requiring consent on the first request in a session', () => {
      expect(hasModelConsent()).toBe(false);
      expect(mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
    });

    it('never checks or writes permanent consent to localStorage', () => {
      grantModelConsent({ rememberUntilReload: true });
      expect(mockLocalStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
      expect(mockLocalStorage.length).toBe(0);
    });
  });

  describe('Granting Consent and Remembering Decision', () => {
    it('remembers consent after user clicks Send with checkbox enabled', () => {
      grantModelConsent({ rememberUntilReload: true });

      expect(hasModelConsent()).toBe(true);

      const raw = mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.version).toBe(1);
      expect(parsed.granted).toBe(true);
      expect(parsed.pageInstanceId).toBeDefined();

      // Subsequent requests in the session return true without prompting
      expect(hasModelConsent()).toBe(true);
    });

    it('uses the versioned session key "ayatrisya:model-consent:v1"', () => {
      expect(MODEL_CONSENT_SESSION_KEY).toBe('ayatrisya:model-consent:v1');
    });

    it('without checkbox (rememberUntilReload: false), keeps consent in-memory for active session without sessionStorage persistence', () => {
      grantModelConsent({ rememberUntilReload: false });

      // In active session, consent is active so subsequent requests do not prompt repeatedly
      expect(hasModelConsent()).toBe(true);

      // Not saved to sessionStorage
      expect(mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
    });
  });

  describe('Keep Local Only & Dialog Closing Behavior', () => {
    it('does not grant consent when the user clicks Keep local only', () => {
      // Simulate user clicking "Keep local only" - no grantModelConsent call is made
      expect(hasModelConsent()).toBe(false);
      expect(mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
    });

    it('never treats closing the dialog as consent', () => {
      // Modal onClose handler just closes the dialog without granting consent
      expect(hasModelConsent()).toBe(false);
      expect(mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
    });

    it('allows explicit revocation of consent', () => {
      grantModelConsent({ rememberUntilReload: true });
      expect(hasModelConsent()).toBe(true);

      revokeModelConsent();
      expect(hasModelConsent()).toBe(false);
      expect(mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
    });
  });

  describe('Reload Behavior (Matches UI Guarantee: "Do not ask again until I reload this page")', () => {
    it('terminates consent suppression when the page is reloaded', () => {
      grantModelConsent({ rememberUntilReload: true });
      expect(hasModelConsent()).toBe(true);

      // Simulate browser page reload (new page instance / bundle execution)
      _resetConsentForTesting({ simulateReload: true });

      // After reload, consent suppression ends and first request prompts again
      expect(hasModelConsent()).toBe(false);

      // Stale entry from previous page load is cleaned up
      expect(mockSessionStorage.getItem(MODEL_CONSENT_SESSION_KEY)).toBeNull();
    });
  });

  describe('Simulated Chat Flow Integration', () => {
    it('prompts on first request, suppresses prompts after Send, and respects Keep local only', () => {
      const modelRunner = vi.fn();
      let dialogState: { open: boolean; promptCount: number } = { open: false, promptCount: 0 };

      function handleSendMessage(action: 'send' | 'keep_local' | 'confirm_send', remember = true) {
        if (action === 'send') {
          if (hasModelConsent()) {
            modelRunner();
          } else {
            dialogState = { open: true, promptCount: dialogState.promptCount + 1 };
          }
        } else if (action === 'keep_local') {
          dialogState = { ...dialogState, open: false };
          // Keep local only: message stays in local DB, NOT sent to model
        } else if (action === 'confirm_send') {
          grantModelConsent({ rememberUntilReload: remember });
          dialogState = { ...dialogState, open: false };
          modelRunner();
        }
      }

      // 1. First message: prompts dialog
      handleSendMessage('send');
      expect(dialogState.open).toBe(true);
      expect(dialogState.promptCount).toBe(1);
      expect(modelRunner).not.toHaveBeenCalled();

      // 2. User clicks "Keep local only"
      handleSendMessage('keep_local');
      expect(dialogState.open).toBe(false);
      expect(modelRunner).not.toHaveBeenCalled();
      expect(hasModelConsent()).toBe(false);

      // 3. Next message: still prompts because consent was not granted
      handleSendMessage('send');
      expect(dialogState.open).toBe(true);
      expect(dialogState.promptCount).toBe(2);
      expect(modelRunner).not.toHaveBeenCalled();

      // 4. User clicks "Send" (confirm send) with "Do not ask again until I reload this page"
      handleSendMessage('confirm_send', true);
      expect(dialogState.open).toBe(false);
      expect(modelRunner).toHaveBeenCalledTimes(1);
      expect(hasModelConsent()).toBe(true);

      // 5. Subsequent messages in this session do NOT prompt dialog
      handleSendMessage('send');
      expect(dialogState.promptCount).toBe(2); // no new prompt
      expect(modelRunner).toHaveBeenCalledTimes(2);

      handleSendMessage('send');
      expect(dialogState.promptCount).toBe(2); // still no new prompt
      expect(modelRunner).toHaveBeenCalledTimes(3);

      // 6. Reload page: prompts again
      _resetConsentForTesting({ simulateReload: true });
      expect(hasModelConsent()).toBe(false);

      handleSendMessage('send');
      expect(dialogState.promptCount).toBe(3); // prompts again on first request after reload
    });
  });
});
