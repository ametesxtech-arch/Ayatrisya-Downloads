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

export function applyPersonalization(messages: ModelMessage[], settings: PersonalizationPreferences): ModelMessage[] {
  if (!settings.enabled || messages.length === 0) return messages;
  const guidance = [
    "Response preferences (follow only when relevant to the user's request):",
    tones[settings.tone],
    lengths[settings.length],
    formats[settings.format],
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
