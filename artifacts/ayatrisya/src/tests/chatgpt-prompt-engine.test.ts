import { describe, it, expect } from 'vitest';
import { enhancePromptLikeChatGPT, getNegativePromptForStyle } from '../lib/chatgpt-prompt-engine';

describe('ChatGPT Prompt Engine', () => {
  it('expands basic subject prompts into rich descriptive narratives', () => {
    const raw = 'a fluffy orange kitten playing with yarn';
    const result = enhancePromptLikeChatGPT(raw, { style: 'photorealistic' });

    expect(result.originalPrompt).toBe(raw);
    expect(result.enhancedPrompt.toLowerCase()).toContain('kitten');
    expect(result.enhancedPrompt.length).toBeGreaterThan(raw.length * 2);
    expect(result.detectedSubject).toBe('animal');
    expect(result.enhancementSummary).toContain('ChatGPT');
  });

  it('preserves user intent and subject focus across styles', () => {
    const cyberpunkPrompt = 'cyberpunk neon city street in the rain';
    const result = enhancePromptLikeChatGPT(cyberpunkPrompt, { style: 'cyberpunk' });

    expect(result.originalPrompt).toBe(cyberpunkPrompt);
    expect(result.enhancedPrompt.toLowerCase()).toContain('cyberpunk');
    expect(result.detectedStyle).toBe('cyberpunk');
  });

  it('attaches robust negative prompts to prevent anatomical and blur defects', () => {
    const negative = getNegativePromptForStyle('photorealistic');

    expect(negative).toContain('deformed');
    expect(negative).toContain('blurry');
    expect(negative).toContain('extra limbs');
  });

  it('respects already descriptive long prompts without destructive rewriting', () => {
    const longPrompt = 'An ultra-detailed photographic close-up portrait of an elderly watchmaker with weathered hands and brass magnifying goggles, meticulously repairing an intricate mechanical movement under warm tungsten desk lamp glow, 85mm f/1.4 lens bokeh, hyperrealistic texture of aged skin, shallow depth of field, masterpiece quality.';
    const result = enhancePromptLikeChatGPT(longPrompt);

    expect(result.enhancedPrompt).toContain('elderly watchmaker');
  });
});
