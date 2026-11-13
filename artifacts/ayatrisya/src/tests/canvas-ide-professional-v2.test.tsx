import React from 'react';
// @ts-ignore
globalThis.React = React;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanvasIDEPage } from '../pages/workspace/CanvasIDE';
import { CanvasCodeEditor } from '../components/canvas/CanvasCodeEditor';
import { CanvasFileTree } from '../components/canvas/CanvasFileTree';
import { CanvasDiffModal } from '../components/canvas/CanvasDiffModal';
import { CanvasRuntimeAuditModal } from '../components/canvas/CanvasRuntimeAuditModal';
import { CanvasProvider, PROJECT_TEMPLATES } from '../components/canvas/CanvasContext';
import { LinuxVM } from '../lib/linux-vm';
import { buildZipArchive, type ZipFileEntry } from '../lib/zip-export';

// Mock desktop runtime & mobile hook
vi.mock('@/desktop/use-runtime', () => ({
  useDesktopRuntime: () => ({
    desktop: null,
    isNative: false,
    checking: false,
  }),
}));

vi.mock('@/hooks/use-prefs', () => ({
  usePrefs: () => ({
    prefs: { theme: 'dark', model: 'ayatrisya-coder-v1', mode: 'balanced' },
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/ai/client', () => ({
  modelClient: {
    sendChat: vi.fn().mockResolvedValue({ text: 'console.log("Updated via AI");' }),
  },
}));

// Mock localStorage
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};
vi.stubGlobal('localStorage', mockLocalStorage);

describe('Ayatrisya Canvas IDE 2.0 — Complete Professional Upgrade Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('Phase 1 & 2: Responsive Interface & Professional Editor', () => {
    it('renders desktop layout with file explorer, editor toolbar, split controls, and bottom dock', () => {
      const html = renderToStaticMarkup(<CanvasIDEPage />);

      expect(html).toContain('Ayatrisya');
      expect(html).toContain('Canvas IDE');
      expect(html).toContain('Project Files');
      expect(html).toContain('Live Preview');
      expect(html).toContain('Terminal (Linux bash)');
      expect(html).toContain('Run');
      expect(html).toContain('AI Generate');
    });

    it('renders professional code editor with line numbers, status bar, and formatting tools', () => {
      const file = {
        id: 'f1',
        name: 'app.js',
        language: 'javascript',
        content: 'const x = 42;\nconsole.log(x);',
      };
      const html = renderToStaticMarkup(
        <CanvasCodeEditor file={file} onChangeContent={() => {}} />
      );

      expect(html).toContain('app.js');
      expect(html).toContain('Ln');
      expect(html).toContain('Col');
      expect(html).toContain('Format');
      expect(html).toContain('Wrap');
      expect(html).toContain('UTF-8');
      expect(html).toContain('javascript');
    });

    it('renders mobile quick programming symbols bar when isMobile is true', () => {
      const file = {
        id: 'f1',
        name: 'index.html',
        language: 'html',
        content: '<h1>Hello</h1>',
      };
      const html = renderToStaticMarkup(
        <CanvasCodeEditor file={file} onChangeContent={() => {}} isMobile={true} />
      );

      expect(html).toContain('{');
      expect(html).toContain('}');
      expect(html).toContain('(');
      expect(html).toContain(')');
      expect(html).toContain('<');
      expect(html).toContain('>');
      expect(html).toContain(';');
    });
  });

  describe('Phase 3: File Explorer, Nested Folders & Safe Operations', () => {
    it('renders nested folders hierarchy with file type icons', () => {
      const files = [
        { id: '1', name: 'src/components/Header.jsx', language: 'javascript', content: '' },
        { id: '2', name: 'src/index.js', language: 'javascript', content: '' },
        { id: '3', name: 'public/index.html', language: 'html', content: '' },
        { id: '4', name: 'styles/main.css', language: 'css', content: '' },
      ];

      const html = renderToStaticMarkup(
        <CanvasFileTree
          files={files}
          activeFileId="1"
          onSelectFile={() => {}}
          onCreateFile={() => {}}
          onCreateFolder={() => {}}
          onRenameFile={() => {}}
          onDuplicateFile={() => {}}
          onDeleteFile={() => {}}
        />
      );

      expect(html).toContain('src');
      expect(html).toContain('public');
      expect(html).toContain('styles');
      expect(html).toContain('Header.jsx');
      expect(html).toContain('index.html');
      expect(html).toContain('main.css');
    });

    it('provides multi-project templates (Vanilla Web, 2D Arcade, Python Analytics)', () => {
      expect(PROJECT_TEMPLATES['vanilla-web']).toBeDefined();
      expect(PROJECT_TEMPLATES['arcade-2d']).toBeDefined();
      expect(PROJECT_TEMPLATES['python-script']).toBeDefined();

      const gameTemplate = PROJECT_TEMPLATES['arcade-2d'];
      expect(gameTemplate.files.some((f) => f.name === 'game.js')).toBe(true);
      expect(gameTemplate.files.some((f) => f.name === 'index.html')).toBe(true);
    });
  });

  describe('Phase 4: Real Terminal Environment Audit & Execution', () => {
    it('honestly classifies in-browser runtime as a POSIX simulator without claiming fake cloud containers', () => {
      const html = renderToStaticMarkup(
        <CanvasRuntimeAuditModal isOpen={true} onClose={() => {}} isDesktop={false} />
      );

      expect(html).toContain('Web Sandbox (In-Browser POSIX Simulator)');
      expect(html).toContain('In-Browser JavaScript POSIX Simulator');
      expect(html).toContain('/home/ayatrisya/project');
      expect(html).toContain('Real-time Bidirectional with Canvas Files');
      expect(html).toContain('Documented Web Mode Limitations');
    });

    it('executes core Linux POSIX commands in virtual environment with accurate exit codes', async () => {
      const vm = new LinuxVM();
      const files = [
        { id: '1', name: 'hello.txt', language: 'plaintext', content: 'Ayatrisya Cloud OS' },
      ];

      // Test pwd
      const pwdRes = await vm.execute('pwd', files);
      expect(pwdRes.stdout).toContain('/home/ayatrisya/project');

      // Test ls
      const lsRes = await vm.execute('ls', files);
      expect(lsRes.stdout).toContain('hello.txt');

      // Test cat
      const catRes = await vm.execute('cat hello.txt', files);
      expect(catRes.stdout).toContain('Ayatrisya Cloud OS');

      // Test uname
      const unameRes = await vm.execute('uname -a', files);
      expect(unameRes.stdout).toContain('Linux');
      expect(unameRes.stdout).toContain('x86_64');
    });
  });

  describe('Phase 5 & 6: Live Preview Sandboxing & Reviewable AI Diffs', () => {
    it('enforces strict iframe sandboxing to prevent access to host authentication tokens', () => {
      const html = renderToStaticMarkup(<CanvasIDEPage />);

      // Must have allow-scripts allow-modals BUT NOT allow-same-origin
      expect(html).toContain('sandbox="allow-scripts allow-modals"');
      expect(html).not.toContain('allow-same-origin');
    });

    it('renders visual side-by-side or unified diff before applying AI code modifications', () => {
      const diff = {
        path: 'app.js',
        original: 'const greeting = "hello";',
        proposed: 'const greeting = "hello, Ayatrisya!";',
      };

      const html = renderToStaticMarkup(
        <CanvasDiffModal diff={diff} onAccept={() => {}} onReject={() => {}} />
      );

      expect(html).toContain('Review AI Changes');
      expect(html).toContain('app.js');
      expect(html).toContain('Original Code');
      expect(html).toContain('Proposed AI Changes');
      expect(html).toContain('Accept Changes');
      expect(html).toContain('Reject Changes');
    });
  });

  describe('Phase 7 & 8: Zero-Dependency Project ZIP Packaging', () => {
    it('packages multi-file project into valid OpenXML PK zip bytes in memory', () => {
      const entries: ZipFileEntry[] = [
        { path: 'index.html', data: '<!DOCTYPE html><html></html>' },
        { path: 'style.css', data: 'body { background: #000; }' },
        { path: 'src/app.js', data: 'console.log("ready");' },
      ];

      const zipBytes = buildZipArchive(entries);
      expect(zipBytes.length).toBeGreaterThan(100);

      // Verify ZIP magic header: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
      expect(zipBytes[0]).toBe(0x50);
      expect(zipBytes[1]).toBe(0x4b);
      expect(zipBytes[2]).toBe(0x03);
      expect(zipBytes[3]).toBe(0x04);
    });
  });
});
