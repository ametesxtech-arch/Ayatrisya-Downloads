/**
 * Ayatrisya Neural Vision — Advanced Image Prompt Enhancement Engine (v2.5)
 * 
 * Transforms raw user requests into rich, vivid, cinematic, and photorealistic
 * narrative descriptive prompts following modern state-of-the-art diffusion principles
 * (FLUX.1, SDXL, Imagen 3, Midjourney v6).
 * 
 * Key Pillars:
 * 1. Physical Anatomy & Material Realism (subsurface scattering, authentic cloth textures, visible pores, corneal catchlights)
 * 2. Optical Camera Physics (anamorphic widescreen, 85mm f/1.2 portrait bokeh, 24mm tilt-shift architectural clarity)
 * 3. Volumetric Environmental Lighting (Rembrandt key light, golden hour atmospheric haze, chromatic caustics, rim highlights)
 * 4. Compositional Storytelling (rule of thirds, leading lines, organic motion, atmospheric particles)
 * 5. Style-Specific Negative Prompting (eliminates structural deformities, plastic skin, unwanted artifacts)
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

// Subject detection patterns
const SUBJECT_PATTERNS = [
  { type: 'portrait', regex: /\b(woman|man|girl|boy|person|portrait|face|model|warrior|wizard|astronaut|cyborg|knight|queen|king|elderly|child|samurai|ninja|monk|priest|pilot|scientist)\b/i },
  { type: 'animal', regex: /\b(cat|dog|tiger|lion|wolf|bird|dragon|horse|fox|bear|elephant|eagle|owl|kitten|puppy|fish|whale|creature|monster|phoenix|panther|cheetah|leopard|deer|stag|falcon|hawk|dolphin|shark)\b/i },
  { type: 'vehicle', regex: /\b(car|supercar|hypercar|spaceship|motorcycle|plane|ship|boat|train|cyberpunk car|jet|rover|mech|mecha|submarine|yacht|aircraft)\b/i },
  { type: 'landscape', regex: /\b(mountain|forest|ocean|beach|lake|desert|waterfall|sunset|sunrise|canyon|valley|island|jungle|stars|galaxy|nebula|glacier|aurora|cliffs|fjord)\b/i },
  { type: 'cityscape', regex: /\b(city|cyberpunk|tokyo|street|building|skyline|futuristic city|village|castle|alley|interior|room|cafe|cabin|metropolis|bazaar|market)\b/i },
  { type: 'architecture', regex: /\b(house|villa|skyscraper|museum|temple|cathedral|ruins|bridge|monument|penthouse|palace|pagoda|observatory|pavilion)\b/i },
  { type: 'food', regex: /\b(coffee|burger|cake|ramen|pizza|sushi|cocktail|dessert|tea|pasta|fruit|feast|steak|pastry|bread|wine|soup)\b/i },
  { type: 'macro', regex: /\b(flower|petal|insect|butterfly|drop|droplet|crystal|gem|jewelry|watch|eye|snowflake|leaf)\b/i },
];

// Style-specific aesthetic frameworks
const STYLE_FRAMEWORKS: Record<string, {
  medium: string;
  lighting: string;
  optics: string;
  renderNotes: string;
}> = {
  photorealistic: {
    medium: 'high-end commercial editorial photography, Hasselblad H6D-100c medium format camera with 85mm f/1.2 lens',
    lighting: 'natural directional daylight, gentle softbox fill, warm organic ambient illumination, realistic specular highlights',
    optics: 'crisp edge-to-edge focus on central subject, smooth natural circular bokeh roll-off, authentic depth of field',
    renderNotes: 'ultra-realistic tactile textures, fine skin pores, subsurface scattering, authentic micro-textures, 8k photographic masterwork',
  },
  cinematic: {
    medium: '35mm Panavision anamorphic motion picture still, Kodak Vision3 500T 5219 film stock, master film director color grading',
    lighting: 'dramatic three-point lighting, atmospheric volumetric haze, glowing rim light, deep cinematic contrast with soft shadow roll-off',
    optics: 'anamorphic horizontal lens flare, subtle optical vignetting, cinematic 2.39:1 widescreen framing, shallow focus',
    renderNotes: 'blockbuster Hollywood film production quality, atmospheric depth, cinematic mist and particle dust, evocative storytelling',
  },
  anime: {
    medium: 'modern Japanese theatrical anime illustration, inspired by Makoto Shinkai and Ufotable cinema productions',
    lighting: 'luminous golden hour sunlight, sunbeams piercing through clouds, vibrant glowing highlights and colorful rim light',
    optics: 'painterly wide-angle perspective, dynamic hand-drawn composition, dreamy atmospheric perspective',
    renderNotes: 'clean precise linework, multi-layered cel shading, richly detailed painted backgrounds, ethereal vibrant sky',
  },
  '3d-animated': {
    medium: 'premium 3D animated feature film render, Pixar and DreamWorks studio animation aesthetic, RenderMan illumination',
    lighting: 'warm studio key lighting, soft subsurface scattering through skin and materials, soft ambient occlusion',
    optics: 'expressive character camera framing, clean soft tilt-shift depth of field, friendly dynamic angle',
    renderNotes: 'plush tactile surfaces, glossy lively eye highlights, polished high-budget CGI render, charming storytelling charm',
  },
  'digital-painting': {
    medium: 'masterpiece digital concept art, trending on ArtStation and Behance, layered digital oil and impasto brushwork',
    lighting: 'dramatic chiaroscuro lighting, radiant color temperature contrast between cool shadows and warm highlights',
    optics: 'painterly depth, atmospheric fog, dynamic rule-of-thirds composition, sweeping leading lines',
    renderNotes: 'expressive textured brushwork, rich harmonious color palette, high fantasy concept art detail, award-winning illustration',
  },
  cyberpunk: {
    medium: 'neo-Tokyo sci-fi cinematic render, Unreal Engine 5 with real-time ray-traced reflections',
    lighting: 'vivid neon signage in magenta, cyan, and electric amber reflecting off rain-slicked wet pavement, misty volumetric smog',
    optics: 'wide-angle dynamic street-level perspective, subtle chromatic aberration on bright neon edges',
    renderNotes: 'intricate holographic displays, hyper-detailed futuristic mechanical greebles, gritty atmospheric realism, 8k resolution',
  },
  'dark-fantasy': {
    medium: 'dark fantasy oil masterpiece, inspired by Caravaggio and Frank Frazetta, gothic atmospheric oil painting',
    lighting: 'dramatic candlelight and burning embers, deep velvety shadows, ominous ethereal moonbeams, striking golden highlights',
    optics: 'intense brooding focal depth, powerful cinematic silhouette framing, majestic scale',
    renderNotes: 'intricate weathered armor textures, mystical ambient smoke, dark gothic elegance, museum-grade classical realism',
  },
  'vintage-film': {
    medium: 'vintage 1970s analog film photography, authentic Kodachrome 64 color palette, Leica M3 rangefinder camera',
    lighting: 'warm nostalgic sunlight, hazy afternoon glow, organic lens flares, soft desaturated shadow tones',
    optics: 'classic 50mm f/1.4 prime lens aesthetic, authentic organic film grain, natural optical falloff',
    renderNotes: 'timeless retro atmosphere, tactile analog imperfections, authentic nostalgic warmth, archival magazine quality',
  },
  architectural: {
    medium: 'architectural design photography, Architectural Digest editorial feature, Canon TS-E 24mm f/3.5L II tilt-shift lens',
    lighting: 'sculptural architectural illumination, clean geometric shadows, warm interior ambient lights balanced with blue hour twilight',
    optics: 'perfect vertical perspective lines with zero keystone distortion, expansive wide-angle framing, crisp architectural detail',
    renderNotes: 'tactile raw concrete, brushed black steel, warm Scandinavian oak, immaculate glass reflections, pristine modern luxury',
  },
};

/**
 * Automatically crafts a rich, high-fidelity descriptive prompt
 * using the Ayatrisya Neural Vision prompting engine.
 */
export function enhanceImagePrompt(
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
      enhancementSummary: 'Refined prompt with cinematic lighting, optical depth, and material textures.',
    };
  }

  // Construct Ayatrisya Vision narrative composition
  let enhancedSubjectDescription = '';
  let contextualSetting = '';
  let atmosphericMood = '';

  switch (detectedSubjectType) {
    case 'portrait':
      enhancedSubjectDescription = `A captivating, masterfully composed portrait of ${raw}, featuring authentic lifelike skin texture with visible pores and delicate peach fuzz, luminous catchlights in the expressive eyes, and natural hair strands catching directional light with fine individual definition`;
      contextualSetting = 'situated in an elegantly balanced architectural or natural setting providing gentle narrative context and organic depth';
      atmosphericMood = 'warm golden rim lighting outlining the silhouette, subtle atmospheric dust motes floating in soft ambient light beams, evocative emotional depth';
      break;

    case 'animal':
      enhancedSubjectDescription = `An extraordinary, lifelike depiction of ${raw}, showcasing realistic fur, feather, or scale textures with authentic natural sheen, highly expressive eyes full of intelligence, and an agile, dignified posture`;
      contextualSetting = 'immersed in its natural pristine habitat with lush textured terrain, rich foliage, and realistic organic depth';
      atmosphericMood = 'golden hour sunlight filtering through the canopy, soft morning mist, crisp droplets of dew, breathtaking National Geographic wildlife realism';
      break;

    case 'vehicle':
      enhancedSubjectDescription = `An immaculate, aerodynamic presentation of ${raw}, displaying mirror-finish polished paintwork with crisp environment reflections, intricate mechanical details in the wheels, brake calipers, and body contours, and sleek aggressive styling`;
      contextualSetting = 'positioned on an open winding coastal highway at dusk or within a minimalist modern architectural pavilion';
      atmosphericMood = 'dramatic low-angle hero perspective, headlights casting sharp volumetric beams through evening twilight, subtle road spray and dynamic reflections';
      break;

    case 'landscape':
      enhancedSubjectDescription = `A panoramic, majestic vista of ${raw}, featuring layered geological depth, sweeping mountain ridges or coastal horizons, and rich organic ground textures from alpine wildflowers to rugged weathered stone`;
      contextualSetting = 'under an expansive dramatic sky with sculpted billowing clouds and atmospheric haze extending toward the distant horizon';
      atmosphericMood = 'spectacular golden hour lighting, radiant warm rays piercing mountain crevices, reflecting crystal-clear water with soft ripples, serene and breathtaking majesty';
      break;

    case 'cityscape':
      enhancedSubjectDescription = `A bustling, visually rich cityscape capturing ${raw}, featuring authentic material textures such as weathered brick, brushed steel, reflective glass curtain walls, and intricate street-level geometry`;
      contextualSetting = 'surrounded by an atmospheric urban environment with street-level life, ambient glow from interior windows, and balanced architectural perspective';
      atmosphericMood = 'dusk twilight atmosphere with glowing ambient streetlamps, soft wet pavement reflections, volumetric fog, and pristine architectural balance';
      break;

    case 'architecture':
      enhancedSubjectDescription = `A masterfully designed architectural presentation of ${raw}, featuring authentic material textures such as brushed steel, cast concrete, warm timber slats, and floor-to-ceiling glass pavilions`;
      contextualSetting = 'seamlessly integrated into a manicured landscape with serene reflecting pools, lush greenery, and sculptural exterior lighting';
      atmosphericMood = 'balanced architectural twilight lighting, warm interior illumination glowing through glass, crisp geometrical shadows, magazine-grade composition';
      break;

    case 'food':
      enhancedSubjectDescription = `An exquisite, mouth-watering culinary presentation of ${raw}, highlighting glistening glaze, crispy textures, fresh garnish microgreens, and delicate wisps of warm steam rising`;
      contextualSetting = 'artfully plated on dark artisanal ceramic tableware atop a rustic reclaimed timber surface with scattered raw ingredients';
      atmosphericMood = 'soft diffused window light highlighting fresh textures, shallow macro depth of field with dreamy creamy bokeh, Michelin-star culinary photography';
      break;

    case 'macro':
      enhancedSubjectDescription = `An astonishing extreme macro photograph of ${raw}, revealing microscopic crystalline patterns, delicate surface venation, and shimmering light refraction with intense tactile detail`;
      contextualSetting = 'framed against a softly blurred abstract background of complementary organic hues';
      atmosphericMood = 'precision ring-light illumination, sparkling prismatic caustic highlights, razor-sharp focal plane with creamy smooth bokeh falloff';
      break;

    default:
      enhancedSubjectDescription = `A visually arresting, intricately detailed depiction of ${raw}, rendered with impeccable attention to form, proportion, and tactile material qualities`;
      contextualSetting = 'set within a cohesive, rich environment providing depth, scale, and compelling context';
      atmosphericMood = 'dynamic lighting with balanced contrast between warm specular highlights and deep soft shadows, cinematic atmosphere';
      break;
  }

  // Assemble the unified Ayatrisya Vision prompt
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
    enhancementSummary: `Enhanced into an Ayatrisya Vision cinematic composition with ${detectedSubjectType} specifics, ${requestedStyle} lighting, and optical depth.`,
  };
}

/**
 * Alias for backward compatibility without the external name
 */
export const enhancePromptLikeChatGPT = enhanceImagePrompt;

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

  if (style === 'photorealistic' || style === 'cinematic' || style === 'architectural') {
    baseNegatives.push('cartoon', 'anime', '3d render', 'illustration', 'doll', 'plastic skin', 'oversaturated');
  } else if (style === 'anime' || style === 'manga') {
    baseNegatives.push('photorealistic', '3d realistic', 'photograph');
  } else if (style === '3d-animated') {
    baseNegatives.push('photorealistic photograph', 'flat 2d sketch', 'ugly wireframe');
  }

  return baseNegatives.join(', ');
}
