import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChromaticButton } from '@/components/chromatic-button';
import { Example } from '@/components/ChromaticButtonExample';

describe('Chromatic Button Component Suite', () => {
  it('renders the ChromaticButton with custom WebGL canvas surface and content', () => {
    const html = renderToStaticMarkup(
      <ChromaticButton
        color="#b126ff"
        colorMode="spectrum"
        speed={0.7}
        feather={100}
        projectionScale={174.7}
        intensity={1.4}
        grain={0.105}
        seed={7}
        borderRadius={50}
        hoverEffect="brighten"
        entrance="blur-up"
        data-testid="button-send"
      >
        <span>Send</span>
      </ChromaticButton>
    );

    expect(html).toContain('chromatic-button');
    expect(html).toContain('<canvas');
    expect(html).toContain('data-testid="button-send"');
    expect(html).toContain('Send');
  });

  it('renders the Example export cleanly', () => {
    const html = renderToStaticMarkup(<Example />);
    expect(html).toContain('chromatic-button');
    expect(html).toContain('Get started');
  });
});
