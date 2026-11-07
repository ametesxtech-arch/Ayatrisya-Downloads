import type { LocalRepository } from "./repository";
import type {
  MemoryCategory,
  MemoryEntry,
  AIMemorySummary,
  Conversation,
  Message,
} from "./types";
import { MemoryEngine, type CreateMemoryParams } from "./memory-engine";
import { AIMemorySummaryEngine } from "./ai-memory-summary-engine";
import { KnowledgeBaseEngine } from "./knowledge-engine";
import { atomic } from "./resource-operations";

const timestamp = () => new Date().toISOString();

export interface MemoryContextPackage {
  summaryContext: string;
  rankedMemories: Array<{
    id: string;
    content: string;
    category: MemoryCategory;
    score: number;
    pinned: boolean;
    projectId?: string | null;
    sourceConversationId?: string | null;
  }>;
  knowledgePassages: Array<{
    text: string;
    citation: string;
    score?: number;
  }>;
  pastConversationExcerpts: Array<{
    conversationId: string;
    title: string;
    turnContent: string;
    role: "user" | "assistant";
    date: string;
  }>;
  projectContext?: {
    projectId: string;
    projectName?: string;
    activeArtifacts?: string[];
  } | null;
  totalEstimatedTokens: number;
}

export interface ContextBuildOptions {
  projectId?: string | null;
  currentConversationId?: string | null;
  activeArtifacts?: string[];
  maxTotalTokens?: number;
  includeCrossConversationExcerpts?: boolean;
}

export interface MemoryExtractionResult {
  added: MemoryEntry[];
  superseded: MemoryEntry[];
  contradictionsDetected: number;
  failures: string[];
}

const RECOVERY_STORAGE_KEY = "ayatrisya_memory_write_recovery_queue";

/**
 * Intelligent Memory & Context Manager (Conversational Experience 2.0)
 * Orchestrates multi-factor ranking, contradiction resolution, cross-conversation
 * excerpt retrieval, token budgeting, and write-failure recovery.
 */
export class IntelligentMemoryContextManager {
  private memoryEngine: MemoryEngine;
  private summaryEngine: AIMemorySummaryEngine;
  private kbEngine: KnowledgeBaseEngine;

  constructor(private repo: LocalRepository) {
    this.memoryEngine = new MemoryEngine(repo);
    this.summaryEngine = new AIMemorySummaryEngine(repo);
    this.kbEngine = new KnowledgeBaseEngine(repo);
  }

  // =========================================================================
  // PART C: CONTEXT BUILDING & TOKEN BUDGET MANAGER
  // =========================================================================

  /**
   * Constructs an optimized, token-budget-governed context package for the model prompt.
   */
  async buildContextPackage(
    userQuery: string,
    options: ContextBuildOptions = {}
  ): Promise<MemoryContextPackage> {
    const maxTotalTokens = options.maxTotalTokens ?? 2500;
    const maxChars = maxTotalTokens * 4;

    let charsRemaining = maxChars;

    // 1. Layer B: AI Memory Profile Summary (Cap: ~300 tokens / 1200 chars)
    let summaryContext = "";
    try {
      const summaryRecord = await this.summaryEngine.getSummary();
      if (summaryRecord) {
        summaryContext = this.summaryEngine.formatSummaryForPrompt(summaryRecord, Math.min(1200, charsRemaining));
        charsRemaining -= summaryContext.length;
      }
    } catch (e) {
      console.warn("[IntelligentMemory] Summary retrieval fallback:", e);
    }

    // 2. Layer A: Multi-Factor Ranked Discrete Memories (Cap: ~500 tokens / 2000 chars)
    const memoryCharBudget = Math.min(2000, charsRemaining);
    const rankedMemories = await this.retrieveAndRankMemories(userQuery, {
      projectId: options.projectId,
      maxChars: memoryCharBudget,
    });
    const memoryCharsUsed = rankedMemories.reduce((acc, m) => acc + m.content.length + 30, 0);
    charsRemaining -= memoryCharsUsed;

    // 3. Project Context & Active Artifacts (Cap: ~300 tokens / 1200 chars)
    let projectContext: MemoryContextPackage["projectContext"] = null;
    if (options.projectId) {
      projectContext = {
        projectId: options.projectId,
        activeArtifacts: options.activeArtifacts || [],
      };
      try {
        const proj = await this.repo.get<{ id: string; name: string }>("projects", options.projectId);
        if (proj) projectContext.projectName = proj.name;
      } catch {}
      charsRemaining -= 150;
    }

    // 4. Knowledge-Base Document Retrieval (Cap: ~800 tokens / 3200 chars)
    const kbCharBudget = Math.min(3200, charsRemaining);
    const knowledgePassages = await this.retrieveKnowledgePassages(userQuery, kbCharBudget);
    const kbCharsUsed = knowledgePassages.reduce((acc, k) => acc + k.text.length + k.citation.length, 0);
    charsRemaining -= kbCharsUsed;

    // 5. Cross-Conversation Semantic Search Excerpts (Cap: ~600 tokens / 2400 chars)
    let pastConversationExcerpts: MemoryContextPackage["pastConversationExcerpts"] = [];
    if (options.includeCrossConversationExcerpts !== false && charsRemaining > 400) {
      pastConversationExcerpts = await this.searchPastConversations(
        userQuery,
        options.currentConversationId,
        Math.min(2400, charsRemaining)
      );
    }

    const totalEstimatedChars =
      summaryContext.length +
      memoryCharsUsed +
      kbCharsUsed +
      pastConversationExcerpts.reduce((acc, p) => acc + p.turnContent.length + 40, 0);

    return {
      summaryContext,
      rankedMemories,
      knowledgePassages,
      pastConversationExcerpts,
      projectContext,
      totalEstimatedTokens: Math.ceil(totalEstimatedChars / 4),
    };
  }

  // =========================================================================
  // MULTI-FACTOR RELEVANCE RANKING (PART B.7)
  // =========================================================================

  /**
   * Ranks discrete memories by:
   * Score = (Semantic Relevance * 0.40) + (Importance * 0.25) + (Recency * 0.15) + (Project Alignment * 0.10) + (Pinned Bonus * 0.10)
   */
  async retrieveAndRankMemories(
    query: string,
    options: { projectId?: string | null; maxChars?: number } = {}
  ): Promise<MemoryContextPackage["rankedMemories"]> {
    const maxChars = options.maxChars ?? 2000;
    const allMemories = await this.memoryEngine.listMemories();
    if (allMemories.length === 0) return [];

    const queryTokens = this.tokenize(query);
    const now = Date.now();

    const scored = allMemories.map((m) => {
      // 1. Semantic Match Score (0 to 1.0)
      const memTokens = this.tokenize(m.content + " " + m.tags.join(" "));
      let matchCount = 0;
      for (const qt of queryTokens) {
        if (memTokens.has(qt)) matchCount++;
      }
      const semanticScore = queryTokens.size > 0 ? Math.min(1.0, matchCount / Math.max(1, queryTokens.size)) : 0;

      // 2. Importance Score (1 to 5 -> 0.2 to 1.0)
      const importanceScore = (m.importance ?? 3) / 5;

      // 3. Recency Decay (half-life ~30 days)
      const ageDays = (now - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-ageDays / 30);

      // 4. Project Alignment
      const projectScore = options.projectId && m.projectId === options.projectId ? 1.0 : m.projectId ? 0.2 : 0.6;

      // 5. Pinned Bonus
      const pinnedScore = m.pinned ? 1.0 : 0.0;

      // Composite Weighted Score (semantic gating: if unpinned and zero semantic relevance, score is 0)
      let finalScore = 0;
      if (m.pinned || semanticScore > 0) {
        finalScore =
          semanticScore * 0.45 +
          importanceScore * 0.2 +
          recencyScore * 0.15 +
          projectScore * 0.1 +
          pinnedScore * 0.1;
      }

      return {
        id: m.id,
        content: m.content,
        category: m.category,
        score: Number(finalScore.toFixed(3)),
        pinned: m.pinned,
        projectId: m.projectId,
        sourceConversationId: m.sourceConversationId,
        length: m.content.length,
      };
    });

    // Only select candidates that have meaningful relevance or are pinned
    const candidates = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const result: MemoryContextPackage["rankedMemories"] = [];
    let charsUsed = 0;

    for (const c of candidates) {
      if (charsUsed + c.length > maxChars) break;
      result.push({
        id: c.id,
        content: c.content,
        category: c.category,
        score: c.score,
        pinned: c.pinned,
        projectId: c.projectId,
        sourceConversationId: c.sourceConversationId,
      });
      charsUsed += c.length;
    }

    return result;
  }

  // =========================================================================
  // CROSS-CONVERSATION SEMANTIC CHAT SEARCH (PART B.3, B.4)
  // =========================================================================

  /**
   * Searches past conversation turns across separate chat threads for relevant historical context.
   */
  async searchPastConversations(
    query: string,
    excludeConversationId?: string | null,
    maxChars = 2400
  ): Promise<MemoryContextPackage["pastConversationExcerpts"]> {
    const owner = this.repo.ownerId;
    const queryTokens = this.tokenize(query);
    if (queryTokens.size === 0) return [];

    try {
      const allConvs = await this.repo.all<Conversation>("conversations", owner);
      const pastConvs = allConvs
        .filter((c) => !excludeConversationId || c.id !== excludeConversationId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 10); // Search the 10 most recent past chats

      const candidateExcerpts: Array<{
        conversationId: string;
        title: string;
        turnContent: string;
        role: "user" | "assistant";
        date: string;
        score: number;
      }> = [];

      for (const conv of pastConvs) {
        const messages = await this.repo.getMessages(conv.id);
        for (const msg of messages) {
          const content = (msg.content || "").trim();
          if (content.length < 20 || content.startsWith("/")) continue;

          const msgTokens = this.tokenize(content);
          let matchCount = 0;
          for (const qt of queryTokens) {
            if (msgTokens.has(qt)) matchCount++;
          }

          if (matchCount >= 2 || (queryTokens.size === 1 && matchCount >= 1)) {
            const score = matchCount / queryTokens.size;
            candidateExcerpts.push({
              conversationId: conv.id,
              title: conv.title || "Previous Chat",
              turnContent: content.length > 350 ? content.slice(0, 350) + "…" : content,
              role: msg.role,
              date: msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : "",
              score,
            });
          }
        }
      }

      candidateExcerpts.sort((a, b) => b.score - a.score);

      const excerpts: MemoryContextPackage["pastConversationExcerpts"] = [];
      let charsUsed = 0;
      for (const item of candidateExcerpts) {
        if (charsUsed + item.turnContent.length > maxChars) break;
        excerpts.push({
          conversationId: item.conversationId,
          title: item.title,
          turnContent: item.turnContent,
          role: item.role,
          date: item.date,
        });
        charsUsed += item.turnContent.length;
        if (excerpts.length >= 3) break;
      }

      return excerpts;
    } catch (e) {
      console.warn("[IntelligentMemory] Cross-conversation search fallback:", e);
      return [];
    }
  }

  // =========================================================================
  // KNOWLEDGE-BASE RETRIEVAL (PART B.6)
  // =========================================================================

  private async retrieveKnowledgePassages(
    query: string,
    maxChars: number
  ): Promise<MemoryContextPackage["knowledgePassages"]> {
    try {
      const kbs = await this.kbEngine.listKnowledgeBases();
      if (kbs.length === 0) return [];

      const passages: MemoryContextPackage["knowledgePassages"] = [];
      let charsUsed = 0;

      for (const kb of kbs.slice(0, 2)) {
        const matches = await this.kbEngine.searchKnowledgeBase(kb.id, query, { maxMatches: 2 });
        for (const m of matches) {
          if (charsUsed + m.chunk.text.length > maxChars) break;
          passages.push({
            text: m.chunk.text,
            citation: m.citation,
            score: m.score,
          });
          charsUsed += m.chunk.text.length;
        }
      }
      return passages;
    } catch {
      return [];
    }
  }

  // =========================================================================
  // MEMORY EXTRACTION, CONTRADICTION & DEDUPLICATION (PART D)
  // =========================================================================

  /**
   * Post-turn extraction pipeline:
   * 1. Detect candidate memories from the user turn.
   * 2. Classify type, confidence, and importance.
   * 3. Detect contradictions against prior memories.
   * 4. Deduplicate and commit via write-safe transaction.
   * 5. Record any failures into the persistent recovery queue.
   */
  async processTurnAndExtractMemories(
    userMessage: string,
    assistantReply: string,
    options: {
      conversationId?: string | null;
      projectId?: string | null;
    } = {}
  ): Promise<MemoryExtractionResult> {
    const text = userMessage.trim();
    const result: MemoryExtractionResult = {
      added: [],
      superseded: [],
      contradictionsDetected: 0,
      failures: [],
    };

    // Filter non-actionable or trivial messages
    if (text.length < 12 || text.startsWith("/")) {
      return result;
    }

    // Explicit memory correction check (e.g. "Actually I use X now", "Correction: ...")
    const isExplicitCorrection = /\b(actually|correction:|changed to|switched to|update memory|no longer use|instead of|replace .* with)\b/i.test(text);

    // Extraction pattern matching
    const candidateClues = /\b(i prefer|i want|i always|always use|never use|my name is|i am working on|i am building|my project is|our stack is|we use|my goal is|i decided to|settled on|timezone is|my email is|prefer .* over|switched from)\b/i;

    if (!isExplicitCorrection && !candidateClues.test(text)) {
      return result;
    }

    const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim().replace(/^[-*•\s]+/, "");
      if (sentence.length < 8) continue;
      if (!isExplicitCorrection && !candidateClues.test(sentence)) continue;

      const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, "");

      // Classify Category
      let category: MemoryCategory = "user_preference";
      if (/project|app|codebase|repo|building|dashboard|backend|frontend/i.test(sentence)) {
        category = "project_context";
      } else if (/decided|chosen|architect|settled on|switch(?:ed)?|changed|database|stack|we use|framework|library/i.test(sentence)) {
        category = "technical_decision";
      } else if (/schedule|work|team|hours|calendar|daily|weekly/i.test(sentence)) {
        category = "work_preference";
      }

      // Compute Importance & Confidence
      const importance = isExplicitCorrection ? 5 : /\balways|never|essential|critical|must\b/i.test(sentence) ? 4 : 3;
      const confidence = isExplicitCorrection ? 0.95 : 0.85;

      // Contradiction & Superseding Check
      const existing = await this.memoryEngine.listMemories();
      const sentenceTokens = this.tokenize(sentence);

      for (const oldMem of existing) {
        const oldTokens = this.tokenize(oldMem.content);
        const overlap = this.calculateOverlap(sentenceTokens, oldTokens);

        // Check if old memory is contradictory (shares domain keywords like framework, timezone, stack, style but differs in target)
        const sharesDomain =
          (oldMem.category === category || oldMem.category === "technical_decision" || oldMem.category === "user_preference") &&
          overlap >= 0.4;

        if (sharesDomain && isExplicitCorrection) {
          result.contradictionsDetected++;
          try {
            await this.memoryEngine.deleteMemory(oldMem.id);
            result.superseded.push(oldMem);
          } catch (e) {
            console.warn("[IntelligentMemory] Could not delete superseded memory:", e);
          }
        }
      }

      // Deduplication Check
      const isDuplicate = existing.some((m) => {
        if (m.id && result.superseded.some((s) => s.id === m.id)) return false;
        const oldNorm = m.content.toLowerCase().replace(/[^\w\s]/g, "");
        return oldNorm === normalized || oldNorm.includes(normalized) || normalized.includes(oldNorm);
      });

      if (!isDuplicate) {
        try {
          const entry = await this.safeCreateMemory({
            category,
            content: sentence,
            sourceConversationId: options.conversationId || null,
            projectId: options.projectId || null,
            tags: Array.from(sentenceTokens).slice(0, 5),
          });
          result.added.push(entry);
        } catch (err: any) {
          result.failures.push(err?.message || "Failed to persist memory");
          this.queueWriteRecovery({
            category,
            content: sentence,
            sourceConversationId: options.conversationId || null,
            projectId: options.projectId || null,
            tags: Array.from(sentenceTokens).slice(0, 5),
          });
        }
      }
    }

    // Trigger Layer B Summary update if new memories or corrections occurred
    if (result.added.length > 0 || result.superseded.length > 0) {
      try {
        await this.summaryEngine.generateSummary();
      } catch (e) {
        console.warn("[IntelligentMemory] Summary re-synthesis notice:", e);
      }
    }

    return result;
  }

  // =========================================================================
  // WRITE FAILURE DETECTION & RECOVERY QUEUE (PART B.13, E)
  // =========================================================================

  private async safeCreateMemory(params: CreateMemoryParams): Promise<MemoryEntry> {
    try {
      return await this.memoryEngine.createMemory(params);
    } catch (err) {
      console.warn("[IntelligentMemory] Memory write error detected. Enqueueing recovery:", err);
      throw err;
    }
  }

  private queueWriteRecovery(params: CreateMemoryParams): void {
    try {
      const raw = localStorage.getItem(RECOVERY_STORAGE_KEY) || "[]";
      const queue: CreateMemoryParams[] = JSON.parse(raw);
      queue.push(params);
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(queue.slice(-20)));
    } catch {}
  }

  /**
   * Attempts to drain and retry pending memories in the recovery queue.
   */
  async flushRecoveryQueue(): Promise<number> {
    try {
      const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!raw) return 0;
      const queue: CreateMemoryParams[] = JSON.parse(raw);
      if (queue.length === 0) return 0;

      let recovered = 0;
      const remaining: CreateMemoryParams[] = [];

      for (const item of queue) {
        try {
          await this.memoryEngine.createMemory(item);
          recovered++;
        } catch {
          remaining.push(item);
        }
      }

      if (remaining.length === 0) {
        localStorage.removeItem(RECOVERY_STORAGE_KEY);
      } else {
        localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(remaining));
      }
      return recovered;
    } catch {
      return 0;
    }
  }

  // =========================================================================
  // MEMORY EXPORT & RESTORATION (PART B.12, B.14)
  // =========================================================================

  /**
   * Exports all discrete memories and summaries as a structured JSON object.
   */
  async exportMemoriesAsJson(): Promise<string> {
    const memories = await this.memoryEngine.listMemories();
    const summary = await this.summaryEngine.getSummary();
    return JSON.stringify(
      {
        exportedAt: timestamp(),
        ownerId: this.repo.ownerId,
        totalMemories: memories.length,
        memories,
        aiMemorySummary: summary,
      },
      null,
      2
    );
  }

  /**
   * Exports memories formatted into clean, readable Markdown.
   */
  async exportMemoriesAsMarkdown(): Promise<string> {
    const memories = await this.memoryEngine.listMemories();
    const summary = await this.summaryEngine.getSummary();

    const lines: string[] = [
      `# Ayatrisya AI Memory Export`,
      `*Generated on ${new Date().toLocaleString()}*`,
      "",
    ];

    if (summary?.overview) {
      lines.push(`## Core Profile Overview`, summary.overview, "");
    }

    lines.push(`## Stored Discrete Memories (${memories.length})`);
    for (const m of memories) {
      const pin = m.pinned ? "📌 " : "";
      const proj = m.projectId ? ` *(Project: ${m.projectId})*` : "";
      lines.push(`- ${pin}**[${m.category}]** ${m.content}${proj}`);
    }

    return lines.join("\n");
  }

  // =========================================================================
  // TOKENIZATION & STRING HELPERS
  // =========================================================================

  private tokenize(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !this.isStopWord(w));
    return new Set(words);
  }

  private calculateOverlap(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let common = 0;
    for (const item of a) {
      if (b.has(item)) common++;
    }
    return common / Math.min(a.size, b.size);
  }

  private isStopWord(w: string): boolean {
    const stops = new Set([
      "the", "and", "that", "have", "for", "not", "with", "you", "this",
      "but", "his", "from", "they", "say", "her", "she", "will", "one",
      "all", "would", "there", "their", "what", "out", "about", "who",
      "get", "which", "when", "make", "can", "like", "time", "just",
      "him", "know", "take", "people", "into", "year", "your", "good",
      "some", "could", "them", "see", "other", "than", "then", "now",
    ]);
    return stops.has(w);
  }
}
