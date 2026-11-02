/**
 * Detects whether a user prompt is an explicit or natural-language request to generate an image.
 *
 * Rules:
 * 1. Explicit commands: `/image <prompt>`, `/img <prompt>`
 * 2. Natural language imperatives:
 *    - "Generate an image of [prompt]"
 *    - "Create an image of [prompt]"
 *    - "Make an image of [prompt]"
 *    - "Draw an image of [prompt]"
 *    - "Draw a picture of [prompt]"
 *    - "Illustrate [prompt]"
 *    - "Paint an image of [prompt]"
 * 3. False-positive guards:
 *    - Explanatory, definition, or meta questions ("How does image generation work?", "Explain image compression", "What is an image sensor?", "Compare image formats")
 *      MUST NOT trigger image generation.
 */

export interface ImageIntentDetection {
  isImageRequest: boolean;
  isExplicitCommand: boolean;
  cleanPrompt: string;
}

const EXPLICIT_IMAGE_CMD_REGEX = /^\/(image|img)\s+/i;

const NATURAL_IMAGE_PATTERNS = [
  /^(?:please\s+)?(?:generate|create|render|produce)\s+(?:an?\s+)?image\s+(?:of|showing|depicting|with)\s+(.+)$/i,
  /^(?:please\s+)?(?:make|draw|paint|sketch)\s+(?:an?\s+)?(?:image|picture|illustration|painting|drawing)\s+(?:of|showing|depicting|with)\s+(.+)$/i,
  /^(?:please\s+)?(?:draw|illustrate|paint)\s+(?:me\s+)?(?:an?\s+)?(?:picture|image|scene|portrait)\s+(?:of|showing|depicting|with)?\s*(.+)$/i,
  /^(?:can\s+you\s+)?(?:generate|create|make|draw)\s+(?:an?\s+)?image\s+(?:of|showing|depicting|with)\s+(.+)$/i,
  /^(?:i\s+(?:want|need)\s+(?:an?\s+)?(?:image|picture|illustration)\s+(?:of|showing|depicting|with)\s+)(.+)$/i,
];

const EXPLANATORY_GUARDS = [
  /\b(?:how\s+(?:does|do|can|is)|why\s+(?:does|do|is)|what\s+is|explain|describe|tell\s+me\s+about|compare|difference\s+between|tutorial|guide)\b/i,
  /\b(?:how\s+to\s+generate|how\s+image\s+generation\s+works)\b/i,
  /\b(?:code|function|algorithm|library|api|script|python|javascript|model)\b/i,
];

export function detectImageRequest(input: string): ImageIntentDetection {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isImageRequest: false, isExplicitCommand: false, cleanPrompt: "" };
  }

  // 1. Explicit command check
  if (EXPLICIT_IMAGE_CMD_REGEX.test(trimmed)) {
    const cleanPrompt = trimmed.replace(EXPLICIT_IMAGE_CMD_REGEX, "").trim();
    return {
      isImageRequest: Boolean(cleanPrompt),
      isExplicitCommand: true,
      cleanPrompt,
    };
  }

  // 2. Reject if starts with or contains strong explanatory indicators
  for (const guard of EXPLANATORY_GUARDS) {
    if (guard.test(trimmed)) {
      return { isImageRequest: false, isExplicitCommand: false, cleanPrompt: "" };
    }
  }

  // 3. Match natural language patterns
  for (const pattern of NATURAL_IMAGE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1]) {
      const cleanPrompt = match[1].replace(/[.!?]+$/, "").trim();
      if (cleanPrompt.length >= 3) {
        return {
          isImageRequest: true,
          isExplicitCommand: false,
          cleanPrompt,
        };
      }
    }
  }

  return { isImageRequest: false, isExplicitCommand: false, cleanPrompt: "" };
}
