import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiquidGlassOrb } from '../components/liquid-glass-orb';
import { SpeechToSpeechModal } from '../components/voice/SpeechToSpeechModal';
import { LiquidOrbAgent } from '../components/voice/LiquidOrbAgent';

describe('LiquidGlassOrb in STS and Chat UI', () => {
  const commonProps = {
    baseColor: '#ffffff',
    colorA: '#000000',
    colorB: '#4d4d4d',
    colorC: '#a9a9a9',
    seed: 145,
    startTime: 18,
    speed: 1.5,
    distortion: 0.8,
    clusterCount: 7.2,
    clusterIntensity: 3,
    clusterSize: 22.5,
    scale: 0.23,
    spotSize: 1.15,
    rotation: 0,
    softness: 0.31,
    relief: 2.94,
    refraction: 0.65,
    roughness: 0,
    reflection: 1.3,
    caustics: 0,
    dispersion: 1,
    colorDistribution: 0,
    grain: 0.3,
    grainSize: 1,
    paused: false,
    animateDistortion: true,
    grainMode: 'fine' as const,
    flowType: 'drift' as const,
    thinkingAnimation: 'ripples' as const,
    searchingAnimation: 'lens' as const,
    preserveWhites: true,
    animateEntrance: true,
    size: 250,
    audioLevel: 0.55,
  };

  it('renders idle state correctly', () => {
    const html = renderToStaticMarkup(
      <LiquidGlassOrb {...commonProps} state="idle" />
    );
    expect(html).toContain('fluid-agent-orb');
    expect(html).toContain('data-state="idle"');
  });

  it('renders thinking state correctly', () => {
    const html = renderToStaticMarkup(
      <LiquidGlassOrb {...commonProps} state="thinking" />
    );
    expect(html).toContain('data-state="thinking"');
  });

  it('renders listening state correctly with intensity={1}', () => {
    const html = renderToStaticMarkup(
      <LiquidGlassOrb {...commonProps} state="listening" intensity={1} />
    );
    expect(html).toContain('data-state="listening"');
  });

  it('renders searching state correctly', () => {
    const html = renderToStaticMarkup(
      <LiquidGlassOrb {...commonProps} state="searching" />
    );
    expect(html).toContain('data-state="searching"');
  });

  it('renders speaking state correctly with intensity={1}', () => {
    const html = renderToStaticMarkup(
      <LiquidGlassOrb {...commonProps} state="speaking" intensity={1} />
    );
    expect(html).toContain('data-state="speaking"');
  });

  it('renders SpeechToSpeechModal with LiquidGlassOrb in idle state by default', () => {
    const html = renderToStaticMarkup(
      <SpeechToSpeechModal
        conversationId="test-conv"
        history={[]}
        onNewMessage={async () => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('modal-sts');
    expect(html).toContain('data-state="idle"');
    expect(html).toContain('Tap orb to speak');
  });

  it('renders LiquidOrbAgent wrapper with all 5 states in Chat UI', () => {
    const idleHtml = renderToStaticMarkup(<LiquidOrbAgent state="idle" size={160} />);
    expect(idleHtml).toContain('data-agent-state="idle"');
    expect(idleHtml).toContain('data-state="idle"');

    const thinkingHtml = renderToStaticMarkup(<LiquidOrbAgent state="thinking" size={80} />);
    expect(thinkingHtml).toContain('data-agent-state="thinking"');
    expect(thinkingHtml).toContain('data-state="thinking"');

    const listeningHtml = renderToStaticMarkup(<LiquidOrbAgent state="listening" size={80} />);
    expect(listeningHtml).toContain('data-agent-state="listening"');
    expect(listeningHtml).toContain('data-state="listening"');

    const searchingHtml = renderToStaticMarkup(<LiquidOrbAgent state="searching" size={80} />);
    expect(searchingHtml).toContain('data-agent-state="searching"');
    expect(searchingHtml).toContain('data-state="searching"');

    const speakingHtml = renderToStaticMarkup(<LiquidOrbAgent state="speaking" size={80} />);
    expect(speakingHtml).toContain('data-agent-state="speaking"');
    expect(speakingHtml).toContain('data-state="speaking"');
  });
});
