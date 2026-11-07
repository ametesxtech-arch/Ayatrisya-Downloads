/**
 * Ayatrisya Neural Vision — Backend Prompt Enhancement Engine
 * Automatically transforms raw user prompts into rich, high-fidelity descriptive prompts
 * with photographic realism, optical lens physics, and volumetric lighting.
 * 
 * Copyright (c) AMETESX. All rights reserved.
 */

export interface PromptEnrichmentOptions {
  style?: string;
  aspectRatio?: string;
}

export function enrichImagePrompt(rawPrompt: string, options?: PromptEnrichmentOptions | string): string {
  const prompt = (rawPrompt || "").trim();
  if (!prompt) return prompt;

  const style = typeof options === "string" ? options : options?.style;
  const aspectRatio = typeof options === "object" ? options?.aspectRatio : undefined;

  // If already very long (> 45 words), keep original intent with a polish
  if (prompt.split(/\s+/).length > 45) {
    if (!/photorealistic|8k|cinematic|detailed|hasselblad/i.test(prompt)) {
      return `${prompt}, cinematic volumetric lighting, 8k photographic masterwork, crisp physical textures, sharp focus`;
    }
    return prompt;
  }

  // Subject categorization
  const isPortrait = /\b(woman|man|girl|boy|person|portrait|face|model|astronaut|warrior|samurai|knight|pilot|wizard|cyborg|queen|king)\b/i.test(prompt);
  const isAnimal = /\b(cat|dog|tiger|lion|dragon|wolf|fox|horse|bird|eagle|kitten|puppy|bear|panther|cheetah|leopard|owl|falcon|stag)\b/i.test(prompt);
  const isVehicle = /\b(car|supercar|hypercar|spaceship|motorcycle|plane|ship|cyberpunk car|jet|mecha|rover|yacht)\b/i.test(prompt);
  const isLandscape = /\b(mountain|forest|ocean|beach|lake|desert|waterfall|sunset|sunrise|canyon|galaxy|nebula|glacier|aurora|fjord)\b/i.test(prompt);
  const isArchitecture = /\b(house|villa|skyscraper|museum|temple|cathedral|ruins|bridge|monument|penthouse|palace|pavilion|building)\b/i.test(prompt);
  const isCityscape = /\b(city|cyberpunk|tokyo|street|skyline|futuristic city|village|alley|metropolis|bazaar)\b/i.test(prompt);
  const isFood = /\b(coffee|burger|cake|ramen|pizza|sushi|cocktail|dessert|tea|pasta|fruit|steak|dish)\b/i.test(prompt);
  const isMacro = /\b(flower|petal|insect|butterfly|drop|droplet|crystal|gem|jewelry|watch|snowflake)\b/i.test(prompt);

  // Style-specific override
  if (style === "anime" || style === "manga") {
    return `${prompt}, modern Japanese theatrical anime masterpiece, Makoto Shinkai and Ufotable aesthetic, luminous golden hour lighting, sunbeams piercing through clouds, clean line art, multi-layered cel shading, richly detailed painted sky, 4k`;
  }
  if (style === "3d-animated") {
    return `${prompt}, premium 3D animated feature film render, Pixar and DreamWorks studio animation style, RenderMan illumination, warm key light, soft subsurface scattering, plush physical textures, charming lively eyes, 4k`;
  }
  if (style === "digital-painting" || style === "concept-art") {
    return `${prompt}, award-winning digital concept art, trending on ArtStation, expressive oil and impasto brushwork, dynamic chiaroscuro lighting, radiant color harmony, atmospheric depth and mist, fantasy masterpiece`;
  }
  if (style === "cyberpunk") {
    return `${prompt}, stunning neo-Tokyo cyberpunk cinematic composition, vibrant magenta and cyan neon reflections on rain-slicked wet pavement, volumetric steam and smog, intricate holographic displays, Unreal Engine 5 ray-traced render, 8k`;
  }
  if (style === "dark-fantasy") {
    return `${prompt}, dark fantasy oil painting masterpiece, Caravaggio chiaroscuro, burning embers and ethereal moonbeams, deep velvety shadows, weathered gothic textures, majestic silhouette, museum-grade classical realism`;
  }
  if (style === "vintage-film") {
    return `${prompt}, vintage 1970s analog film photography, authentic Kodachrome 64 color grading, Leica M3 rangefinder camera, 50mm f/1.4 lens, warm nostalgic sunlight, organic film grain, timeless retro atmosphere`;
  }

  // Subject-specific enhancements
  let subjectEnhancement = "";
  if (isPortrait) {
    subjectEnhancement = "captivating photorealistic portrait, authentic skin texture with visible pores and natural catchlights in the eyes, soft Rembrandt lighting, 85mm f/1.2 lens, smooth natural bokeh, Hasselblad medium format 8k";
  } else if (isAnimal) {
    subjectEnhancement = "breathtaking wildlife close-up photography, fine fur and whisker details catching directional sunlight, intelligent expressive eyes, natural habitat depth, golden hour light, National Geographic caliber";
  } else if (isVehicle) {
    subjectEnhancement = "cinematic hero automotive photography, gleaming mirror-finish reflections across aerodynamic bodywork, dynamic low-angle perspective, dramatic twilight sky, ray-traced reflections, Unreal Engine 5 render, 8k";
  } else if (isArchitecture) {
    subjectEnhancement = "architectural editorial photography, Architectural Digest feature, 24mm tilt-shift lens with perfect perspective lines, sculptural lighting, warm interior glow through glass, rich concrete and timber textures";
  } else if (isCityscape) {
    subjectEnhancement = "cinematic urban atmosphere, bustling atmospheric city life, ambient glow from storefronts, reflective wet pavement, dramatic atmospheric perspective, 35mm Panavision anamorphic still";
  } else if (isLandscape) {
    subjectEnhancement = "majestic landscape photography, dramatic atmospheric perspective, warm golden hour sunbeams, rich geological and foliage textures, crystal-clear water reflections, ultra-high resolution Hasselblad landscape masterwork";
  } else if (isFood) {
    subjectEnhancement = "Michelin-star culinary photography, macro 100mm lens, shallow depth of field with creamy bokeh, glistening sauces, crispy fresh textures, gentle steam rising, soft diffused studio lighting";
  } else if (isMacro) {
    subjectEnhancement = "extreme macro photograph, razor-sharp focal plane, microscopic surface textures and prismatic light refraction, soft organic background bokeh, ring-light illumination, 8k";
  } else {
    subjectEnhancement = "cinematic composition, dramatic volumetric lighting, crisp physical textures and authentic materials, 8k resolution, photorealistic masterpiece, sharp focus";
  }

  // Aspect ratio hint
  let aspectHint = "";
  if (aspectRatio === "16:9") {
    aspectHint = ", 16:9 cinematic widescreen framing";
  } else if (aspectRatio === "9:16") {
    aspectHint = ", 9:16 vertical portrait composition";
  }

  return `${prompt}, ${subjectEnhancement}${aspectHint}`;
}

export const DEFAULT_NEGATIVE_PROMPT =
  "blurry, deformed, bad anatomy, bad hands, missing fingers, extra fingers, mutated limbs, poorly drawn face, disfigured, distorted, plastic skin, doll-like, low quality, worst quality, jpeg artifacts, watermark, signature, username, cropped, out of frame";
