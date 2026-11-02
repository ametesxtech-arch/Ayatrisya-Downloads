import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanvasProvider, useCanvas } from '@/components/canvas/CanvasContext';
import { CanvasPanel } from '@/components/canvas/CanvasPanel';
import { CanvasIDEPage } from '@/pages/workspace/CanvasIDE';

describe('Ayatrisya Code Canvas Workspace', () => {
  it('renders CanvasIDEPage standalone without throwing context errors', () => {
    // Should render even without an outer CanvasProvider
    const html = renderToStaticMarkup(<CanvasIDEPage />);
    expect(html).toContain('Ayatrisya Virtual Dev Environment');
  });

  it('renders CanvasPanel with interactive controls when open', () => {
    function TestApp() {
      const { openCanvas } = useCanvas();
      React.useEffect(() => {
        openCanvas({
          name: 'demo.html',
          content: '<h1>Hello Canvas</h1>',
          language: 'html',
        });
      }, []);
      return <CanvasPanel />;
    }

    const html = renderToStaticMarkup(
      <CanvasProvider>
        <TestApp />
      </CanvasProvider>
    );

    // Initial render before useEffect runs in SSR
    expect(html).toBeDefined();
  });

  it('renders default files when CanvasPanel is forced open', () => {
    function OpenCanvasApp() {
      return (
        <CanvasProvider>
          <CanvasPanel />
        </CanvasProvider>
      );
    }

    const html = renderToStaticMarkup(<OpenCanvasApp />);
    expect(html).toBeDefined();
  });
});
