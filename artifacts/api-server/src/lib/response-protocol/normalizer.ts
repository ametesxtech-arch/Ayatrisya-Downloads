import {
  UniversalResponseSchema,
  type UniversalResponse,
  type ContentBlock,
  type CitationBlockSchema,
  type AssessmentQuestion,
} from "./schema";
import { validateAndSanitizeQuestions } from "../assessment-engine/assessment-validator";
import { assessmentStore } from "../assessment-engine/assessment-store";

/**
 * Normalizes raw LLM output and detected structured blocks into the Universal Response Protocol 2.0.
 */
export function normalizeUniversalResponse(params: {
  rawText: string;
  messageId: string;
  conversationId: string;
  intent?: UniversalResponse["intent"];
  extractedCitations?: Array<{
    sourceId: number;
    title: string;
    url: string;
    snippet?: string;
    domain?: string;
  }>;
  suggestedFollowUps?: string[];
  metadata?: Record<string, any>;
}): UniversalResponse {
  const { rawText, messageId, conversationId, extractedCitations = [], suggestedFollowUps = [], metadata } = params;
  const blocks: ContentBlock[] = [];
  let detectedIntent = params.intent || "general_conversation";

  // Parse embedded ```interactive ... ``` or ```assessment ... ``` or other blocks
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const matchStart = match.index;
    const matchEnd = codeBlockRegex.lastIndex;
    const lang = (match[1] || "").toLowerCase().trim();
    const content = match[2];

    // Any text preceding this code block
    if (matchStart > lastIndex) {
      const textBefore = rawText.substring(lastIndex, matchStart).trim();
      if (textBefore) {
        blocks.push({
          id: `${messageId}-block-${blocks.length + 1}`,
          type: "markdown",
          content: textBefore,
        });
      }
    }

    // Process block type
    if (["interactive", "assessment", "quiz", "mcq", "exam"].includes(lang) || (lang === "json" && /"type"\s*:\s*"(assessment|quiz|mcq)"/.test(content))) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === "quiz" || parsed.type === "assessment" || parsed.type === "mcq" || parsed.questions) {
          detectedIntent = "assessment_request";
          const rawQuestions = Array.isArray(parsed.questions)
            ? parsed.questions
            : parsed.question
              ? [parsed]
              : [];

          const validated = validateAndSanitizeQuestions(rawQuestions);
          const questions: AssessmentQuestion[] = validated.sanitizedQuestions;

          const assessmentId = parsed.id || `${messageId}-assessment-${blocks.length + 1}`;
          const assessmentMode: "practice" | "examination" = parsed.mode === "examination" ? "examination" : "practice";

          // Auto-persist valid assessment to trusted store for progress & server-side grading
          if (questions.length > 0) {
            try {
              assessmentStore.saveAssessment({
                id: assessmentId,
                title: parsed.title || "Interactive Assessment",
                description: parsed.description,
                mode: assessmentMode,
                timeLimitMinutes: parsed.timeLimitMinutes || Math.max(5, questions.length * 2),
                passingScore: parsed.passingScore || 70,
                examType: parsed.examType,
                questions: questions as any,
                topicSummary: Array.from(new Set(questions.map((q) => q.topic).filter(Boolean))) as string[],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            } catch {}
          }

          // If examination mode, strip correctAnswer from client payload so it is not prematurely disclosed
          const clientQuestions = assessmentMode === "examination"
            ? questions.map((q) => {
                const { correctAnswer, explanation, ...sanitized } = q;
                return sanitized as AssessmentQuestion;
              })
            : questions;

          blocks.push({
            id: assessmentId,
            type: "assessment",
            title: parsed.title || "Interactive Assessment",
            description: parsed.description,
            mode: assessmentMode,
            timeLimitMinutes: parsed.timeLimitMinutes || Math.max(5, questions.length * 2),
            passingScore: parsed.passingScore || 70,
            questions: clientQuestions,
            topicSummary: parsed.topicSummary || Array.from(new Set(questions.map((q) => q.topic).filter(Boolean))) as string[],
          });
        } else if (parsed.type === "table" && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
          blocks.push({
            id: `${messageId}-table-${blocks.length + 1}`,
            type: "table",
            title: parsed.title,
            columns: parsed.columns,
            rows: parsed.rows,
            filterable: parsed.filterable ?? true,
            sortable: parsed.sortable ?? true,
          });
        } else if (parsed.type === "chart") {
          detectedIntent = "data_visualization";
          blocks.push({
            id: `${messageId}-chart-${blocks.length + 1}`,
            type: "chart",
            chartType: parsed.chartType || "bar",
            title: parsed.title || "Data Chart",
            data: parsed.data || [],
            xAxisKey: parsed.xAxisKey || "name",
            series: parsed.series || [{ key: "value", label: "Value" }],
          });
        } else if (parsed.type === "comparison") {
          detectedIntent = "comparison_request";
          blocks.push({
            id: `${messageId}-comparison-${blocks.length + 1}`,
            type: "comparison",
            title: parsed.title,
            entities: parsed.entities || [],
            criteria: parsed.criteria || [],
          });
        } else {
          // General markdown fallback for other interactive formats
          blocks.push({
            id: `${messageId}-block-${blocks.length + 1}`,
            type: "markdown",
            content: `\`\`\`${lang}\n${content}\`\`\``,
          });
        }
      } catch {
        blocks.push({
          id: `${messageId}-block-${blocks.length + 1}`,
          type: "code",
          language: lang || "text",
          code: content,
          executable: false,
        });
      }
    } else if (lang === "mermaid") {
      blocks.push({
        id: `${messageId}-diagram-${blocks.length + 1}`,
        type: "diagram",
        diagramType: "mermaid",
        code: content,
      });
    } else {
      // Regular code block
      blocks.push({
        id: `${messageId}-code-${blocks.length + 1}`,
        type: "code",
        language: lang || "typescript",
        code: content,
        executable: ["javascript", "js", "typescript", "ts", "python", "py"].includes(lang),
      });
    }

    lastIndex = matchEnd;
  }

  // Any remaining text after the last code block
  if (lastIndex < rawText.length) {
    const remainingText = rawText.substring(lastIndex).trim();
    if (remainingText) {
      blocks.push({
        id: `${messageId}-block-${blocks.length + 1}`,
        type: "markdown",
        content: remainingText,
      });
    }
  }

  // If no blocks were created (e.g. no code fences), treat entire text as markdown block
  if (blocks.length === 0 && rawText.trim()) {
    blocks.push({
      id: `${messageId}-content-1`,
      type: "markdown",
      content: rawText,
    });
  }

  // Convert citations to structured blocks
  const citationBlocks = extractedCitations.map((c, i) => ({
    id: `${messageId}-citation-${i + 1}`,
    type: "citation" as const,
    sourceId: c.sourceId || i + 1,
    title: c.title,
    url: c.url,
    snippet: c.snippet,
    domain: c.domain || (c.url ? new URL(c.url).hostname : undefined),
    verified: true,
  }));

  // Build the validated Universal Response object
  return UniversalResponseSchema.parse({
    version: "2.0",
    messageId,
    conversationId,
    intent: detectedIntent,
    plainText: rawText,
    blocks,
    citations: citationBlocks,
    suggestedFollowUps,
    metadata,
  });
}

