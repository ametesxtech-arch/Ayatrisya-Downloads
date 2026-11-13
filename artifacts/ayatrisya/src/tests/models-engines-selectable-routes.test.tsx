import React from 'react';
// @ts-ignore
globalThis.React = React;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModelsAndEnginesPage, REMOTE_PROVIDERS } from '../pages/workspace/ModelsAndEngines';

// In-memory mock localStorage
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};

vi.stubGlobal('localStorage', mockLocalStorage);

// Mock desktop runtime
vi.mock('@/desktop/use-runtime', () => ({
  useDesktopRuntime: () => ({
    desktop: null,
    checking: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-prefs', () => ({
  useCaps: () => ({ caps: [] }),
  usePrefs: () => ({ prefs: { theme: 'dark' } }),
}));

vi.mock('@/ai/client', () => ({
  modelClient: {
    getConnectionHealth: vi.fn().mockResolvedValue({ message: 'Online' }),
    getModelCapabilities: vi.fn().mockResolvedValue([]),
  },
}));

describe('Models & Engines - Selectable Inference Routes & Custom Remote Provider API Key', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('renders all 4 inference route cards with titles, badges, and selection targets', () => {
    const notify = vi.fn();
    const goto = vi.fn();
    const html = renderToStaticMarkup(<ModelsAndEnginesPage goto={goto} notify={notify} />);

    expect(html).toContain('Inference Route &amp; Connectivity Policy');
    expect(html).toContain('Local Only (Offline)');
    expect(html).toContain('Offline Safe');
    expect(html).toContain('Ayatrisya Cloud');
    expect(html).toContain('Hosted Server');
    expect(html).toContain('Custom Remote');
    expect(html).toContain('Ask Each Time');
    expect(html).toContain('Consent Enforced');
  });

  it('contains comprehensive remote provider presets for remote inference', () => {
    expect(REMOTE_PROVIDERS.length).toBeGreaterThanOrEqual(8);
    const ids = REMOTE_PROVIDERS.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('groq');
    expect(ids).toContain('deepseek');
    expect(ids).toContain('mistral');
    expect(ids).toContain('together');
    expect(ids).toContain('huggingface');
  });

  it('displays the Custom Remote provider drawer when routing policy is set to custom-remote', () => {
    mockLocalStorage.setItem('ayatrisya_inference_routing_policy', 'custom-remote');
    const notify = vi.fn();
    const goto = vi.fn();
    const html = renderToStaticMarkup(<ModelsAndEnginesPage goto={goto} notify={notify} />);

    expect(html).toContain('Custom Remote Provider &amp; API Key Configuration');
    expect(html).toContain('Select AI Provider:');
    expect(html).toContain('Provider API Key is required for Custom Remote route.');
    expect(html).toContain('Save Configuration');
    expect(html).toContain('Test Connection');
  });

  it('shows Key Active badge when an API key is present in localStorage', () => {
    mockLocalStorage.setItem('ayatrisya_inference_routing_policy', 'custom-remote');
    mockLocalStorage.setItem('ayatrisya_custom_remote_api_key', 'sk-test-live-key-123456');
    const notify = vi.fn();
    const goto = vi.fn();
    const html = renderToStaticMarkup(<ModelsAndEnginesPage goto={goto} notify={notify} />);

    expect(html).toContain('Key Active');
    expect(html).not.toContain('Provider API Key is required for Custom Remote route.');
  });
});
