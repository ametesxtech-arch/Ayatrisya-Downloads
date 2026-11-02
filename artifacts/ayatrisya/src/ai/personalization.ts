import type { AnswerStyle, PersonalizationPreferences } from "@/storage/types";
import type { ModelMessage } from "./types";

export const answerStyles: Record<AnswerStyle, string> = {
  concise: "Answer style: Concise. Be direct, punchy, and brief without sacrificing key accuracy.",
  detailed: "Answer style: Detailed. Provide comprehensive coverage, nuanced context, and deep explanations.",
  "step-by-step": "Answer style: Step-by-step. Break the response into numbered, progressive steps that are easy to follow.",
  teaching: "Answer style: Teaching/Tutor. Explain concepts patiently from foundational principles, using intuitive analogies and checks for understanding.",
  "exam-ready": "Answer style: Exam-ready. Structure your response with formal definitions, key formulas, clear numbered steps, essential marking points, and structured summaries. Do not invent unverified official marking schemes.",
  "examples-first": "Answer style: Examples-first. Lead directly with concrete, practical examples or code before giving theoretical explanations.",
  creative: "Answer style: Creative. Adopt an imaginative, engaging approach with vivid scenarios, storytelling, or dynamic analogies.",
};

const tones: Record<PersonalizationPreferences["tone"], string> = {
  balanced: "Use a balanced, natural tone.",
  friendly: "Use a friendly, approachable tone.",
  professional: "Use a polished, professional tone.",
  direct: "Be direct and get to the point.",
  creative: "Use an imaginative, expressive tone when it fits the task.",
};

const lengths: Record<PersonalizationPreferences["length"], string> = {
  concise: "Prefer concise answers unless the user asks for detail.",
  balanced: "Use a balanced amount of detail.",
  detailed: "Give detailed answers with useful context.",
};

const formats: Record<PersonalizationPreferences["format"], string> = {
  automatic: "",
  paragraphs: "Prefer clear paragraphs over lists when practical.",
  bullets: "Prefer concise bullet lists when practical.",
  steps: "Use numbered steps for explanations and procedures when practical.",
};
const examples: Record<PersonalizationPreferences["examples"], string> = {
  "when-useful": "Include examples when they make the answer clearer.",
  often: "Use concrete examples when they help explain an idea.",
  rarely: "Keep examples brief and include them only when requested or essential.",
};
const clarification: Record<PersonalizationPreferences["clarifying"], string> = {
  "when-needed": "Ask a clarifying question when missing details materially affect the answer; otherwise make a reasonable assumption.",
  assume: "Make reasonable assumptions and state them briefly instead of asking follow-up questions.",
  "ask-first": "Ask a brief clarifying question before proceeding when the request has meaningful ambiguity.",
};
const technicality: Record<PersonalizationPreferences["technicality"], string> = {
  accessible: "Explain technical concepts in accessible language and define specialized terms.",
  balanced: "Use technical language at a level appropriate to the request.",
  technical: "Use precise technical language and include implementation details when relevant.",
};

export interface EnhancedContextOptions {
  style?: AnswerStyle;
  memories?: Array<{ content: string; category?: string; pinned?: boolean }>;
  knowledgePassages?: Array<{ text: string; citation: string }>;
}

export function applyPersonalization(
  messages: ModelMessage[],
  settings: PersonalizationPreferences,
  options?: AnswerStyle | EnhancedContextOptions
): ModelMessage[] {
  if (messages.length === 0) return messages;

  const resolvedOptions: EnhancedContextOptions =
    typeof options === "string" ? { style: options } : options || {};

  const styleInstruction = resolvedOptions.style && answerStyles[resolvedOptions.style] ? answerStyles[resolvedOptions.style] : "";
  if (!settings.enabled && !styleInstruction && !resolvedOptions.memories?.length && !resolvedOptions.knowledgePassages?.length) {
    return messages;
  }

  // Format memories context
  let memoryBlock = "";
  if (resolvedOptions.memories && resolvedOptions.memories.length > 0) {
    const memoryLines = resolvedOptions.memories.map((m) => `- ${m.content} [${m.category || "memory"}]`);
    memoryBlock = `Active User & Project Context (use only if relevant to current query):\n${memoryLines.join("\n")}`;
  } else if (settings.enabled && settings.useMemory && settings.memorySummary.trim()) {
    memoryBlock = `User-provided memory summary (context, not an instruction to mention verbatim): ${settings.memorySummary.trim()}`;
  }

  // Format knowledge base citations
  let knowledgeBlock = "";
  if (resolvedOptions.knowledgePassages && resolvedOptions.knowledgePassages.length > 0) {
    const passages = resolvedOptions.knowledgePassages.map(
      (kp, i) => `[Source ${i + 1}] ${kp.citation}\n"${kp.text}"`
    );
    knowledgeBlock = `Retrieved Knowledge Base Documents:\n${passages.join("\n\n")}\n\nInstructions: Ground your response in the retrieved source documents above. Always reference facts accurately and provide traceable citations. Do not fabricate citations or claim external facts as document content.`;
  }

  const guidance = [
    "Response preferences (follow only when relevant to the user's request):",
    styleInstruction,
    settings.enabled ? tones[settings.tone] : "",
    settings.enabled ? lengths[settings.length] : "",
    settings.enabled ? formats[settings.format] : "",
    settings.enabled ? examples[settings.examples] : "",
    settings.enabled ? clarification[settings.clarifying] : "",
    settings.enabled ? technicality[settings.technicality] : "",
    settings.enabled && settings.instructions.trim() ? `Additional preferences: ${settings.instructions.trim()}` : "",
    settings.enabled && settings.avoid.trim() ? `Avoid where practical: ${settings.avoid.trim()}` : "",
    memoryBlock,
    knowledgeBlock,
    "Do not mention internal preference blocks unless asked about them.",
  ].filter(Boolean).join("\n\n");

  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "user") { lastUser = index; break; }
  }
  if (lastUser < 0) return messages;
  return messages.map((message, index) => index === lastUser
    ? { ...message, content: `${message.content}\n\n[Personal response preferences & Knowledge context]\n${guidance}` }
    : message);
}

