import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TopographicTerrain } from '../components/topographic-terrain';
import { CanvasBackground, CANVAS_TERRAIN_CONFIG } from '../components/canvas/CanvasBackground';

describe('TopographicTerrain & Canvas Background', () => {
  it('renders correctly with exact user props', () => {
    const html = renderToStaticMarkup(
      <TopographicTerrain
        animateEntrance={true}
        scale={400}
        density={6}
        speed={1.5}
        distortion={2.4}
        lineWidth={0.5}
        opacity={0}
        seed={42}
        gradientDiffusion={0}
        surfaceColor={'#ffffff'}
        shadowColor={'#737373'}
        shadowAnimation={'none'}
        shadowCycleDuration={6}
        elevation={160}
        cameraTilt={38}
        cameraRotation={-20}
        cameraZoom={1}
        terraceSoftness={0.6}
        lightingBlend={0}
        lightDirection={315}
        lightIntensity={1}
        hover={0.45}
        hoverRadius={200}
        hoverFollow={0.16}
        hoverFade={0.8}
        grain={0.2}
        paused={false}
        backgroundColor={'#ffffff'}
        backgroundImage={'none'}
        gradientColors={[]}
        lineColor={'#000000'}
        accentColor={'#000000'}
      />
    );

    expect(html).toContain('topographic-terrain');
  });

  it('renders CanvasBackground component with default terrain configuration', () => {
    const html = renderToStaticMarkup(<CanvasBackground opacity={0.35} />);
    expect(html).toContain('canvas-topographic-background');
    expect(html).toContain('topographic-terrain');
    expect(CANVAS_TERRAIN_CONFIG.scale).toBe(400);
    expect(CANVAS_TERRAIN_CONFIG.density).toBe(6);
    expect(CANVAS_TERRAIN_CONFIG.speed).toBe(1.5);
    expect(CANVAS_TERRAIN_CONFIG.seed).toBe(42);
    expect(CANVAS_TERRAIN_CONFIG.elevation).toBe(160);
  });
});
