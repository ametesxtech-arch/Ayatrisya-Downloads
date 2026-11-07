import React from 'react';
import { ChromaticButton } from './chromatic-button';

export function Example() {
  return (
    <ChromaticButton
      color="#b126ff"
      colorMode="spectrum"
      speed={0.7}
      paused={false}
      phase={0}
      feather={100}
      projectionScale={174.7}
      intensity={1.4}
      grain={0.105}
      seed={7}
      borderRadius={50}
      hoverEffect="brighten"
      entrance="blur-up"
      entranceSpeed={1}
      entranceBlur={10}
      entranceDistance={20}
      entranceScale={0.65}
    >
      {'Get started'}
    </ChromaticButton>
  );
}

