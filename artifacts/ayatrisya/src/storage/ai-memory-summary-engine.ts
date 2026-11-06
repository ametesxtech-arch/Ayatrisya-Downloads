import type { LocalRepository } from './repository';
import type { AIMemorySummary, MemoryEntry, MemoryCategory } from './types';
import { MemoryEngine } from './memory-engine';
import { atomic } from './resource-operations';
import { modelClient } from '@/ai/client';

const timestamp = () => new Date().toISOString();

const SUMMARY_RECORD_ID = 'active_user_memory_summary';

export class AIMemorySummaryEngine {
  private memoryEngine: MemoryEngine;

  constructor(private repo: LocalRepository) {
    this.memoryEngine = new MemoryEngine(repo);
  }

  /**
   * Retrieves the current persisted AI Memory Summary for this owner.
   */
  async getSummary(): Promise<AIMemorySummary | null> {
    try {
      const summary = await this.repo.get<AIMemorySummary>('aiMemorySummaries', SUMMARY_RECORD_ID);
      return summary || null;
    } catch {
      return null;
    }
  }

  /**
   * Saves or updates the user's AI Memory Summary atomically.
   */
  async saveSummary(summary: Partial<AIMemorySummary>): Promise<AIMemorySummary> {
    const now = timestamp();
    return atomic(this.repo, ['aiMemorySummaries'], async (tx, owner) => {
      const existing = (await tx.objectStore('aiMemorySummaries').get([owner, SUMMARY_RECORD_ID])) as AIMemorySummary | undefined;
      const updated: AIMemorySummary = {
        id: SUMMARY_RECORD_ID,
        ownerId: owner,
        version: (existing?.version ?? 0) + 1,
        overview: summary.overview !== undefined ? summary.overview : (existing?.overview ?? ''),
        sections: summary.sections ?? existing?.sections ?? {
          preferencesAndStyle: [],
          backgroundContext: [],
          activeProjects: [],
          technicalEnvironment: [],
          goalsAndPlans: [],
          importantDecisions: [],
          ongoingTasks: [],
          constraintsAndInstructions: [],
        },
        totalSourceMemoriesCount: summary.totalSourceMemoriesCount ?? existing?.totalSourceMemoriesCount ?? 0,
        lastSynthesizedAt: now,
        isAiGenerated: summary.isAiGenerated !== undefined ? summary.isAiGenerated : (existing?.isAiGenerated ?? true),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      await tx.objectStore('aiMemorySummaries').put(updated);
      return updated;
    });
  }

  /**
   * Formats the structured summary into concise prompt context.
   */
  formatSummaryForPrompt(summary: AIMemorySummary, maxChars = 2000): string {
    const lines: string[] = [];
    if (summary.overview) {
      lines.push(`Core Profile: ${summary.overview}`);
    }

    const sectionLabels: Array<[keyof AIMemorySummary['sections'], string]> = [
      ['preferencesAndStyle', 'User Preferences & Style'],
      ['backgroundContext', 'Background & Context'],
      ['activeProjects', 'Active Projects'],
      ['technicalEnvironment', 'Technical Environment'],
      ['goalsAndPlans', 'Goals & Plans'],
      ['importantDecisions', 'Key Architectural & Technical Decisions'],
      ['ongoingTasks', 'Ongoing Work & Unresolved Tasks'],
      ['constraintsAndInstructions', 'Important Constraints & Instructions'],
    ];

    for (const [key, label] of sectionLabels) {
      const items = summary.sections[key];
      if (Array.isArray(items) && items.length > 0) {
        lines.push(`\n### ${label}:`);
        for (const item of items) {
          lines.push(`- ${item}`);
        }
      }
    }

    const text = lines.join('\n').trim();
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '…';
  }

  /**
   * Synthesizes all stored memories and recent conversations into a fresh AI Memory Summary.
   * If a real model is configured, it synthesizes through structured reasoning;
   * otherwise, it performs deterministic multi-section consolidation.
   */
  async generateSummary(options: { forceModel?: boolean } = {}): Promise<AIMemorySummary> {
    const allMemories = await this.memoryEngine.listMemories();
    if (allMemories.length === 0) {
      return this.saveSummary({
        overview: 'No stored memories yet. As you converse, key context will be consolidated here.',
        sections: {
          preferencesAndStyle: [],
          backgroundContext: [],
          activeProjects: [],
          technicalEnvironment: [],
          goalsAndPlans: [],
          importantDecisions: [],
          ongoingTasks: [],
          constraintsAndInstructions: [],
        },
        totalSourceMemoriesCount: 0,
        isAiGenerated: true,
      });
    }

    // Try AI model synthesis if model client is available
    let synthesizedSections: AIMemorySummary['sections'] | null = null;
    let overviewText = '';

    try {
      const caps = await modelClient.getModelCapabilities();
      const available = caps.some((c) => c.available);

      if (available || options.forceModel) {
        const memoryListing = allMemories
          .map((m, i) => `[Memory ${i + 1}] (${m.category}) ${m.content}`)
          .join('\n');

        const prompt = `You are the Ayatrisya Memory Synthesizer.
Analyze the following user memories and synthesize an organized, non-redundant profile.
Do NOT invent facts. Distinguish confirmed facts from preferences and goals.

User Memories:
${memoryListing}

Respond with ONLY valid JSON adhering strictly to this schema:
{
  "overview": "Short 1-2 sentence high-level summary of the user's focus and core preference",
  "preferencesAndStyle": ["specific communication or style preferences"],
  "backgroundContext": ["important background facts, role, domain"],
  "activeProjects": ["active projects being built or discussed"],
  "technicalEnvironment": ["languages, frameworks, tools, OS, or stacks"],
  "goalsAndPlans": ["explicit user goals, deadlines, or objectives"],
  "importantDecisions": ["confirmed technical or architectural decisions"],
  "ongoingTasks": ["unresolved tasks or current in-progress work"],
  "constraintsAndInstructions": ["rules, constraints, things to avoid, or mandatory guidelines"]
}`;

        const activeModel = caps.find((c) => c.available)?.id || 'v1-fast';
        const modelResponse = await modelClient.generateResponse(
          [{ role: 'user', content: prompt }],
          { model: activeModel, mode: 'Normal' }
        );

        const jsonMatch = /\{[\s\S]*\}/.exec(modelResponse);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          overviewText = String(parsed.overview || '').trim();
          synthesizedSections = {
            preferencesAndStyle: Array.isArray(parsed.preferencesAndStyle) ? parsed.preferencesAndStyle.map(String) : [],
            backgroundContext: Array.isArray(parsed.backgroundContext) ? parsed.backgroundContext.map(String) : [],
            activeProjects: Array.isArray(parsed.activeProjects) ? parsed.activeProjects.map(String) : [],
            technicalEnvironment: Array.isArray(parsed.technicalEnvironment) ? parsed.technicalEnvironment.map(String) : [],
            goalsAndPlans: Array.isArray(parsed.goalsAndPlans) ? parsed.goalsAndPlans.map(String) : [],
            importantDecisions: Array.isArray(parsed.importantDecisions) ? parsed.importantDecisions.map(String) : [],
            ongoingTasks: Array.isArray(parsed.ongoingTasks) ? parsed.ongoingTasks.map(String) : [],
            constraintsAndInstructions: Array.isArray(parsed.constraintsAndInstructions) ? parsed.constraintsAndInstructions.map(String) : [],
          };
        }
      }
    } catch {
      // Fall through to deterministic fallback synthesis
    }

    // Deterministic fallback synthesis if model was unreachable or parsing failed
    if (!synthesizedSections) {
      const prefs: string[] = [];
      const bg: string[] = [];
      const proj: string[] = [];
      const tech: string[] = [];
      const goals: string[] = [];
      const decisions: string[] = [];
      const tasks: string[] = [];
      const constraints: string[] = [];

      for (const m of allMemories) {
        const text = m.content.trim();
        const lower = text.toLowerCase();
        if (/react|vue|angular|node|python|typescript|javascript|pinia|redux|stack|database|postgres|tailwind|css|html|api|graphql|vitest|jest/.test(lower)) {
          if (!tech.includes(text)) tech.push(text);
        }
        if (/always|never|do not|must|rule|constraint|avoid/.test(lower)) {
          if (!constraints.includes(text)) constraints.push(text);
        }
        if (/goal|plan|roadmap|target|milestone|ship/.test(lower)) {
          if (!goals.includes(text)) goals.push(text);
        }
        if (/task|todo|bug|fix|pending|wip|ongoing/.test(lower)) {
          if (!tasks.includes(text)) tasks.push(text);
        }

        if (m.category === 'user_preference' || m.category === 'work_preference') {
          if (!prefs.includes(text)) prefs.push(text);
        } else if (m.category === 'project_context' || /project|building|app|dashboard|website/.test(lower)) {
          if (!proj.includes(text)) proj.push(text);
        } else if (m.category === 'technical_decision' || /decided|switched|chosen|settled/.test(lower)) {
          if (!decisions.includes(text)) decisions.push(text);
        } else {
          if (!bg.includes(text)) bg.push(text);
        }
      }

      overviewText = `Consolidated profile covering ${allMemories.length} stored memories across ${prefs.length + proj.length + decisions.length + bg.length} topics.`;
      synthesizedSections = {
        preferencesAndStyle: prefs,
        backgroundContext: bg,
        activeProjects: proj,
        technicalEnvironment: tech,
        goalsAndPlans: goals,
        importantDecisions: decisions,
        ongoingTasks: tasks,
        constraintsAndInstructions: constraints,
      };
    }

    return this.saveSummary({
      overview: overviewText,
      sections: synthesizedSections,
      totalSourceMemoriesCount: allMemories.length,
      isAiGenerated: true,
    });
  }

  /**
   * Automatically inspects a newly submitted turn/conversation and extracts
   * new personal context, preferences, and facts into Layer A and updates Layer B.
   */
  async processNewTurn(userMessage: string, assistantReply: string, conversationId?: string): Promise<{ addedMemories: MemoryEntry[]; summaryUpdated: boolean }> {
    const text = userMessage.trim();
    if (text.length < 15 || text.startsWith('/')) {
      return { addedMemories: [], summaryUpdated: false };
    }

    // Identify preference, instruction, and project clues
    const preferenceClues = /\b(i prefer|i want|i always|always|never|i never|my name is|i am working on|i am building|building|my project is|our stack is|we use|do not use|avoid using|my goal is|i decided to|switch(?:ed)? to|switched the framework to|remember to|actually|instead of|no longer|stop using|changed to)\b/i;
    if (!preferenceClues.test(text)) {
      return { addedMemories: [], summaryUpdated: false };
    }

    // Extract sentences with preference markers
    const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
    const addedMemories: MemoryEntry[] = [];
    let hadSuperseded = false;

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim().replace(/^[-*•\s]+/, '');
      if (sentence.length < 10 || !preferenceClues.test(sentence)) continue;
      const normalizedSentence = sentence.toLowerCase().replace(/[^\w\s]/g, '');

      let category: MemoryCategory = 'user_preference';
      if (/project|app|codebase|repo|building|dashboard/i.test(sentence)) category = 'project_context';
      else if (/decided|chosen|architect|settled on|switch(?:ed)?|changed|database|stack|we use|framework/i.test(sentence)) category = 'technical_decision';
      else if (/work|workflow|team|schedule/i.test(sentence)) category = 'work_preference';

      // Detect corrections / superseding: e.g. "switched from X to Y", "actually I use Y", "no longer use X"
      const isCorrection = /\b(actually|switch(?:ed)? from|instead of|no longer|stop using|changed (?:from|to)|prefer .* instead of|not .* but)\b/i.test(sentence);

      if (isCorrection) {
        // Find existing memories across system that contain superseded items
        const switchMatch = sentence.match(/(?:switch(?:ed)? from|instead of|no longer use|stop using)\s+([a-zA-Z0-9_-]+)/i);
        const supersededTarget = switchMatch ? switchMatch[1].toLowerCase() : null;
        const allExisting = await this.memoryEngine.listMemories();

        for (const oldMem of allExisting) {
          const oldNorm = oldMem.content.toLowerCase();
          const shouldSupersede = supersededTarget 
            ? oldNorm.includes(supersededTarget) 
            : (oldMem.category === 'technical_decision' || oldMem.category === 'user_preference') && 
              (/\b(use|using|prefer|framework|stack|database|language)\b/i.test(oldMem.content) && /\b(use|using|prefer|framework|stack|database|language)\b/i.test(sentence));

          if (shouldSupersede) {
            await this.memoryEngine.deleteMemory(oldMem.id);
            hadSuperseded = true;
          }
        }

        // If this sentence is purely a negative removal directive (e.g. "Stop using X"), do not persist it as a new memory
        if (/\b(stop using|no longer use|don't use|do not use)\b/i.test(sentence) && !/\b(instead|prefer|switch(?:ed)? to)\b/i.test(sentence)) {
          continue;
        }
      }

      // Duplicate check against remaining existing memories
      const currentList = await this.memoryEngine.listMemories({ category });
      const isDuplicate = currentList.some((m) => {
        const normalizedExisting = m.content.toLowerCase().replace(/[^\w\s]/g, '');
        return normalizedExisting.includes(normalizedSentence) || normalizedSentence.includes(normalizedExisting);
      });

      if (!isDuplicate) {
        const mem = await this.memoryEngine.createMemory({
          category,
          content: sentence,
          sourceConversationId: conversationId || null,
        });
        addedMemories.push(mem);
      }
    }

    let summaryUpdated = false;
    if (addedMemories.length > 0 || hadSuperseded) {
      await this.generateSummary();
      summaryUpdated = true;
    }

    return { addedMemories, summaryUpdated };
  }

  /**
   * Deletes the user's summary completely.
   */
  async deleteSummary(): Promise<boolean> {
    return atomic(this.repo, ['aiMemorySummaries'], async (tx, owner) => {
      const existing = await tx.objectStore('aiMemorySummaries').get([owner, SUMMARY_RECORD_ID]);
      if (!existing) return false;
      await tx.objectStore('aiMemorySummaries').delete([owner, SUMMARY_RECORD_ID]);
      return true;
    });
  }

  /**
   * Clears both Layer A detailed memories and Layer B summary.
   */
  async clearAllMemorySystem(): Promise<void> {
    await this.memoryEngine.clearAllMemories();
    await this.deleteSummary();
  }
}
