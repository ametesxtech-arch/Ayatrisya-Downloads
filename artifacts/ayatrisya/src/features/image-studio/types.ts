export type ImageStyleId =
  | 'photorealistic'
  | 'cinematic'
  | 'anime'
  | 'manga'
  | '3d-animated'
  | 'stylized-3d'
  | 'digital-painting'
  | 'watercolor'
  | 'oil-painting'
  | 'comic-book'
  | 'pixel-art'
  | 'fantasy-concept-art'
  | 'sci-fi'
  | 'minimalist-illustration'
  | 'product-photography'
  | 'architecture-visualization'
  | 'vintage-film'
  | 'sketch'
  | 'custom';

export interface ImageStylePreset {
  id: ImageStyleId;
  label: string;
  category: 'Photorealism' | 'Illustration & Art' | 'Animation & 3D' | 'Retro & Classical' | 'Specialized';
  description: string;
  promptModifier: string;
  badge: string;
  iconName: string;
}

export type CharacterConsistencyMode =
  | 'consistent-face-and-outfit'
  | 'consistent-face-allow-outfit-changes';

export interface CharacterProfile {
  id: string;
  name: string;
  appearance: string; // build, age, height, physical build
  hairstyle: string; // hair style, length, texture, color
  facialFeatures: string; // eyes, jawline, nose, facial hair, distinct marks
  skinTone: string; // complexion, skin tone
  clothing: string; // signature/default outfit
  accessories: string; // jewelry, glasses, headwear, gear
  personality: string; // expression, demeanor, posture
  referenceImageAttachmentId?: string;
  referenceImageUrl?: string;
  consistencyMode: CharacterConsistencyMode;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedImageDetails {
  blob: Blob;
  fileName: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: 'PNG' | 'JPEG';
  aspectRatio: string;
}

export interface ImageStudioMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // The user input or conversational summary
  timestamp: number;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  error?: string;
  effectivePrompt?: string; // Full prompt synthesized with character/style/refinement
  refinementContext?: string; // Summary of follow-up adjustments
  appliedStyleId?: ImageStyleId;
  appliedCustomStyle?: string;
  appliedCharacterId?: string;
  appliedCharacterName?: string;
  referenceParentId?: string; // ID of the message used as reference
  generated?: GeneratedImageDetails;
  generationOptions?: {
    format: 'PNG' | 'JPEG';
    aspectRatio: string;
    width: number;
    height: number;
  };
}

export type CloudImageConsentScope = 'device' | 'session' | 'none';
