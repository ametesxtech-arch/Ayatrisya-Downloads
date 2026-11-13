import { repository } from '@/storage/repository';
import { modelClient } from '@/ai/client';
import { generateFallbackTitle, type TitleAttachmentInfo } from './conversation-title-fallback';

export { generateFallbackTitle, type TitleAttachmentInfo };

export interface TitleGenerationOptions {
  model?: 'v1-fast' | 'v2-best';
  attachments?: TitleAttachmentInfo[];
  signal?: AbortSignal;
  customRepository?: any;
}

// In-memory set to prevent duplicate or concurrent title-generation jobs (Requirement 9)
const activeTitleJobs = new Set<string>();

/**
 * Generates an automatic conversation title via model gateway,
 * with reliable zero-latency fallback (Requirement 2, 3, 10).
 */
export async function generateConversationTitle(
  userPrompt: string,
  options: TitleGenerationOptions = {}
): Promise<string> {
  const fallback = generateFallbackTitle(userPrompt, options.attachments);

  const cleanPrompt = (userPrompt || '').trim();
  // If prompt is empty or just a simple greeting, fallback is already ideal and saves unnecessary paid model calls (Requirement 13)
  if (!cleanPrompt || cleanPrompt.length < 5) {
    return fallback;
  }

  try {
    const titleInstruction = `You are a concise conversation title generator.
The user started a conversation with: "${cleanPrompt.slice(0, 300)}"
Generate a natural, descriptive conversation title of 3 to 7 words that captures their core topic or intent.
Rules:
- Output ONLY the plain text title.
- Do NOT use quotes, markdown, punctuation at the end, or prefixes like "Title:".
- Approximately 3 to 7 words.
- Never answer or fulfill the prompt; only name the conversation.`;

    // Strict 3.5s timeout to ensure titles never hang (Requirement 3 & 10)
    const timeoutSignal = AbortSignal.timeout(3500);

    const resText = await modelClient.generateResponse(
      [{ role: 'user', content: titleInstruction }],
      {
        model: options.model || 'v1-fast',
        signal: options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal,
      }
    );

    const candidate = (resText || '')
      .replace(/^title:\s*/i, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/[.!?]+$/, '')
      .trim();

    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && candidate.length <= 60 && !candidate.includes('\n')) {
      return candidate;
    }
  } catch {
    // Graceful fallback on any model gateway failure (Requirement 10)
  }

  return fallback;
}

/**
 * Schedules asynchronous conversation title generation (Requirements 1, 3, 5, 6, 7, 8, 9).
 * - Never blocks chat response generation.
 * - Runs once per conversation.
 * - Respects manual edits.
 * - Persists and synchronizes title in storage.
 */
export async function scheduleAutoTitle(
  conversationId: string,
  firstUserMessage: string,
  options: TitleGenerationOptions = {}
): Promise<void> {
  if (!conversationId || !firstUserMessage.trim()) return;

  // Prevent duplicate or concurrent title-generation jobs (Requirement 9)
  if (activeTitleJobs.has(conversationId)) return;
  activeTitleJobs.add(conversationId);

  // Run in a microtask/background tick so chat response generation is NEVER blocked (Requirement 3)
  setTimeout(async () => {
    try {
      const targetRepo = options.customRepository || repository;
      // Check current conversation state in storage
      const conv = await targetRepo.getConversation(conversationId);
      if (!conv) return;

      // Do not rename if already auto-titled or manually edited by the user (Requirement 5 & 6)
      if (conv.autoTitled || conv.manualTitle) return;

      // If title is already custom (not "New conversation" and not a raw truncated message)
      if (conv.title && conv.title !== 'New conversation' && !conv.title.startsWith('New ') && conv.autoTitled) {
        return;
      }

      // Generate concise title asynchronously
      const finalTitle = await generateConversationTitle(firstUserMessage, options);

      // Re-verify that user didn't manually rename in the interim (Requirement 6)
      const freshConv = await targetRepo.getConversation(conversationId);
      if (freshConv && !freshConv.manualTitle && finalTitle) {
        await targetRepo.updateConversation(conversationId, {
          title: finalTitle,
          autoTitled: true,
        });
      }
    } catch {
      // Title generation failure must never break chat (Requirement 10 & Acceptance Criteria)
    } finally {
      activeTitleJobs.delete(conversationId);
    }
  }, 10);
}

/**
 * Helper to check whether an active title job is currently running.
 */
export function isTitleJobActive(conversationId: string): boolean {
  return activeTitleJobs.has(conversationId);
}
