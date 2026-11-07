import React from 'react';
import { TopographicTerrain, type TopographicTerrainProps } from '../topographic-terrain';

export const CANVAS_TERRAIN_CONFIG: TopographicTerrainProps = {
  animateEntrance: true,
  scale: 400,
  density: 6,
  speed: 1.5,
  distortion: 2.4,
  lineWidth: 0.5,
  opacity: 0,
  seed: 42,
  gradientDiffusion: 0,
  surfaceColor: '#ffffff',
  shadowColor: '#737373',
  shadowAnimation: 'none',
  shadowCycleDuration: 6,
  elevation: 160,
  cameraTilt: 38,
  cameraRotation: -20,
  cameraZoom: 1,
  terraceSoftness: 0.6,
  lightingBlend: 0,
  lightDirection: 315,
  lightIntensity: 1,
  hover: 0.45,
  hoverRadius: 200,
  hoverFollow: 0.16,
  hoverFade: 0.8,
  grain: 0.2,
  paused: false,
  backgroundColor: '#ffffff',
  backgroundImage: 'none',
  gradientColors: [],
  lineColor: '#000000',
  accentColor: '#000000',
};

export function CanvasBackground({
  className = '',
  opacity = 0.28,
  ...props
}: Partial<TopographicTerrainProps> & { className?: string; opacity?: number }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden z-0 ${className}`}
      style={{ opacity }}
      aria-hidden="true"
      data-testid="canvas-topographic-background"
    >
      <TopographicTerrain
        {...CANVAS_TERRAIN_CONFIG}
        {...props}
      />
    </div>
  );
}

export default CanvasBackground;

