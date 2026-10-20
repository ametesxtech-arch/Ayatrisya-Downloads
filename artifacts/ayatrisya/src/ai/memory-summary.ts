import type { Conversation, Message } from "@/storage/types";

type SelectedConversation = Pick<Conversation, "id" | "title"> & { messages: Message[] };

const preferenceClues = /\b(i|i'm|i’ve|i've|my|prefer|please|avoid|usually|always|never|working on|learning|goal|interested in|need to)\b/i;

function sentenceCandidates(messages: Message[]) {
  const candidates: Array<{ text: string; score: number; date: number }> = [];
  for (const message of messages) {
    if (message.role !== "user") continue;
    const content = message.content
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parts = content.match(/[^.!?]+[.!?]?/g) ?? [];
    for (const raw of parts) {
      const text = raw.trim().replace(/^[-*•\s]+/, "");
      if (text.length < 18) continue;
      const score = (preferenceClues.test(text) ? 5 : 0) + Math.min(3, Math.floor(text.length / 180)) + (text.endsWith("?") ? -2 : 0);
      candidates.push({ text, score, date: Date.parse(message.createdAt) || 0 });
    }
  }
  return candidates;
}

/** Builds a conservative, extractive draft from user-authored messages only. */
export function buildMemorySummary(conversations: SelectedConversation[], maxLength = 2400): string {
  const sections: string[] = [];
  for (const conversation of conversations) {
    const unique = new Map<string, { text: string; score: number; date: number }>();
    for (const candidate of sentenceCandidates(conversation.messages)) {
      const key = candidate.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const previous = unique.get(key);
      if (!previous || candidate.score > previous.score || candidate.date > previous.date) unique.set(key, candidate);
    }
    const highlights = [...unique.values()]
      .sort((a, b) => b.score - a.score || b.date - a.date)
      .slice(0, 4)
      .map(({ text }) => `- ${text}`);
    if (highlights.length) sections.push(`${conversation.title.trim() || "Selected conversation"}\n${highlights.join("\n")}`);
  }
  if (!sections.length) return "";
  const header = "Drafted from your messages in selected chats. Review and edit before using.\n\n";
  let result = header;
  for (const section of sections) {
    const addition = `${result === header ? "" : "\n\n"}${section}`;
    if (result.length + addition.length > maxLength) {
      const remaining = maxLength - result.length;
      if (remaining > 50) result += `${addition.slice(0, remaining - 1).trimEnd()}…`;
      break;
    }
    result += addition;
  }
  return result.slice(0, maxLength);
}
