/**
 * Unified Multimodal Creation Engine & Capability Registry for Ayatrisya Cloud/Web.
 *
 * Provides a single, deterministic contract for multimodal creation capabilities:
 * - Image Studio (FLUX-1-Schnell via Cloudflare Workers AI if configured / local fallback)
 * - Music & Audio (Local procedural WAV PCM RIFF synthesis + Web Speech API)
 * - 3D Models (Procedural glTF/GLB 2.0 binary mesh synthesis)
 * - Documents & Reports (Vector PDF-1.4 generation, Markdown, Plain text)
 * - Presentations (Office OpenXML .pptx deck generator, slide JSON)
 * - Video (Honest status: Generation unavailable on free tier; file upload & HTML5 playback supported)
 * - Code & Canvas (Syntax-aware canvas, multi-tab files, workspace export)
 */

export type CreationDomain =
  | 'image'
  | 'music'
  | 'model3d'
  | 'document'
  | 'presentation'
  | 'video'
  | 'code';

export interface CreationCapability {
  domain: CreationDomain;
  displayName: string;
  isAvailable: boolean;
  requiresAuth: boolean;
  isFree: boolean;
  provider: 'local-browser' | 'api-server' | 'unsupported';
  description: string;
  supportedFormats: string[];
  notes?: string;
}

export const CREATION_CAPABILITIES: Record<CreationDomain, CreationCapability> = {
  document: {
    domain: 'document',
    displayName: 'Prompt-to-Document Engine',
    isAvailable: true,
    requiresAuth: false,
    isFree: true,
    provider: 'local-browser',
    description: 'Generates structured multi-section reports, articles, and briefs from prompts with section-level regeneration, Markdown, and vector PDF export.',
    supportedFormats: ['pdf', 'md', 'txt'],
  },
  presentation: {
    domain: 'presentation',
    displayName: 'Prompt-to-Presentation Engine',
    isAvailable: true,
    requiresAuth: false,
    isFree: true,
    provider: 'local-browser',
    description: 'Generates structured multi-slide presentation decks from prompts with slide regeneration, JSON storage, and Office OpenXML (.pptx) export.',
    supportedFormats: ['pptx', 'json', 'txt'],
  },
  code: {
    domain: 'code',
    displayName: 'Code & Project Engine',
    isAvailable: true,
    requiresAuth: false,
    isFree: true,
    provider: 'local-browser',
    description: 'Plans and generates multi-file projects with architectural summaries, syntax-aware previews, file regeneration, and ZIP/file export.',
    supportedFormats: ['ts', 'tsx', 'js', 'json', 'py', 'css', 'html', 'md'],
  },
  music: {
    domain: 'music',
    displayName: 'Music & Audio Synthesizer',
    isAvailable: true,
    requiresAuth: false,
    isFree: true,
    provider: 'api-server',
    description: 'Procedural 16-bit 44.1kHz WAV PCM synthesis without paid generation credits or external servers. Disclosed as deterministic wave audio synthesis rather than deep neural weights.',
    supportedFormats: ['wav', 'audio/wav'],
    notes: 'Mathematical audio wave synthesis running deterministically with zero compute subscription costs.',
  },
  model3d: {
    domain: 'model3d',
    displayName: '3D Geometry Mesh Engine (Desktop Only)',
    isAvailable: false,
    requiresAuth: false,
    isFree: true,
    provider: 'unsupported',
    description: '3D model generation is strictly local Desktop-only. Cloud/Web generation is disabled to protect architectural boundaries.',
    supportedFormats: ['glb', 'gltf'],
    notes: 'Available exclusively in the Ayatrisya Desktop application with installed local engine.',
  },
  image: {
    domain: 'image',
    displayName: 'Image Studio',
    isAvailable: true,
    requiresAuth: true,
    isFree: true,
    provider: 'api-server',
    description: 'Conversational image generation engine with character consistency and artistic styles.',
    supportedFormats: ['png', 'webp', 'jpeg'],
    notes: 'Prioritizes Ayatrisya image model and high-fidelity providers.',
  },
  video: {
    domain: 'video',
    displayName: 'Video Studio (Desktop Only)',
    isAvailable: false,
    requiresAuth: false,
    isFree: true,
    provider: 'unsupported',
    description: 'Video generation is strictly Desktop-only and unavailable on Cloud/Web free tier. Local file upload and HTML5 playback are supported.',
    supportedFormats: ['mp4', 'webm'],
    notes: 'Exclusively available in Ayatrisya Desktop with local compute.',
  },
};

/**
 * Returns list of all creation capabilities and their real operational statuses.
 */
export function listCreationCapabilities(): CreationCapability[] {
  return Object.values(CREATION_CAPABILITIES);
}

/**
 * Verifies if a creation domain is operational.
 */
export function isCapabilityAvailable(domain: CreationDomain): boolean {
  return CREATION_CAPABILITIES[domain]?.isAvailable ?? false;
}

