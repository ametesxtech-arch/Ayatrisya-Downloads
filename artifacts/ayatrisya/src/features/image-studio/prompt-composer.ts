import type { CharacterProfile, ImageStyleId } from './types';
import { applyStylePreset, IMAGE_STYLE_PRESETS } from './styles';
import { formatCharacterPromptSegment } from './character-profiles';
import { enhancePromptLikeChatGPT } from '@/lib/chatgpt-prompt-engine';

export interface PromptCompositionInput {
  userInput: string;
  referencePrompt?: string;
  character?: CharacterProfile;
  styleId?: ImageStyleId;
  customStyleModifier?: string;
  enhanceWithChatGPT?: boolean;
}

export interface PromptCompositionResult {
  effectivePrompt: string;
  refinementSummary?: string;
  detectedStyleOverride?: ImageStyleId;
  honestLimitationNote: string;
}

/**
 * Intelligent prompt composer for multi-turn Image Studio conversations.
 * Handles follow-ups like:
 * - "Make the lighting warmer."
 * - "Keep the same character but change the outfit to black."
 * - "Put this character in a futuristic city."
 * - "Make it anime style instead."
 * - "Keep everything the same, but change the camera angle."
 */
export function composeConversationalPrompt(input: PromptCompositionInput): PromptCompositionResult {
  const rawInput = input.userInput.trim();
  const refPrompt = (input.referencePrompt || '').trim();

  let effectiveStyleId = input.styleId;
  let refinementSummary: string | undefined;

  // 1. Detect if the user explicitly asked for a style change in conversation
  const styleMatch = detectStyleInMessage(rawInput);
  if (styleMatch) {
    effectiveStyleId = styleMatch;
    refinementSummary = `Applied style change to ${styleMatch}.`;
  }

  // 2. Detect if user is asking for a refinement of an existing image
  const isFollowUpRefinement = Boolean(refPrompt && isRefinementRequest(rawInput));

  let baseSubjectAndScene: string;
  let sceneOverridesOutfit = false;

  if (isFollowUpRefinement) {
    const refined = blendRefinementWithReference(refPrompt, rawInput);
    baseSubjectAndScene = refined.blendedPrompt;
    refinementSummary = refined.summary;
    sceneOverridesOutfit = refined.overridesOutfit;
  } else {
    baseSubjectAndScene = rawInput;
    // Check if new prompt specifies an outfit
    if (/wearing|dressed in|outfit|jacket|suit|coat|attire|clothes/i.test(rawInput)) {
      sceneOverridesOutfit = true;
    }
  }

  // 3. Attach character profile if active
  let withCharacter = baseSubjectAndScene;
  if (input.character) {
    const charSegment = formatCharacterPromptSegment(input.character, sceneOverridesOutfit);
    // Don't duplicate character name if already present in base prompt
    if (baseSubjectAndScene.toLowerCase().includes(input.character.name.toLowerCase())) {
      withCharacter = `${baseSubjectAndScene}, ${charSegment}`;
    } else {
      withCharacter = `${baseSubjectAndScene}, ${charSegment}`;
    }
  }

  // 4. Apply selected artistic style
  const finalPrompt = applyStylePreset(
    withCharacter,
    effectiveStyleId,
    input.customStyleModifier,
  );

  let effectivePrompt = finalPrompt;
  if (input.enhanceWithChatGPT) {
    const enhanced = enhancePromptLikeChatGPT(finalPrompt, { style: effectiveStyleId });
    effectivePrompt = enhanced.enhancedPrompt;
    refinementSummary = refinementSummary || enhanced.enhancementSummary;
  }

  const honestLimitationNote =
    'FLUX.1-schnell synthesizes a new composition from this refined description. Text-to-image models generate fresh diffusion samples and do not guarantee pixel-identical facial preservation.';

  return {
    effectivePrompt,
    refinementSummary,
    detectedStyleOverride: styleMatch,
    honestLimitationNote,
  };
}

/**
 * Checks whether user input is a follow-up refinement rather than a completely unrelated topic.
 */
function isRefinementRequest(text: string): boolean {
  const patterns = [
    /^(make|change|turn|adjust|put|place|add|remove|switch|keep|instead)/i,
    /(lighting|camera|angle|outfit|clothes|dress|background|setting|city|warmer|cooler|darker|brighter)/i,
    /(same character|same person|same subject|same scene|keep everything)/i,
    /(instead|more|less|closer|wider|from above|from below)/i,
    /(in a |into a |as a |to a )/i,
  ];
  return patterns.some((p) => p.test(text));
}

/**
 * Blends a follow-up instruction into the previous reference prompt.
 */
function blendRefinementWithReference(
  previousPrompt: string,
  instruction: string,
): { blendedPrompt: string; summary: string; overridesOutfit: boolean } {
  let cleanedRef = previousPrompt;
  let summary: string;
  let overridesOutfit = false;

  const lower = instruction.toLowerCase();

  // A. Lighting changes
  if (/lighting|warmer|cooler|golden hour|dramatic lighting|sunlight|neon light|darker|brighter/i.test(lower)) {
    // Strip previous lighting keywords if present
    cleanedRef = cleanedRef.replace(/\b(warm|cool|dramatic|bright|dark|golden hour|soft|ambient)\s+lighting\b/gi, '');
    const lightingModifier = lower.includes('warmer')
      ? 'warm golden hour ambient lighting, warm color temperature'
      : lower.includes('cooler')
      ? 'cool blue ambient atmospheric lighting'
      : lower.includes('darker') || lower.includes('night')
      ? 'dark moody nocturnal atmosphere, shadows and moonlight'
      : lower.includes('neon')
      ? 'vibrant neon backlighting and volumetric glow'
      : instruction;
    summary = 'Adjusted lighting and atmosphere.';
    return {
      blendedPrompt: `${cleanedRef.trim()}, ${lightingModifier}`,
      summary,
      overridesOutfit,
    };
  }

  // B. Outfit changes
  if (/outfit|wear|dress|jacket|clothes|attire|suit/i.test(lower)) {
    overridesOutfit = true;
    // Strip previous clothing phrases
    cleanedRef = cleanedRef.replace(/\b(wearing|dressed in|in a)\s+[^,]+/gi, '');
    summary = 'Updated character outfit.';
    return {
      blendedPrompt: `${cleanedRef.trim()}, ${instruction}`,
      summary,
      overridesOutfit,
    };
  }

  // C. Environment / Setting changes ("put this character in a futuristic city")
  if (/put (this|the) (character|person|subject) in|place in|setting to|background to|in a /i.test(lower)) {
    summary = 'Transposed subject to new environment.';
    const newLocation = instruction.replace(/^(put|place)\s+(this|the)\s+(character|person|subject)\s+(in|into|at)\s+/i, '');
    return {
      blendedPrompt: `${cleanedRef.trim()}, set in ${newLocation}`,
      summary,
      overridesOutfit,
    };
  }

  // D. Camera angle changes ("change the camera angle", "close-up portrait", "wide angle")
  if (/camera|angle|view|shot|close-?up|wide|panoramic|portrait/i.test(lower)) {
    cleanedRef = cleanedRef.replace(/\b(wide-angle|close-up|portrait|low-angle|bird's eye)\s+shot\b/gi, '');
    summary = 'Adjusted camera perspective.';
    return {
      blendedPrompt: `${cleanedRef.trim()}, ${instruction}`,
      summary,
      overridesOutfit,
    };
  }

  // E. Generic follow-up
  return {
    blendedPrompt: `${cleanedRef.trim()}, ${instruction}`,
    summary: 'Adjusted scene based on follow-up request.',
    overridesOutfit: /outfit|clothes|suit/i.test(lower),
  };
}

/**
 * Detects if the user requested a specific style preset in their prompt.
 */
function detectStyleInMessage(text: string): ImageStyleId | undefined {
  const lower = text.toLowerCase();
  for (const preset of IMAGE_STYLE_PRESETS) {
    if (preset.id === 'custom') continue;
    const labelLower = preset.label.toLowerCase();
    if (
      lower.includes(`${labelLower} style`) ||
      lower.includes(`in ${labelLower}`) ||
      lower.includes(`make it ${labelLower}`)
    ) {
      return preset.id;
    }
  }
  return undefined;
}
