import React from 'react';
import { FractalGlass } from './fractal-glass';

export function Example() {
  return (
    <FractalGlass
      src="/assets/fractal-glass/mountain.webp"
      alt="Snow-covered Himalayan mountains"
      animateEntrance={true}
      mode="default"
      stripes={26}
      distortion={24}
      refractionBias={-0.1}
      blur={20}
      grain={0.005}
      smoothness={7.3}
      textureScale={103}
      blackPoint={0}
      whitePoint={232}
      gamma={0.78}
      edgeWidth={0}
      coverage={0.55}
      coverageMode="stripes"
      side="left"
      direction="vertical"
      hoverEffect={true}
      hoverPreset="reveal-on-hover"
      recoveryDirection="same"
      hoverAnimation="procedural"
      hoverDuration={880}
      hoverRadius={120}
      hoverFeather={16}
      transitionBlend={0.5}
      duration={570}
      ease="power4.out"
      disabled={false}
      height={480}
      borderRadius={0}
    />
  );
}
