import React, { useState, useEffect } from 'react';
import { LiquidGlassOrb } from '../liquid-glass-orb';

export type LiquidOrbState = 'idle' | 'thinking' | 'listening' | 'searching' | 'speaking';

export interface LiquidOrbAgentProps {
  state?: LiquidOrbState;
  size?: number;
  audioLevel?: number;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function LiquidOrbAgent({
  state = 'idle',
  size = 250,
  audioLevel: overrideAudioLevel,
  className = '',
  onClick,
  interactive = true,
}: LiquidOrbAgentProps) {
  const [liveAudioLevel, setLiveAudioLevel] = useState(overrideAudioLevel ?? 0.55);

  // Sync external audioLevel prop
  useEffect(() => {
    if (overrideAudioLevel !== undefined) {
      setLiveAudioLevel(overrideAudioLevel);
    }
  }, [overrideAudioLevel]);

  // Modulate voice cadence automatically during speaking if not externally driven
  useEffect(() => {
    if (overrideAudioLevel !== undefined) return;
    if (state === 'speaking') {
      let rafId: number;
      let t = 0;
      const tick = () => {
        t += 0.08;
        const envelope = 0.55 + Math.sin(t * 3.1) * 0.2 + Math.sin(t * 7.4) * 0.12;
        setLiveAudioLevel(Math.min(1, Math.max(0.2, envelope)));
        rafId = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(rafId);
    } else {
      setLiveAudioLevel(0.55);
    }
  }, [state, overrideAudioLevel]);

  const resolvedAudioLevel = overrideAudioLevel ?? liveAudioLevel;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center ${interactive && onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${className}`.trim()}
      data-testid="liquid-orb-agent"
      data-agent-state={state}
    >
      {state === 'idle' && (
        <LiquidGlassOrb
          baseColor={'#ffffff'}
          colorA={'#000000'}
          colorB={'#4d4d4d'}
          colorC={'#a9a9a9'}
          seed={145}
          startTime={18}
          speed={1.5}
          distortion={0.8}
          clusterCount={7.2}
          clusterIntensity={3}
          clusterSize={22.5}
          scale={0.23}
          spotSize={1.15}
          rotation={0}
          softness={0.31}
          relief={2.94}
          refraction={0.65}
          roughness={0}
          reflection={1.3}
          caustics={0}
          dispersion={1}
          colorDistribution={0}
          grain={0.3}
          grainSize={1}
          paused={false}
          animateDistortion={true}
          grainMode={'fine'}
          flowType={'drift'}
          state={'idle'}
          thinkingAnimation={'ripples'}
          searchingAnimation={'lens'}
          preserveWhites={true}
          animateEntrance={true}
          size={size}
          audioLevel={resolvedAudioLevel}
        />
      )}

      {state === 'thinking' && (
        <LiquidGlassOrb
          baseColor={'#ffffff'}
          colorA={'#000000'}
          colorB={'#4d4d4d'}
          colorC={'#a9a9a9'}
          seed={145}
          startTime={18}
          speed={1.5}
          distortion={0.8}
          clusterCount={7.2}
          clusterIntensity={3}
          clusterSize={22.5}
          scale={0.23}
          spotSize={1.15}
          rotation={0}
          softness={0.31}
          relief={2.94}
          refraction={0.65}
          roughness={0}
          reflection={1.3}
          caustics={0}
          dispersion={1}
          colorDistribution={0}
          grain={0.3}
          grainSize={1}
          paused={false}
          animateDistortion={true}
          grainMode={'fine'}
          flowType={'drift'}
          state={'thinking'}
          thinkingAnimation={'ripples'}
          searchingAnimation={'lens'}
          preserveWhites={true}
          animateEntrance={true}
          size={size}
          audioLevel={resolvedAudioLevel}
        />
      )}

      {state === 'listening' && (
        <LiquidGlassOrb
          baseColor={'#ffffff'}
          colorA={'#000000'}
          colorB={'#4d4d4d'}
          colorC={'#a9a9a9'}
          seed={145}
          startTime={18}
          speed={1.5}
          distortion={0.8}
          clusterCount={7.2}
          clusterIntensity={3}
          clusterSize={22.5}
          scale={0.23}
          spotSize={1.15}
          rotation={0}
          softness={0.31}
          relief={2.94}
          refraction={0.65}
          roughness={0}
          reflection={1.3}
          caustics={0}
          dispersion={1}
          colorDistribution={0}
          grain={0.3}
          grainSize={1}
          paused={false}
          animateDistortion={true}
          grainMode={'fine'}
          flowType={'drift'}
          state={'listening'}
          thinkingAnimation={'ripples'}
          searchingAnimation={'lens'}
          intensity={1}
          preserveWhites={true}
          animateEntrance={true}
          size={size}
          audioLevel={resolvedAudioLevel}
        />
      )}

      {state === 'searching' && (
        <LiquidGlassOrb
          baseColor={'#ffffff'}
          colorA={'#000000'}
          colorB={'#4d4d4d'}
          colorC={'#a9a9a9'}
          seed={145}
          startTime={18}
          speed={1.5}
          distortion={0.8}
          clusterCount={7.2}
          clusterIntensity={3}
          clusterSize={22.5}
          scale={0.23}
          spotSize={1.15}
          rotation={0}
          softness={0.31}
          relief={2.94}
          refraction={0.65}
          roughness={0}
          reflection={1.3}
          caustics={0}
          dispersion={1}
          colorDistribution={0}
          grain={0.3}
          grainSize={1}
          paused={false}
          animateDistortion={true}
          grainMode={'fine'}
          flowType={'drift'}
          state={'searching'}
          thinkingAnimation={'ripples'}
          searchingAnimation={'lens'}
          preserveWhites={true}
          animateEntrance={true}
          size={size}
          audioLevel={resolvedAudioLevel}
        />
      )}

      {state === 'speaking' && (
        <LiquidGlassOrb
          baseColor={'#ffffff'}
          colorA={'#000000'}
          colorB={'#4d4d4d'}
          colorC={'#a9a9a9'}
          seed={145}
          startTime={18}
          speed={1.5}
          distortion={0.8}
          clusterCount={7.2}
          clusterIntensity={3}
          clusterSize={22.5}
          scale={0.23}
          spotSize={1.15}
          rotation={0}
          softness={0.31}
          relief={2.94}
          refraction={0.65}
          roughness={0}
          reflection={1.3}
          caustics={0}
          dispersion={1}
          colorDistribution={0}
          grain={0.3}
          grainSize={1}
          paused={false}
          animateDistortion={true}
          grainMode={'fine'}
          flowType={'drift'}
          state={'speaking'}
          thinkingAnimation={'ripples'}
          searchingAnimation={'lens'}
          intensity={1}
          preserveWhites={true}
          animateEntrance={true}
          size={size}
          audioLevel={resolvedAudioLevel}
        />
      )}
    </div>
  );
}

export default LiquidOrbAgent;

