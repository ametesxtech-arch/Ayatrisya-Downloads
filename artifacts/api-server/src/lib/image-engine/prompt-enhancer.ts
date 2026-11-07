/**
 * Backend Image Generation Prompt Enhancement Engine
 * Automatically enriches basic user prompts into detailed, photorealistic prompts
 * following DALL-E 3 and Midjourney v6 prompting guidelines.
 */

export function enrichImagePrompt(rawPrompt: string, style?: string): string {
  const prompt = (rawPrompt || "").trim();
  if (!prompt) return prompt;

  // If already very long (> 40 words), keep as is with light quality polish
  if (prompt.split(/\s+/).length > 40) {
    if (!/photorealistic|8k|cinematic|detailed/i.test(prompt)) {
      return `${prompt}, cinematic volumetric lighting, 8k photographic masterwork, crisp textures, sharp focus`;
    }
    return prompt;
  }

  // Common subject detection
  const isPortrait = /\b(woman|man|girl|boy|person|portrait|face|model|astronaut|warrior)\b/i.test(prompt);
  const isAnimal = /\b(cat|dog|tiger|lion|dragon|wolf|fox|horse|bird|eagle|kitten|puppy|bear)\b/i.test(prompt);
  const isVehicle = /\b(car|supercar|spaceship|motorcycle|plane|ship|cyberpunk car)\b/i.test(prompt);
  const isLandscape = /\b(mountain|forest|ocean|beach|lake|desert|waterfall|sunset|sunrise|canyon|galaxy|nebula)\b/i.test(prompt);
  const isCyberpunk = /\b(cyberpunk|neon|tokyo|sci-fi|futuristic)\b/i.test(prompt);

  let enhancements = "";
  if (isPortrait) {
    enhancements = "captivating photorealistic portrait, lifelike skin texture with visible pores and catchlights in the eyes, soft Rembrandt lighting, 85mm f/1.4 lens, natural bokeh, 8k photographic fidelity";
  } else if (isAnimal) {
    enhancements = "breathtaking wildlife close-up photography, fine fur and whisker details catching sunlight, intelligent expressive eyes, natural habitat depth, golden hour light, National Geographic caliber";
  } else if (isVehicle) {
    enhancements = "cinematic hero automotive photography, gleaming reflections across aerodynamic bodywork, dynamic perspective, dramatic twilight sky, ray-traced reflections, Unreal Engine 5 render, 8k";
  } else if (isCyberpunk) {
    enhancements = "stunning neo-Tokyo cyberpunk cinematic composition, vibrant magenta and cyan neon reflections on wet asphalt, volumetric steam and rain mist, hyper-detailed, octane render 8k";
  } else if (isLandscape) {
    enhancements = "majestic landscape photography, dramatic atmospheric perspective, warm golden hour sunbeams, rich geological and foliage textures, ultra-high resolution, Hasselblad landscape masterwork";
  } else {
    enhancements = "cinematic composition, dramatic volumetric lighting, crisp physical textures and authentic materials, 8k resolution, photorealistic masterpiece, sharp focus";
  }

  return `${prompt}, ${enhancements}`;
}

export const DEFAULT_NEGATIVE_PROMPT =
  "blurry, deformed, bad anatomy, bad hands, missing fingers, extra fingers, mutated limbs, poorly drawn face, disfigured, distorted, low quality, worst quality, jpeg artifacts, watermark, signature, cropped, out of frame";
