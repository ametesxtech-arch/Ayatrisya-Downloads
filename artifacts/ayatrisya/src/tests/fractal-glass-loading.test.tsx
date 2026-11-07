import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FractalGlass } from '@/components/fractal-glass';
import { FractalGlassLoading } from '@/components/FractalGlassLoading';
import { Example } from '@/components/FractalGlassExample';

describe('Fractal Glass Loading Component Suite', () => {
  it('renders the FractalGlass component with custom attributes and fallback gracefully', () => {
    const html = renderToStaticMarkup(
      <FractalGlass
        src="/assets/fractal-glass/mountain.webp"
        alt="Snow-covered Himalayan mountains"
        stripes={26}
        distortion={24}
        height={480}
      />
    );

    expect(html).toContain('fractal-glass');
    expect(html).toContain('<canvas');
    expect(html).toContain('Snow-covered Himalayan mountains');
  });

  it('renders FractalGlassLoading screen with emblem, wordmark, and status message', () => {
    const html = renderToStaticMarkup(
      <FractalGlassLoading message="Loading workspace assets…" />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('Loading workspace assets…');
    expect(html).toContain('ayatrisya');
    expect(html).toContain('brand-mark');
  });

  it('renders the user Example component cleanly', () => {
    const html = renderToStaticMarkup(<Example />);
    expect(html).toContain('fractal-glass');
    expect(html).toContain('mountain.webp');
  });
});
