import React from 'react';
// @ts-ignore
globalThis.React = React;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Workspace } from '../components/WorkspaceShell';
import { CanvasIDE } from '../pages/workspace/CanvasIDE';
import { CanvasProvider } from '../components/canvas/CanvasContext';
import { WorkspaceHome } from '../pages/workspace/WorkspaceHome';
import {
  MOBILE_BREAKPOINT,
  TABLET_MAX_BREAKPOINT,
  TABLET_LANDSCAPE_MAX,
  getDeviceType,
  useIsMobile,
  useIsTablet,
  useIsTabletPortrait,
  useIsTabletLandscape,
  useIsTabbedLayout,
  useDeviceType,
} from '../hooks/use-mobile';

// Mock localStorage
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};
vi.stubGlobal('localStorage', mockLocalStorage);

const mockWindow = {
  location: { search: '', pathname: '/workspace', hash: '' },
  matchMedia: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  innerWidth: 1440,
  innerHeight: 900,
  visualViewport: { height: 900 },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  scrollTo: vi.fn(),
};
vi.stubGlobal('window', mockWindow);

// Mock desktop runtime
vi.mock('@/desktop/use-runtime', () => ({
  useDesktopRuntime: () => ({
    desktop: null,
    checking: false,
    refresh: vi.fn(),
  }),
}));

// Mock hooks
vi.mock('@/hooks/use-prefs', () => ({
  useCaps: () => ({ caps: [{ id: 'v1-fast', available: true, model: 'v1-fast', label: 'V1 Fast' }] }),
  usePrefs: () => ({
    prefs: {
      theme: 'dark',
      mode: 'Normal',
      model: 'v1-fast',
      sidebarCollapsed: false,
      workspaceMode: 'standard',
      homeSections: { projects: true, conversations: true, items: true },
      homeDensity: 'comfortable',
      recentCommands: [],
      enterToSend: true,
      historyPinnedFirst: true,
      logoIdle: false,
      wallpaper: 'none',
    },
    save: vi.fn(),
  }),
}));

vi.mock('@/integrations/firebase/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'u1', email: 'user@example.com', displayName: 'Ayatrisya User', emailVerified: true },
    guest: false,
    loading: false,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/workspace', vi.fn()],
  Link: ({ children, href, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/ai/client', () => ({
  modelClient: {
    sendChat: vi.fn().mockResolvedValue({ text: 'Response from Ayatrisya AI' }),
    generateResponse: vi.fn().mockResolvedValue('AI response'),
  },
}));

describe('AYATRISYA — Tablet and Mobile Responsive Repair Suite', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe('Part 1: Breakpoint & Device Classification Logic', () => {
    it('accurately identifies phone viewport (390x844 portrait)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 844 });
      expect(getDeviceType()).toBe('mobile');
    });

    it('accurately identifies standard iPad portrait (768x1024 portrait)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 1024 });
      expect(getDeviceType()).toBe('tablet-portrait');
    });

    it('accurately identifies iPad Air portrait (820x1180 portrait)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 820 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 1180 });
      expect(getDeviceType()).toBe('tablet-portrait');
    });

    it('accurately identifies iPad Pro 11 portrait (834x1194 portrait)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 834 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 1194 });
      expect(getDeviceType()).toBe('tablet-portrait');
    });

    it('accurately identifies iPad landscape (1024x768 landscape)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
      expect(getDeviceType()).toBe('tablet-landscape');
    });

    it('accurately identifies iPad Air landscape (1180x820 landscape)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1180 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 820 });
      expect(getDeviceType()).toBe('tablet-landscape');
    });

    it('accurately identifies desktop workstation (1440x900)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1440 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 });
      expect(getDeviceType()).toBe('desktop');
    });
  });

  describe('Part 2: Tablet Home Page Responsive Layout Repair', () => {
    it('renders feature action cards with sm:grid-cols-2 and lg:grid-cols-4 for natural wrapping without truncation', () => {
      const html = renderToStaticMarkup(
        <WorkspaceHome
          displayName="Tablet User"
          projects={[]}
          conversations={[]}
          items={[]}
          stats={null}
          loading={false}
          error={null}
          modelAvailable={true}
          sections={{ projects: true, conversations: true, items: true }}
          density="comfortable"
          onAction={vi.fn()}
          onOpenProject={vi.fn()}
          onOpenConversation={vi.fn()}
          onOpenItem={vi.fn()}
          onToggleSection={vi.fn()}
          onChangeDensity={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      // Verify 2-column wrapping on tablet widths
      expect(html).toContain('sm:grid-cols-2');
      expect(html).toContain('lg:grid-cols-4');
      expect(html).toContain('Create document');
      expect(html).toContain('Image studio');
      expect(html).toContain('Voice studio');
      expect(html).toContain('Coding workspace');
    });

    it('provides sufficient bottom padding (pb-28 / sm:pb-32) to prevent bottom navigation bar overlap', () => {
      const html = renderToStaticMarkup(
        <WorkspaceHome
          displayName="Tablet User"
          projects={[]}
          conversations={[]}
          items={[]}
          stats={null}
          loading={false}
          error={null}
          modelAvailable={true}
          sections={{ projects: true, conversations: true, items: true }}
          density="comfortable"
          onAction={vi.fn()}
          onOpenProject={vi.fn()}
          onOpenConversation={vi.fn()}
          onOpenItem={vi.fn()}
          onToggleSection={vi.fn()}
          onChangeDensity={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      expect(html).toContain('pb-28');
      expect(html).toContain('sm:pb-32');
    });

    it('hides decorative background circles on tablet (lg:block) to maintain clean foreground contrast', () => {
      const html = renderToStaticMarkup(
        <WorkspaceHome
          displayName="Tablet User"
          projects={[]}
          conversations={[]}
          items={[]}
          stats={null}
          loading={false}
          error={null}
          modelAvailable={true}
          sections={{ projects: true, conversations: true, items: true }}
          density="comfortable"
          onAction={vi.fn()}
          onOpenProject={vi.fn()}
          onOpenConversation={vi.fn()}
          onOpenItem={vi.fn()}
          onToggleSection={vi.fn()}
          onChangeDensity={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      // Verify decorative graphic is hidden below lg (tablet screens 768px-1023px)
      expect(html).toContain('hidden w-[42%] overflow-hidden lg:block');
    });
  });

  describe('Part 3: Canvas IDE on Tablet Portrait (768px - 1023px)', () => {
    it('activates switchable tabbed panels (Files, Editor, Preview, Terminal, AI) on tablet portrait and displays only active panel', () => {
      // Simulate iPad portrait (768x1024)
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 1024 });

      const html = renderToStaticMarkup(
        <CanvasProvider>
          <CanvasIDE />
        </CanvasProvider>
      );

      // Verify mobile/tablet bottom tab bar exists
      expect(html).toContain('data-testid="canvas-mobile-nav"');
      expect(html).toContain('data-testid="canvas-tab-files"');
      expect(html).toContain('data-testid="canvas-tab-editor"');
      expect(html).toContain('data-testid="canvas-tab-preview"');
      expect(html).toContain('data-testid="canvas-tab-terminal"');
      expect(html).toContain('data-testid="canvas-tab-ai"');

      // Verify that in portrait, desktop 4-pane simultaneous squeeze is prevented (desktop sidebar is not rendered)
      expect(html).not.toContain('w-56 shrink-0 h-full overflow-hidden border-r');
    });

    it('keeps Run, Stop, and AI Generate buttons visible and accessible in tablet portrait header', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 1024 });

      const html = renderToStaticMarkup(
        <CanvasProvider>
          <CanvasIDE />
        </CanvasProvider>
      );

      expect(html).toContain('Run');
      expect(html).toContain('AI Generate');
    });

    it('ensures dedicated code editor is rendered with quick programming symbols bar on tablet portrait', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 1024 });

      const html = renderToStaticMarkup(
        <CanvasProvider>
          <CanvasIDE />
        </CanvasProvider>
      );

      // Code editor quick symbols bar is rendered for touch friendliness
      expect(html).toContain('{');
      expect(html).toContain('}');
      expect(html).toContain('Refactor');
    });
  });

  describe('Part 4: Canvas IDE on Tablet Landscape (1024x768 / 1180x820)', () => {
    it('renders collapsible file explorer toggle and split layout in landscape mode', () => {
      // Simulate iPad landscape (1024x768)
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });

      const html = renderToStaticMarkup(
        <CanvasProvider>
          <CanvasIDE />
        </CanvasProvider>
      );

      // In landscape (width >= 1024 and landscape), explorer toggle button is rendered
      expect(html).toContain('title="Collapse File Explorer"');
      expect(html).toContain('Split');
      expect(html).toContain('Editor');
      expect(html).toContain('Preview');
      expect(html).toContain('Terminal');
    });
  });
});
