import type { ImageStyleId, ImageStylePreset } from './types';

export const IMAGE_STYLE_PRESETS: readonly ImageStylePreset[] = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    category: 'Photorealism',
    badge: 'Real',
    iconName: 'Camera',
    description: 'Crisp, natural photography with true-to-life textures, optics, and daylight.',
    promptModifier: 'photorealistic, ultra-high resolution, shot on 35mm lens, realistic skin and surface textures, natural ambient lighting, rich depth of field, 8k photographic fidelity',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    category: 'Photorealism',
    badge: 'Film',
    iconName: 'Film',
    description: 'Dramatic lighting, anamorphic ratio, shallow depth of field, and film grading.',
    promptModifier: 'cinematic film still, anamorphic lens flare, dramatic volumetric lighting, 35mm motion picture composition, moody atmospheric haze, blockbuster Hollywood color grading',
  },
  {
    id: 'anime',
    label: 'Anime',
    category: 'Animation & 3D',
    badge: 'Anime',
    iconName: 'Sparkles',
    description: 'Modern Japanese anime aesthetic with clean linework, vibrant cel shading, and vivid color.',
    promptModifier: 'modern anime style, clean crisp line art, vibrant cel shading, detailed background illustration, Makoto Shinkai inspired luminous sky, high-quality Japanese animation production',
  },
  {
    id: 'manga',
    label: 'Manga',
    category: 'Illustration & Art',
    badge: 'Manga',
    iconName: 'BookOpen',
    description: 'Black-and-white ink manga art with halftone screentones and expressive crosshatching.',
    promptModifier: 'manga art style, fine black ink crosshatching, traditional halftone dot screentones, dynamic panel composition, dramatic high-contrast ink drawing, graphic novel aesthetic',
  },
  {
    id: '3d-animated',
    label: '3D Animated',
    category: 'Animation & 3D',
    badge: '3D Film',
    iconName: 'Box',
    description: 'Feature-film 3D character animation with soft subsurface scattering and rich lighting.',
    promptModifier: '3D animated feature film render, Pixar and DreamWorks aesthetic, warm subsurface scattering, expressive character features, soft ambient occlusion, polished CGI lighting',
  },
  {
    id: 'stylized-3d',
    label: 'Stylized 3D',
    category: 'Animation & 3D',
    badge: 'Clay/Toy',
    iconName: 'Shapes',
    description: 'Playful low-poly clay or vinyl figurine style with soft shadows and miniature tilt-shift.',
    promptModifier: 'stylized 3D render, smooth matte vinyl and clay texture, isometric tilt-shift perspective, rounded forms, soft studio lighting, cute miniature diorama aesthetic',
  },
  {
    id: 'digital-painting',
    label: 'Digital Painting',
    category: 'Illustration & Art',
    badge: 'ArtStation',
    iconName: 'Palette',
    description: 'Expressive painterly strokes, layered textures, and high-concept digital art.',
    promptModifier: 'digital concept art painting, visible textured brushstrokes, rich color blending, layered lighting, fantasy illustration masterwork, trending on ArtStation',
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    category: 'Illustration & Art',
    badge: 'Water',
    iconName: 'Droplets',
    description: 'Wet-on-wet pigments with translucent washes and organic bleeds on textured paper.',
    promptModifier: 'delicate watercolor painting, wet-on-wet pigment washes, soft translucent pigment bleeding, raw cotton cold-press paper grain, subtle pencil under-drawing, luminous fluid colors',
  },
  {
    id: 'oil-painting',
    label: 'Oil Painting',
    category: 'Retro & Classical',
    badge: 'Canvas',
    iconName: 'Brush',
    description: 'Classical canvas texture, heavy impasto, rich glazes, and dramatic chiaroscuro.',
    promptModifier: 'classical oil on canvas painting, visible impasto knife strokes, cracked glaze texture, dramatic chiaroscuro lighting, rich deep pigments, Renaissance fine art masterwork',
  },
  {
    id: 'comic-book',
    label: 'Comic Book',
    category: 'Illustration & Art',
    badge: 'Comic',
    iconName: 'Zap',
    description: 'Bold black contour inking with vintage Ben-Day dots and vibrant retro palettes.',
    promptModifier: 'vintage comic book art style, bold dynamic black ink outlines, authentic Ben-Day print dots, vibrant saturated primary colors, 1980s graphic novel cover art',
  },
  {
    id: 'pixel-art',
    label: 'Pixel Art',
    category: 'Retro & Classical',
    badge: 'Retro',
    iconName: 'Grid',
    description: '16-bit retro arcade aesthetic with sharp pixel alignment and nostalgic palettes.',
    promptModifier: 'pixel art style, authentic 16-bit retro game graphics, precise grid alignment, vibrant limited color palette, nostalgic SNES era sprite aesthetic, clean pixel edges',
  },
  {
    id: 'fantasy-concept-art',
    label: 'Fantasy Concept Art',
    category: 'Illustration & Art',
    badge: 'Fantasy',
    iconName: 'Compass',
    description: 'Grand scale environments with ethereal volumetric glow and mystical atmosphere.',
    promptModifier: 'high fantasy concept art, sweeping monumental scale, mystical volumetric god rays, ethereal magical particles, lush epic world-building, breathtaking panoramic perspective',
  },
  {
    id: 'sci-fi',
    label: 'Sci-Fi',
    category: 'Specialized',
    badge: 'Cyber',
    iconName: 'Cpu',
    description: 'Futuristic aesthetic with neon holograms, high-tech surfaces, and cyberpunk sheen.',
    promptModifier: 'futuristic science fiction concept, sleek cybernetic technology, neon volumetric reflections, holographic user interfaces, hard-surface industrial engineering, cyberpunk atmosphere',
  },
  {
    id: 'minimalist-illustration',
    label: 'Minimalist Illustration',
    category: 'Illustration & Art',
    badge: 'Vector',
    iconName: 'Minimize2',
    description: 'Clean vector contours, deliberate negative space, and modern editorial elegance.',
    promptModifier: 'minimalist vector illustration, clean geometric lines, flat tasteful color palette, generous negative space, modern editorial graphic design, elegant contemporary simplicity',
  },
  {
    id: 'product-photography',
    label: 'Product Photography',
    category: 'Photorealism',
    badge: 'Studio',
    iconName: 'Package',
    description: 'Commercial lightbox lighting, ultra-sharp subject focus, and clean neutral backdrops.',
    promptModifier: 'commercial product studio photography, clean white and neutral cyclorama backdrop, soft diffused rim lighting, razor-sharp focus on materials, luxury advertising aesthetic',
  },
  {
    id: 'architecture-visualization',
    label: 'Architecture Visualization',
    category: 'Specialized',
    badge: 'ArchViz',
    iconName: 'Building',
    description: 'Clean structural renders with realistic glass reflections, concrete, and golden hour light.',
    promptModifier: 'architectural visualization, ArchViz render, realistic glass reflections and concrete textures, golden hour warm sunlight, professional architectural photography, balanced perspective',
  },
  {
    id: 'vintage-film',
    label: 'Vintage Film',
    category: 'Retro & Classical',
    badge: '35mm',
    iconName: 'Disc',
    description: '1970s analog photography with authentic grain, slight light leaks, and warm nostalgic hues.',
    promptModifier: 'vintage 35mm analog photograph, authentic film grain, gentle nostalgic light leaks, warm muted color palette, Kodachrome film stock, 1970s retro photographic nostalgia',
  },
  {
    id: 'sketch',
    label: 'Sketch',
    category: 'Illustration & Art',
    badge: 'Pencil',
    iconName: 'Feather',
    description: 'Hand-drawn graphite pencil drawing with expressive hatching and paper grain.',
    promptModifier: 'hand-drawn graphite pencil sketch, delicate crosshatched shading, textured rough sketch paper, loose expressive line work, artist sketchbook study, monochromatic graphite',
  },
  {
    id: 'custom',
    label: 'Custom Style',
    category: 'Specialized',
    badge: 'Custom',
    iconName: 'Sliders',
    description: 'Specify your own custom artistic style, artist influences, or visual aesthetics.',
    promptModifier: '',
  },
] as const;

export function getStylePreset(styleId: ImageStyleId | undefined): ImageStylePreset {
  return IMAGE_STYLE_PRESETS.find((preset) => preset.id === styleId) ?? IMAGE_STYLE_PRESETS[0];
}

export function applyStylePreset(
  basePrompt: string,
  styleId: ImageStyleId | undefined,
  customPromptModifier?: string,
): string {
  const trimmed = basePrompt.trim();
  if (!styleId) return trimmed;

  if (styleId === 'custom') {
    const customMod = (customPromptModifier || '').trim();
    if (!customMod) return trimmed;
    return `${trimmed}, ${customMod}`;
  }

  const preset = getStylePreset(styleId);
  if (!preset.promptModifier) return trimmed;
  return `${trimmed}, ${preset.promptModifier}`;
}
