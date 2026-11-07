/**
 * Ayatrisya ChatGPT / DALL-E 3 Style Image Prompt Enhancement Engine
 * 
 * Transforms short, raw user requests into rich, vivid, cinematic, and photorealistic
 * descriptive prompts following OpenAI DALL-E 3 / Midjourney v6 prompting principles.
 * 
 * Principles applied:
 * 1. Specific subject details (anatomy, posture, expression, materials, textures)
 * 2. Atmospheric environment & depth (weather, ambient particles, background context)
 * 3. Cinematic lighting & color (Rembrandt lighting, golden hour, volumetric rays, rim light)
 * 4. Camera optics & composition (focal length, depth of field, angle, rule of thirds)
 * 5. Quality mastery & negative prompt generation
 */

export interface PromptEnhancementOptions {
  style?: string;
  aspectRatio?: string;
  intensity?: 'natural' | 'cinematic' | 'hyper-detailed';
  keepOriginalIntent?: boolean;
}

export interface EnhancedPromptResult {
  originalPrompt: string;
  enhancedPrompt: string;
  negativePrompt: string;
  detectedSubject: string;
  detectedStyle: string;
  enhancementSummary: string;
}

// Detection patterns for subjects
const SUBJECT_PATTERNS = [
  { type: 'portrait', regex: /\b(woman|man|girl|boy|person|portrait|face|model|warrior|wizard|astronaut|cyborg|knight|queen|king|elderly|child)\b/i },
  { type: 'animal', regex: /\b(cat|dog|tiger|lion|wolf|bird|dragon|horse|fox|bear|elephant|eagle|owl|kitten|puppy|fish|whale|creature|monster)\b/i },
  { type: 'vehicle', regex: /\b(car|supercar|spaceship|motorcycle|plane|ship|boat|train|cyberpunk car|jet|rover|mech)\b/i },
  { type: 'landscape', regex: /\b(mountain|forest|ocean|beach|lake|desert|waterfall|sunset|sunrise|canyon|valley|island|jungle|stars|galaxy|nebula)\b/i },
  { type: 'cityscape', regex: /\b(city|cyberpunk|tokyo|street|building|skyline|futuristic city|village|castle|alley|interior|room|cafe|cabin)\b/i },
  { type: 'architecture', regex: /\b(house|villa|skyscraper|museum|temple|cathedral|ruins|bridge|monument|penthouse)\b/i },
  { type: 'food', regex: /\b(coffee|burger|cake|ramen|pizza|sushi|cocktail|dessert|tea|pasta|fruit|feast)\b/i },
];

// Style-specific aesthetic frameworks
const STYLE_FRAMEWORKS: Record<string, {
  medium: string;
  lighting: string;
  optics: string;
  renderNotes: string;
}> = {
  photorealistic: {
    medium: 'high-end commercial editorial photography, shot on Hasselblad H6D-100c with 85mm f/1.4 lens',
    lighting: 'natural directional daylight, gentle softbox fill, warm organic ambient illumination, realistic specular highlights',
    optics: 'crisp sharp focus on the central subject, smooth natural circular bokeh in the background, authentic depth of field',
    renderNotes: 'ultra-realistic tactile textures, fine skin and fabric pore details, true-to-life physical materials, 8k photographic masterwork',
  },
  cinematic: {
    medium: '35mm Panavision anamorphic motion picture still, cinematic color grading, Kodak Vision3 film stock',
    lighting: 'dramatic three-point lighting, atmospheric volumetric haze, glowing rim light, deep cinematic contrast with soft shadow roll-off',
    optics: 'anamorphic horizontal lens flare, subtle optical vignetting, cinematic 2.39:1 widescreen framing, shallow focus',
    renderNotes: 'movie blockbuster production quality, atmospheric depth, cinematic mist and particle dust, evocative storytelling',
  },
  anime: {
    medium: 'modern Japanese theatrical anime illustration, inspired by Makoto Shinkai and Studio Ghibli masterworks',
    lighting: 'luminous golden hour sunlight, sunbeams piercing through clouds, vibrant glowing highlights and colorful rim light',
    optics: 'painterly wide-angle perspective, dynamic hand-drawn composition, dreamy atmospheric perspective',
    renderNotes: 'clean precise linework, multi-layered cel shading, richly detailed painted backgrounds, ethereal vibrant sky',
  },
  '3d-animated': {
    medium: 'premium 3D animated feature film render, Pixar and DreamWorks studio animation aesthetic',
    lighting: 'warm studio key lighting, soft subsurface scattering through skin and materials, soft ambient occlusion',
    optics: 'expressive character camera framing, clean soft tilt-shift depth of field, friendly dynamic angle',
    renderNotes: 'plush tactile surfaces, glossy lively eye highlights, polished high-budget CGI render, charming storytelling charm',
  },
  'digital-painting': {
    medium: 'masterpiece digital concept art, trending on ArtStation and DeviantArt, layered digital oil and gouache',
    lighting: 'dramatic chiaroscuro lighting, radiant color temperature contrast between cool shadows and warm highlights',
    optics: 'painterly depth, atmospheric fog, dynamic rule-of-thirds composition, sweeping leading lines',
    renderNotes: 'expressive textured brushwork, rich harmonious color palette, high fantasy concept art detail, award-winning illustration',
  },
  cyberpunk: {
    medium: 'neo-Tokyo sci-fi cinematic render, Unreal Engine 5 with ray-traced reflections',
    lighting: 'vivid neon signage in magenta, cyan, and electric amber reflecting off rain-slicked wet pavement, misty volumetric smog',
    optics: 'wide-angle dynamic street-level perspective, subtle chromatic aberration on bright neon edges',
    renderNotes: 'intricate holographic displays, hyper-detailed futuristic mechanical greebles, gritty atmospheric realism, 8k resolution',
  },
};

/**
 * Automatically crafts a ChatGPT / DALL-E 3 style enriched prompt.
 */
export function enhancePromptLikeChatGPT(
  input: string,
  options?: PromptEnhancementOptions
): EnhancedPromptResult {
  const raw = input.trim();
  if (!raw) {
    return {
      originalPrompt: '',
      enhancedPrompt: '',
      negativePrompt: '',
      detectedSubject: 'general',
      detectedStyle: 'photorealistic',
      enhancementSummary: 'Empty prompt provided.',
    };
  }

  // Detect style
  const requestedStyle = (options?.style || 'photorealistic').toLowerCase();
  const styleConfig = STYLE_FRAMEWORKS[requestedStyle] || STYLE_FRAMEWORKS.photorealistic;

  // Detect subject type
  let detectedSubjectType = 'general';
  for (const p of SUBJECT_PATTERNS) {
    if (p.regex.test(raw)) {
      detectedSubjectType = p.type;
      break;
    }
  }

  // If prompt is already very long (> 50 words) and detailed, don't over-stuff
  const wordCount = raw.split(/\s+/).length;
  if (wordCount > 50) {
    return {
      originalPrompt: raw,
      enhancedPrompt: `${raw}, ${styleConfig.lighting}, ${styleConfig.optics}, ${styleConfig.renderNotes}`,
      negativePrompt: getNegativePromptForStyle(requestedStyle),
      detectedSubject: detectedSubjectType,
      detectedStyle: requestedStyle,
      enhancementSummary: 'Polished existing detailed prompt with cinematic lighting and optical depth.',
    };
  }

  // Construct DALL-E 3 / ChatGPT narrative composition
  let enhancedSubjectDescription = '';
  let contextualSetting = '';
  let atmosphericMood = '';

  switch (detectedSubjectType) {
    case 'portrait':
      enhancedSubjectDescription = `A captivating, highly detailed portrait of ${raw}, featuring natural and authentic facial expressions, lifelike skin texture with visible pores and fine peach fuzz, luminous catchlights in the eyes, and finely textured hair with individual strands catching the light`;
      contextualSetting = 'situated in an elegantly composed environment with soft architectural depth and gentle environmental storytelling';
      atmosphericMood = 'warm golden rim lighting outlining the silhouette, subtle atmospheric dust motes floating in ambient light shafts, serene and evocative mood';
      break;

    case 'animal':
      enhancedSubjectDescription = `An extraordinary, lifelike close-up depiction of ${raw}, showcasing realistic fur/feather/scale textures with authentic physical sheen, lifelike expressive eyes full of intelligence, and an agile natural posture`;
      contextualSetting = 'immersed in its natural habitat with lush surrounding foliage, textured terrain, and scenic organic depth';
      atmosphericMood = 'golden hour sunlight filtering through the canopy, soft morning mist, crisp droplets of dew, breathtaking documentary wildlife realism';
      break;

    case 'vehicle':
      enhancedSubjectDescription = `An aerodynamic, breathtaking presentation of ${raw}, displaying immaculate polished paintwork with specular reflections, intricate mechanical details in the wheels, brake calipers, and body contours, and sleek aerodynamic styling`;
      contextualSetting = 'positioned on an open winding coastal highway at dusk or against a sleek modern architectural pavilion';
      atmosphericMood = 'dramatic low-angle hero composition, headlights casting sharp beams through evening twilight, subtle road spray and dynamic reflections';
      break;

    case 'landscape':
      enhancedSubjectDescription = `A panoramic, majestic vista of ${raw}, featuring layered geological depth, sweeping mountain ridges or coastal horizons, and rich organic ground textures from alpine wildflowers to rugged stone`;
      contextualSetting = 'under an expansive dramatic sky with sculpted billowing clouds and atmospheric haze extending toward the distant horizon';
      atmosphericMood = 'spectacular golden hour lighting, radiant warm rays piercing mountain crevices, reflecting crystal-clear water with soft ripples, serene and breathtaking majesty';
      break;

    case 'cityscape':
    case 'architecture':
      enhancedSubjectDescription = `A masterfully designed scene depicting ${raw}, featuring authentic material textures such as brushed steel, weathered brick, reflective glass curtain walls, and intricate structural geometry`;
      contextualSetting = 'surrounded by an atmospheric urban environment with street-level life, ambient glow from interior windows, and balanced architectural perspective';
      atmosphericMood = 'dusk twilight atmosphere with glowing ambient streetlamps, soft wet pavement reflections, volumetric fog, and pristine architectural balance';
      break;

    case 'food':
      enhancedSubjectDescription = `An exquisite, mouth-watering culinary presentation of ${raw}, highlighting glistening glaze, crispy textures, fresh garnish microgreens, and delicate wisps of warm steam rising`;
      contextualSetting = 'artfully plated on dark artisanal ceramic tableware atop a rustic reclaimed timber surface with scattered ingredients';
      atmosphericMood = 'soft diffused window light highlighting fresh textures, shallow macro depth of field with dreamy creamy bokeh, Michelin-star culinary photography';
      break;

    default:
      enhancedSubjectDescription = `A visually arresting, intricately detailed depiction of ${raw}, rendered with impeccable attention to form, proportion, and tactile material qualities`;
      contextualSetting = 'set within a cohesive, rich environment providing depth, scale, and compelling context';
      atmosphericMood = 'dynamic lighting with balanced contrast between warm specular highlights and deep soft shadows, cinematic atmosphere';
      break;
  }

  // Assemble the unified ChatGPT-grade prompt
  const parts = [
    enhancedSubjectDescription,
    contextualSetting,
    atmosphericMood,
    styleConfig.medium,
    styleConfig.lighting,
    styleConfig.optics,
    styleConfig.renderNotes,
  ];

  const enhancedPrompt = parts.filter(Boolean).join(', ');
  const negativePrompt = getNegativePromptForStyle(requestedStyle);

  return {
    originalPrompt: raw,
    enhancedPrompt,
    negativePrompt,
    detectedSubject: detectedSubjectType,
    detectedStyle: requestedStyle,
    enhancementSummary: `Enhanced into a DALL-E 3 / ChatGPT narrative composition with ${detectedSubjectType} specifics, ${requestedStyle} lighting, and optical depth.`,
  };
}

/**
 * Returns optimized negative prompts to eliminate common generation defects.
 */
export function getNegativePromptForStyle(style?: string): string {
  const baseNegatives = [
    'blurry',
    'deformed',
    'bad anatomy',
    'bad hands',
    'missing fingers',
    'extra fingers',
    'mutated hands',
    'poorly drawn face',
    'disfigured',
    'distorted',
    'extra limbs',
    'cloned face',
    'gross proportions',
    'malformed limbs',
    'missing arms',
    'missing legs',
    'extra arms',
    'extra legs',
    'fused fingers',
    'too many fingers',
    'long neck',
    'low quality',
    'worst quality',
    'jpeg artifacts',
    'signature',
    'watermark',
    'username',
    'cropped',
    'out of frame',
  ];

  if (style === 'photorealistic' || style === 'cinematic') {
    baseNegatives.push('cartoon', 'anime', '3d render', 'illustration', 'doll', 'plastic skin', 'oversaturated');
  } else if (style === 'anime' || style === 'manga') {
    baseNegatives.push('photorealistic', '3d realistic', 'photograph');
  }

  return baseNegatives.join(', ');
}

