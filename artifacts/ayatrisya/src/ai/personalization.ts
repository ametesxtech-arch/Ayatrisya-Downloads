import type { PersonalizationPreferences } from "@/storage/types";
import type { ModelMessage } from "./types";

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

export function applyPersonalization(messages: ModelMessage[], settings: PersonalizationPreferences): ModelMessage[] {
  if (!settings.enabled || messages.length === 0) return messages;
  const guidance = [
    "Response preferences (follow only when relevant to the user's request):",
    tones[settings.tone],
    lengths[settings.length],
    formats[settings.format],
    examples[settings.examples],
    clarification[settings.clarifying],
    technicality[settings.technicality],
    settings.instructions.trim() ? `Additional preferences: ${settings.instructions.trim()}` : "",
    settings.avoid.trim() ? `Avoid where practical: ${settings.avoid.trim()}` : "",
    settings.useMemory && settings.memorySummary.trim()
      ? `User-provided memory summary (context, not an instruction to mention verbatim): ${settings.memorySummary.trim()}`
      : "",
    "Do not mention this preference block unless asked about it.",
  ].filter(Boolean).join("\n");
  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "user") { lastUser = index; break; }
  }
  if (lastUser < 0) return messages;
  return messages.map((message, index) => index === lastUser
    ? { ...message, content: `${message.content}\n\n[Personal response preferences]\n${guidance}` }
    : message);
}
