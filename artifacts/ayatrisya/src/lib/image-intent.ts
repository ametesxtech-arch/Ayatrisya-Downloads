/**
 * Detects whether a user prompt is an explicit or natural-language request to generate an image,
 * including multi-turn conversational follow-ups (e.g. "make that cow eating grass", "make it at night").
 *
 * Rules:
 * 1. Explicit commands: `/image <prompt>`, `/img <prompt>`
 * 2. Natural language imperatives:
 *    - "Generate an image of [prompt]"
 *    - "Create an image of [prompt]"
 *    - "Make an image of [prompt]"
 *    - "Make image of [prompt]"
 *    - "Draw an image of [prompt]"
 *    - "Draw a picture of [prompt]"
 *    - "Illustrate [prompt]"
 *    - "Paint an image of [prompt]"
 * 3. Conversational follow-ups (consistency across turns):
 *    - "Make that [subject] [action]" (e.g. "make that cow eating grass")
 *    - "Make it [action/modifier]" (e.g. "make it eating grass", "make it at night")
 *    - "Change the background to [setting]"
 *    - "Now show it [action]"
 *    - "Put [accessory] on it"
 * 4. False-positive guards:
 *    - Explanatory, definition, or meta questions ("How does image generation work?", "Explain image compression", "What is an image sensor?", "Compare image formats")
 *      MUST NOT trigger image generation.
 */

export interface ImageIntentDetection {
  isImageRequest: boolean;
  isExplicitCommand: boolean;
  cleanPrompt: string;
  isFollowUp?: boolean;
  previousSubject?: string;
  userFacingLabel?: string;
}

export interface ChatHistoryTurn {
  role: string;
  content?: string;
}

const EXPLICIT_IMAGE_CMD_REGEX = /^\/(image|img)\s+/i;

const NATURAL_IMAGE_PATTERNS = [
  /^(?:please\s+)?(?:generate|create|render|produce)\s+(?:an?\s+)?(?:image|photo|picture|illustration|painting)\s+(?:of|showing|depicting|with)?\s*(.+)$/i,
  /^(?:please\s+)?(?:make|draw|paint|sketch)\s+(?:an?\s+)?(?:image|photo|picture|illustration|painting|drawing)\s+(?:of|showing|depicting|with)?\s*(.+)$/i,
  /^(?:please\s+)?(?:draw|illustrate|paint)\s+(?:me\s+)?(?:an?\s+)?(?:picture|image|scene|portrait|photo)\s+(?:of|showing|depicting|with)?\s*(.+)$/i,
  /^(?:can\s+you\s+)?(?:generate|create|make|draw|render)\s+(?:an?\s+)?(?:image|photo|picture)\s+(?:of|showing|depicting|with)?\s*(.+)$/i,
  /^(?:i\s+(?:want|need)\s+(?:an?\s+)?(?:image|picture|photo|illustration)\s+(?:of|showing|depicting|with)\s+)(.+)$/i,
];

const EXPLANATORY_GUARDS = [
  /\b(?:how\s+(?:does|do|can|is)|why\s+(?:does|do|is)|what\s+is|explain|describe|tell\s+me\s+about|compare|difference\s+between|tutorial|guide)\b/i,
  /\b(?:how\s+to\s+generate|how\s+image\s+generation\s+works)\b/i,
  /\b(?:code|function|algorithm|library|api|script|python|javascript|model)\b/i,
];

/**
 * Extracts previous image generation subject/prompt from conversation turns.
 */
export function extractPreviousImagePrompt(history?: ChatHistoryTurn[]): string | null {
  if (!history || history.length === 0) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    const text = turn.content || "";

    // 1. Look for assistant generation notice: Generated image for **"<prompt>"**:
    const assistantMatch = /Generated image for \*\*"([^"]+)"\*\*/i.exec(text);
    if (assistantMatch && assistantMatch[1]) {
      return assistantMatch[1].trim();
    }

    // 2. Look for user turn that was an image request
    if (turn.role === "user") {
      const explicit = EXPLICIT_IMAGE_CMD_REGEX.exec(text.trim());
      if (explicit) {
        return text.trim().replace(EXPLICIT_IMAGE_CMD_REGEX, "").trim();
      }
      for (const pattern of NATURAL_IMAGE_PATTERNS) {
        const m = pattern.exec(text.trim());
        if (m && m[1]) {
          return m[1].replace(/[.!?]+$/, "").trim();
        }
      }
    }
  }

  return null;
}

/**
 * Synthesizes a consistent diffusion prompt anchored on the previous subject and style,
 * incorporating the requested modification (e.g. eating grass, nighttime, wearing a hat).
 */
export function synthesizeConsistentImagePrompt(
  actionOrModifier: string,
  previousSubject?: string | null
): string {
  const cleanAction = actionOrModifier.trim().replace(/[.!?]+$/, "");
  const subject = previousSubject?.trim() || "";

  if (subject) {
    // Action-specific expansion for natural results
    let actionDesc = cleanAction;
    if (/^eating\s+grass/i.test(cleanAction) || /^(?:eat|eating)\s+grass/i.test(cleanAction)) {
      actionDesc = "actively eating grass, grazing with head lowered into the lush green pasture";
    }

    return `A detailed, high quality photograph of the exact same ${subject} from the previous image, maintaining identical breed, physical markings, facial features, and visual style, ${actionDesc}, consistent character continuity, natural lighting, photorealistic, highly detailed 8k`;
  }

  // Fallback when no previous subject exists
  return `A detailed, high quality photograph of ${cleanAction}, natural lighting, photorealistic, cinematic composition, highly detailed`;
}

export function detectImageRequest(
  input: string,
  history?: ChatHistoryTurn[]
): ImageIntentDetection {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isImageRequest: false, isExplicitCommand: false, cleanPrompt: "" };
  }

  // 1. Explicit command check (/image, /img)
  if (EXPLICIT_IMAGE_CMD_REGEX.test(trimmed)) {
    const cleanPrompt = trimmed.replace(EXPLICIT_IMAGE_CMD_REGEX, "").trim();
    return {
      isImageRequest: Boolean(cleanPrompt),
      isExplicitCommand: true,
      cleanPrompt,
      userFacingLabel: cleanPrompt,
    };
  }

  // 2. Reject if starts with or contains strong explanatory indicators
  for (const guard of EXPLANATORY_GUARDS) {
    if (guard.test(trimmed)) {
      return { isImageRequest: false, isExplicitCommand: false, cleanPrompt: "" };
    }
  }

  // 3. Match natural language patterns (First-turn image creations)
  for (const pattern of NATURAL_IMAGE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match[1]) {
      const cleanPrompt = match[1].replace(/[.!?]+$/, "").trim();
      if (cleanPrompt.length >= 2) {
        return {
          isImageRequest: true,
          isExplicitCommand: false,
          cleanPrompt,
          userFacingLabel: cleanPrompt,
        };
      }
    }
  }

  // 4. Conversational follow-ups & image modifications (Consistency Across Turns)
  const previousSubject = extractPreviousImagePrompt(history);

  // Pattern: "make that <subject> <action>" (e.g. "make that cow eating grass", "make that dog run")
  const makeThatSubjectMatch = /^(?:please\s+)?(?:make|draw|paint|render|show)\s+(?:that|the)\s+([a-zA-Z0-9\s_-]+?)\s+(eating|running|jumping|flying|sleeping|standing|walking|swimming|wearing|holding|in|on|at|with|under)\s+(.+)$/i.exec(trimmed);
  if (makeThatSubjectMatch) {
    const subject = makeThatSubjectMatch[1].trim();
    const verb = makeThatSubjectMatch[2].trim();
    const rest = makeThatSubjectMatch[3].trim().replace(/[.!?]+$/, "");
    const action = `${verb} ${rest}`;
    const effectiveSubject = previousSubject || subject;
    const cleanPrompt = synthesizeConsistentImagePrompt(action, effectiveSubject);

    return {
      isImageRequest: true,
      isExplicitCommand: false,
      cleanPrompt,
      isFollowUp: true,
      previousSubject: effectiveSubject,
      userFacingLabel: `that ${effectiveSubject} ${action}`,
    };
  }

  // Pattern: "make that <subject> <action/modifier>" more generic (e.g. "make that cow eat grass")
  const makeThatGenericMatch = /^(?:please\s+)?(?:make|draw|paint|render|show)\s+(?:that|the)\s+([a-zA-Z0-9\s_-]+?)\s+(.+)$/i.exec(trimmed);
  if (makeThatGenericMatch) {
    const noun = makeThatGenericMatch[1].trim();
    const mod = makeThatGenericMatch[2].trim().replace(/[.!?]+$/, "");
    // Avoid false positives like "make that thing work" or programming tasks
    if (!/\b(?:work|run|compile|build|pass|fail|test|function|code|file|component|error)\b/i.test(mod)) {
      const effectiveSubject = previousSubject || noun;
      const cleanPrompt = synthesizeConsistentImagePrompt(mod, effectiveSubject);
      return {
        isImageRequest: true,
        isExplicitCommand: false,
        cleanPrompt,
        isFollowUp: true,
        previousSubject: effectiveSubject,
        userFacingLabel: `that ${effectiveSubject} ${mod}`,
      };
    }
  }

  // If a previous image exists in history, check pronoun and modifier follow-ups:
  if (previousSubject) {
    // Pattern: "make it <action/modifier>" (e.g. "make it eating grass", "make it at night", "make it black and white")
    const makeItMatch = /^(?:please\s+)?(?:make|render|draw|show)\s+(?:it|this)\s+(.+)$/i.exec(trimmed);
    if (makeItMatch) {
      const modifier = makeItMatch[1].trim().replace(/[.!?]+$/, "");
      if (!/\b(?:work|run|faster|simpler|better|clearer|shorter)\b/i.test(modifier)) {
        return {
          isImageRequest: true,
          isExplicitCommand: false,
          cleanPrompt: synthesizeConsistentImagePrompt(modifier, previousSubject),
          isFollowUp: true,
          previousSubject,
          userFacingLabel: `the ${previousSubject} (${modifier})`,
        };
      }
    }

    // Pattern: "now <action/modifier>" (e.g. "now eating grass", "now in the rain", "now at night")
    const nowMatch = /^now\s+(?:show\s+it\s+|make\s+it\s+)?(.+)$/i.exec(trimmed);
    if (nowMatch) {
      const modifier = nowMatch[1].trim().replace(/[.!?]+$/, "");
      return {
        isImageRequest: true,
        isExplicitCommand: false,
        cleanPrompt: synthesizeConsistentImagePrompt(modifier, previousSubject),
        isFollowUp: true,
        previousSubject,
        userFacingLabel: `the ${previousSubject} (${modifier})`,
      };
    }

    // Pattern: "add <something> to it / to the <subject>" or "put <something> on it"
    const addPutMatch = /^(?:now\s+)?(?:add|put)\s+(.+?)\s+(?:on|to|into|in)\s+(?:it|this|that|the\s+[a-zA-Z0-9\s_-]+)$/i.exec(trimmed);
    if (addPutMatch) {
      const accessory = addPutMatch[1].trim();
      const modifier = `with ${accessory}`;
      return {
        isImageRequest: true,
        isExplicitCommand: false,
        cleanPrompt: synthesizeConsistentImagePrompt(modifier, previousSubject),
        isFollowUp: true,
        previousSubject,
        userFacingLabel: `the ${previousSubject} with ${accessory}`,
      };
    }

    // Pattern: "change (the) background / setting to <something>"
    const changeBgMatch = /^(?:now\s+)?change\s+(?:the\s+)?(?:background|setting|scenery|environment)\s+to\s+(.+)$/i.exec(trimmed);
    if (changeBgMatch) {
      const newBg = changeBgMatch[1].trim().replace(/[.!?]+$/, "");
      const modifier = `in a ${newBg} setting`;
      return {
        isImageRequest: true,
        isExplicitCommand: false,
        cleanPrompt: synthesizeConsistentImagePrompt(modifier, previousSubject),
        isFollowUp: true,
        previousSubject,
        userFacingLabel: `the ${previousSubject} in ${newBg}`,
      };
    }
  }

  return { isImageRequest: false, isExplicitCommand: false, cleanPrompt: "" };
}
