import { classifyConversationIntent, type IntentClassificationResult } from "./classifier";
import { buildOrchestratorInstructions } from "./prompt-builder";
import { normalizeUniversalResponse } from "../response-protocol/normalizer";
import type { UniversalResponse } from "../response-protocol/schema";
import { searchInternet, shouldSearchInternet, type SearchResult } from "../web-search";

export interface OrchestrationInput {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    attachments?: Array<{
      name: string;
      mimeType: string;
      dataBase64?: string;
      textContent?: string;
      size?: number;
    }>;
  }>;
  model: "v1-fast" | "v2-best";
  mode: "Normal" | "Savage" | "Joke";
  stream?: boolean;
  conversationId?: string;
  messageId?: string;
  personalization?: {
    enabled?: boolean;
    useMemory?: boolean;
    memorySummary?: string;
    instructions?: string;
  };
}

export interface OrchestratedContext {
  classification: IntentClassificationResult;
  augmentedSystemPrompt: string;
  webSearchResults: SearchResult[];
  webSearchContext: string;
}

export class ConversationalOrchestrator {
  /**
   * Pre-inference analysis and context enrichment.
   */
  async prepareContext(input: OrchestrationInput): Promise<OrchestratedContext> {
    const lastUserMsg = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const classification = classifyConversationIntent(lastUserMsg, input.messages);

    let webSearchResults: SearchResult[] = [];
    let webSearchContext = "";

    // Run real web search if needed or research intent detected
    if (classification.intent === "research_query" || shouldSearchInternet(lastUserMsg)) {
      try {
        const results = await searchInternet(lastUserMsg, 5);
        if (results && results.length > 0) {
          webSearchResults = results;
          webSearchContext =
            "\n\nLive Internet Search Results:\n" +
            results.map((r, i) => `[${i + 1}] "${r.title}": ${r.snippet} (Source: ${r.link})`).join("\n") +
            "\n\nCRITICAL INSTRUCTION FOR SOURCES CITATION:\n" +
            "Use the live web search results above to provide accurate, up-to-date facts. At the very end of your response, you MUST ALWAYS provide a dedicated '### 🌐 Sources & References' section with numbered markdown links to all consulted sources.";
        }
      } catch (err) {
        // Fall back gracefully if search fails
      }
    }

    const orchestratorInstructions = buildOrchestratorInstructions(classification);
    const personalizationNotes =
      input.personalization?.enabled && input.personalization.instructions
        ? `\n\nUser Directives:\n${input.personalization.instructions}`
        : "";

    const memoryContext =
      input.personalization?.enabled && input.personalization.useMemory && input.personalization.memorySummary
        ? `\n\nKnown User Memory Context:\n${input.personalization.memorySummary}`
        : "";

    const augmentedSystemPrompt = [
      orchestratorInstructions,
      webSearchContext,
      personalizationNotes,
      memoryContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      classification,
      augmentedSystemPrompt,
      webSearchResults,
      webSearchContext,
    };
  }

  /**
   * Post-inference response normalization and Universal Protocol packaging.
   */
  finalizeResponse(params: {
    rawOutput: string;
    conversationId: string;
    messageId: string;
    classification: IntentClassificationResult;
    webSearchResults: SearchResult[];
  }): UniversalResponse {
    const citations = params.webSearchResults.map((r, idx) => ({
      sourceId: idx + 1,
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      domain: (() => {
        try {
          return new URL(r.link).hostname;
        } catch {
          return undefined;
        }
      })(),
    }));

    // Suggest logical follow-ups based on intent
    const followUps: string[] = [];
    if (params.classification.intent === "assessment_request") {
      followUps.push("Review my incorrect answers", "Show detailed solutions for all questions", "Generate 5 harder questions on this topic");
    } else if (params.classification.intent === "code_generation") {
      followUps.push("Add unit tests for this implementation", "Optimize for time and space complexity", "Open in Canvas IDE");
    } else if (params.classification.intent === "technical_explanation") {
      followUps.push("Explain with a practical real-world analogy", "Create a practice quiz to test my understanding", "Summarize key formulas");
    }

    return normalizeUniversalResponse({
      rawText: params.rawOutput,
      messageId: params.messageId,
      conversationId: params.conversationId,
      intent: params.classification.intent,
      extractedCitations: citations,
      suggestedFollowUps: followUps,
    });
  }
}

export const orchestrator = new ConversationalOrchestrator();

