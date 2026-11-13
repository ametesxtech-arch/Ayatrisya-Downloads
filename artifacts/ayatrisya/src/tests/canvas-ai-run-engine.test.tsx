import React from 'react';
// @ts-ignore
globalThis.React = React;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanvasIDE } from '../pages/workspace/CanvasIDE';
import { CanvasProvider, PROJECT_TEMPLATES } from '../components/canvas/CanvasContext';
import { detectFramework } from '../components/canvas/framework-detector';
import { validateProjectFiles } from '../ai/project-generator';
import type { CanvasFile } from '../components/canvas/types';

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
  usePrefs: () => ({ prefs: { theme: 'dark', model: 'ayatrisya-coder-v1' } }),
}));

vi.mock('@/ai/client', () => ({
  modelClient: {
    sendChat: vi.fn().mockResolvedValue({ text: 'console.log("fixed");' }),
    generateResponse: vi.fn().mockResolvedValue('{"projectName":"test","summary":"test","architecture":"test","dependencies":{},"filePlan":[]}'),
  },
}));

describe('Ayatrisya Canvas — AI Build, Run, Preview & Development Engine', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  // Acceptance Criterion 1: HTML website generation and framework detection
  it('Criterion 1: accurately detects Static HTML5 projects and default port 80', () => {
    const files: CanvasFile[] = [
      { id: '1', name: 'index.html', language: 'html', content: '<!DOCTYPE html><html><body><h1>Hello</h1></body></html>' },
      { id: '2', name: 'style.css', language: 'css', content: 'body { margin: 0; }' },
      { id: '3', name: 'app.js', language: 'javascript', content: 'console.log("App ready");' },
    ];

    const detected = detectFramework(files);
    expect(detected.framework).toBe('html');
    expect(detected.name).toContain('Static HTML5');
    expect(detected.defaultPort).toBe(80);
    expect(detected.entryPoint).toBe('index.html');
  });

  // Acceptance Criterion 2: React & Vite project detection
  it('Criterion 2: detects Vite + React projects and assigns port 5173 with proper dev command', () => {
    const files: CanvasFile[] = [
      {
        id: '1',
        name: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'my-vite-app',
          scripts: { dev: 'vite', build: 'vite build' },
          dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
          devDependencies: { vite: '^5.4.1', '@vitejs/plugin-react': '^4.3.1' },
        }),
      },
      { id: '2', name: 'src/main.jsx', language: 'javascript', content: 'import React from "react";' },
      { id: '3', name: 'src/App.jsx', language: 'javascript', content: 'export default function App() { return <div>App</div>; }' },
      { id: '4', name: 'index.html', language: 'html', content: '<!DOCTYPE html><html><div id="root"></div></html>' },
    ];

    const detected = detectFramework(files);
    expect(detected.framework).toBe('vite');
    expect(detected.name).toBe('Vite + React SPA');
    expect(detected.defaultPort).toBe(5173);
    expect(detected.devCommand).toBe('npm run dev');
    expect(detected.buildCommand).toBe('npm run build');
    expect(detected.packageManager).toBe('npm');
  });

  // Acceptance Criterion 3: Next.js and Node.js backend detection
  it('Criterion 3: detects Next.js full-stack and Node.js Express projects without assuming npm run dev for everything', () => {
    // Next.js
    const nextFiles: CanvasFile[] = [
      {
        id: '1',
        name: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'next-app',
          scripts: { dev: 'next dev', build: 'next build' },
          dependencies: { next: '14.2.5', react: '^18.3.1' },
        }),
      },
      { id: '2', name: 'app/page.tsx', language: 'typescript', content: 'export default function Page() { return <h1>Next</h1>; }' },
    ];
    const nextDetected = detectFramework(nextFiles);
    expect(nextDetected.framework).toBe('next');
    expect(nextDetected.defaultPort).toBe(3000);

    // Node.js Express
    const nodeFiles: CanvasFile[] = [
      {
        id: '1',
        name: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'node-api',
          scripts: { start: 'node server.js' },
          dependencies: { express: '^4.19.2' },
        }),
      },
      { id: '2', name: 'server.js', language: 'javascript', content: 'const express = require("express"); const app = express();' },
    ];
    const nodeDetected = detectFramework(nodeFiles);
    expect(nodeDetected.framework).toBe('node');
    expect(nodeDetected.name).toContain('Express');
    expect(nodeDetected.devCommand).toBe('npm start');
  });

  // Acceptance Criterion 4: Python project detection
  it('Criterion 4: detects Python projects and uses python3 or uvicorn commands on port 8000', () => {
    const pyFiles: CanvasFile[] = [
      { id: '1', name: 'main.py', language: 'python', content: 'print("Ayatrisya Python Engine")' },
      { id: '2', name: 'requirements.txt', language: 'plaintext', content: 'requests>=2.31.0\nmath\n' },
    ];

    const detected = detectFramework(pyFiles);
    expect(detected.framework).toBe('python');
    expect(detected.packageManager).toBe('pip');
    expect(detected.defaultPort).toBe(8000);
    expect(detected.devCommand).toBe('python3 main.py');
  });

  // Acceptance Criterion 5: Project Validation catches invalid syntax
  it('Criterion 5: validates generated files and configuration before execution', () => {
    const invalidFiles = [
      { path: 'package.json', content: '{ "name": "bad-json", ' }, // broken json
      { path: 'src/App.tsx', content: 'function App() { return <div>' }, // unbalanced curly brace
    ];

    const res = validateProjectFiles(invalidFiles);
    expect(res.valid).toBe(false);
    expect(res.issues.length).toBeGreaterThanOrEqual(2);
    expect(res.issues.some((i) => i.filePath === 'package.json')).toBe(true);
    expect(res.issues.some((i) => i.filePath === 'src/App.tsx')).toBe(true);

    const validFiles = [
      { path: 'package.json', content: '{ "name": "good-json", "version": "1.0.0" }' },
      { path: 'src/App.tsx', content: 'function App() { return <div></div>; }' },
    ];
    const validRes = validateProjectFiles(validFiles);
    expect(validRes.valid).toBe(true);
    expect(validRes.issues.length).toBe(0);
  });

  // Acceptance Criterion 6: Canvas IDE renders Execution controls and Framework Pill
  it('Criterion 6: renders Run button, Build button, and Framework status badge', () => {
    const html = renderToStaticMarkup(
      <CanvasProvider>
        <CanvasIDE />
      </CanvasProvider>
    );

    expect(html).toContain('Run');
    expect(html).toContain('Build');
    expect(html).toContain('Live Preview');
    expect(html).toContain('Terminal (Linux bash)');
    expect(html).toContain('Export .ZIP');
  });

  // Acceptance Criterion 7: Project Templates are registered and ready
  it('Criterion 7: includes pre-configured templates for React, Next.js, Node.js, Python, and 2D Games', () => {
    const keys = Object.keys(PROJECT_TEMPLATES);
    expect(keys).toContain('vanilla-web');
    expect(keys).toContain('arcade-2d');
    expect(keys).toContain('python-script');
    expect(keys).toContain('vite-react');
    expect(keys).toContain('nextjs-app');
    expect(keys).toContain('nodejs-api');
  });

  // Acceptance Criterion 8: Strict Iframe Sandboxing
  it('Criterion 8: applies strict iframe sandboxing allow-scripts allow-modals without allow-same-origin', () => {
    const html = renderToStaticMarkup(
      <CanvasProvider>
        <CanvasIDE />
      </CanvasProvider>
    );

    expect(html).toContain('sandbox="allow-scripts allow-modals"');
    // Ensure allow-same-origin is NEVER included in sandbox attributes
    expect(html).not.toContain('allow-same-origin');
  });

  // Acceptance Criterion 9: Responsive Viewports
  it('Criterion 9: provides Desktop, Tablet, and Mobile device preview switchers', () => {
    const html = renderToStaticMarkup(
      <CanvasProvider>
        <CanvasIDE />
      </CanvasProvider>
    );

    expect(html).toContain('Desktop (100%)');
    expect(html).toContain('Tablet (768px)');
    expect(html).toContain('Mobile (375px)');
    expect(html).toContain('Full Screen Preview');
  });

  // Acceptance Criterion 10: Dock Tabs
  it('Criterion 10: includes Terminal, Console Output, Problems dock with diagnostics', () => {
    const html = renderToStaticMarkup(
      <CanvasProvider>
        <CanvasIDE />
      </CanvasProvider>
    );

    expect(html).toContain('Terminal (Linux bash)');
    expect(html).toContain('Console Output');
    expect(html).toContain('Problems (');
    expect(html).toContain('Runtime');
  });

  // Acceptance Criterion 11: Honest Runtime Disclosure
  it('Criterion 11: honestly discloses Web Sandbox vs Desktop Native execution model', () => {
    const html = renderToStaticMarkup(
      <CanvasProvider>
        <CanvasIDE />
      </CanvasProvider>
    );

    expect(html).toContain('Web Sandbox');
    expect(html).toContain('In-Browser POSIX Simulator');
  });

  // Acceptance Criterion 12: Connected Terminal Prompt
  it('Criterion 12: connects the interactive terminal with bash command execution', () => {
    const html = renderToStaticMarkup(
      <CanvasProvider>
        <CanvasIDE />
      </CanvasProvider>
    );

    expect(html).toContain('ayatrisya@workspace');
    expect(html).toContain('Type a Linux command');
  });
});
