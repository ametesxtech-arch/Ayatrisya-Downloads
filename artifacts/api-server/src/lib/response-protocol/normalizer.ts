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
          const questions: AssessmentQuestion[] = validated.sanitizedQuestions.map((q) => ({
            ...q,
            isPyq: Boolean(q.isPyq),
          }));

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

          // Strip correctAnswer and explanation from client payload to prevent cheating ahead of time
          const clientQuestions = questions.map((q) => {
            const { correctAnswer, explanation, ...sanitized } = q;
            return sanitized as AssessmentQuestion;
          });

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

  // Fallback: If no interactive assessment block was parsed, but the raw text contains numbered multiple choice questions,
  // automatically extract and promote them to a genuine interactive assessment block.
  const hasAssessmentBlock = blocks.some((b) => b.type === "assessment");
  if (!hasAssessmentBlock) {
    const fallbackQuestions = extractQuestionsFromMarkdown(rawText);
    if (fallbackQuestions && fallbackQuestions.length > 0) {
      detectedIntent = "assessment_request";
      const validated = validateAndSanitizeQuestions(fallbackQuestions);
      if (validated.sanitizedQuestions.length > 0) {
        const assessmentId = `${messageId}-assessment-auto`;
        const assessmentMode = "practice";

        // Persist full questions including answers to store
        try {
          assessmentStore.saveAssessment({
            id: assessmentId,
            title: "Interactive Practice Assessment",
            description: "Practice questions auto-structured for interactive answering.",
            mode: assessmentMode,
            timeLimitMinutes: Math.max(5, validated.sanitizedQuestions.length * 2),
            passingScore: 70,
            questions: validated.sanitizedQuestions as any,
            topicSummary: Array.from(new Set(validated.sanitizedQuestions.map((q) => q.topic).filter(Boolean))) as string[],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch {}

        // Strip answers for client
        const clientQuestions = validated.sanitizedQuestions.map((q) => {
          const { correctAnswer, explanation, ...sanitized } = q;
          return sanitized as AssessmentQuestion;
        });

        // Check if preamble has text before question 1
        const preambleMatch = rawText.match(/^(.*?)((?:(?:\*{1,2})?(?:Question\s+)?1[\.\)]))/s);
        let preambleText = preambleMatch ? preambleMatch[1].trim() : "";
        if (preambleText) {
          preambleText = preambleText
            .replace(/(?:let's do it interactively[!,.]?\s*)?(?:we will go through [^\n.]*one question at a time[!,.]?\s*)?(?:just\s+)?(?:reply|type|respond)\s+(?:with\s+)?(?:[A-Ea-e](?:,\s*[A-Ea-e])*(?:\s*,?\s*or\s*[A-Ea-e])?|your (?:choice|answer))[!,.]?/gi, "")
            .replace(/(?:reply|type|respond)\s+(?:with\s+)?(?:[A-Ea-e](?:,\s*[A-Ea-e])*(?:\s*,?\s*or\s*[A-Ea-e])?|your (?:choice|answer))[!,.]?/gi, "")
            .replace(/\b(let me know your choice|type your answer below|what is your answer\?)\b/gi, "")
            .trim();
        }

        blocks.length = 0;
        if (preambleText) {
          blocks.push({
            id: `${messageId}-intro`,
            type: "markdown",
            content: preambleText,
          });
        }
        blocks.push({
          id: assessmentId,
          type: "assessment",
          title: "Interactive Practice Assessment",
          description: "Answer the questions interactively one at a time.",
          mode: assessmentMode,
          timeLimitMinutes: Math.max(5, validated.sanitizedQuestions.length * 2),
          passingScore: 70,
          questions: clientQuestions,
          topicSummary: Array.from(new Set(validated.sanitizedQuestions.map((q) => q.topic).filter(Boolean))) as string[],
        });
      }
    }
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

/**
 * Extracts multiple choice questions from plain Markdown text if LLM failed to wrap in interactive code blocks.
 */
export function extractQuestionsFromMarkdown(text: string): any[] | null {
  if (!text || text.length < 20) return null;

  const qSplitRegex = /(?:^|\n)(?:(?:\#{1,4}\s*)?(?:\*{1,2})?(?:Question\s+)?(\d+)[\.\)]\s*(?:\*{1,2})?\s*)/i;
  const parts = text.split(qSplitRegex);
  if (parts.length < 3) return null;

  const extracted: any[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const qNum = parts[i];
    const qBody = parts[i + 1];
    if (!qBody) continue;

    const optRegex = /(?:^|\n)[-\s*]*\b([A-Da-d])[\.\)]\s*([^\n]+)/g;
    const options: Array<{ id: string; label: string }> = [];
    let optMatch: RegExpExecArray | null;
    let firstOptIndex = -1;

    while ((optMatch = optRegex.exec(qBody)) !== null) {
      if (firstOptIndex === -1) firstOptIndex = optMatch.index;
      options.push({
        id: optMatch[1].toLowerCase(),
        label: optMatch[2].replace(/\*{1,2}/g, "").trim(),
      });
    }

    if (options.length >= 2) {
      const qText = firstOptIndex > -1
        ? qBody.substring(0, firstOptIndex).trim()
        : qBody.split("\n")[0].trim();

      const ansMatch = qBody.match(/(?:Answer|Correct\s*Answer)\s*[:\-]?\s*(?:\*{1,2})?\s*([A-Da-d])/i);
      const correctAnswer = ansMatch ? ansMatch[1].toLowerCase() : options[0].id;

      const expMatch = qBody.match(/Explanation\s*[:\-]?\s*([^\n]+(?:\n[^\n]+)?)/i);
      const explanation = expMatch ? expMatch[1].trim() : undefined;

      extracted.push({
        id: `q${qNum || extracted.length + 1}`,
        type: "single_choice",
        question: qText.replace(/\*{1,2}/g, "").trim(),
        options,
        correctAnswer,
        explanation,
      });
    }
  }

  return extracted.length >= 2 || (extracted.length === 1 && extracted[0].options.length >= 2) ? extracted : null;
}

/**
 * Builds structured activity object matching the structured interactive response protocol.
 */
export function buildActivityFromUniversal(universal: UniversalResponse): any | undefined {
  const assessmentBlock = universal.blocks.find((b) => b.type === "assessment");
  if (assessmentBlock && assessmentBlock.type === "assessment") {
    return {
      type: "interactive_quiz",
      id: assessmentBlock.id,
      title: assessmentBlock.title || "Interactive Assessment",
      description: assessmentBlock.description || "Test your knowledge one question at a time.",
      mode: "one_question_at_a_time",
      questions: assessmentBlock.questions,
      progress: {
        currentQuestion: 0,
        totalQuestions: assessmentBlock.questions.length,
      },
      scoring: {
        total: assessmentBlock.questions.length,
        currentScore: 0,
      },
      completionRules: {
        requiresAllAnswered: true,
        showResultsAtEnd: true,
      },
    };
  }

  const chartBlock = universal.blocks.find((b) => b.type === "chart");
  if (chartBlock && chartBlock.type === "chart") {
    return {
      type: "charts",
      id: chartBlock.id,
      title: chartBlock.title,
      chartType: chartBlock.chartType,
      data: chartBlock.data,
      xAxisKey: chartBlock.xAxisKey,
      series: chartBlock.series,
    };
  }

  const tableBlock = universal.blocks.find((b) => b.type === "table");
  if (tableBlock && tableBlock.type === "table") {
    return {
      type: "tables",
      id: tableBlock.id,
      title: tableBlock.title,
      columns: tableBlock.columns,
      rows: tableBlock.rows,
    };
  }

  const diagramBlock = universal.blocks.find((b) => b.type === "diagram");
  if (diagramBlock && diagramBlock.type === "diagram") {
    return {
      type: "diagrams",
      id: diagramBlock.id,
      diagramType: diagramBlock.diagramType,
      code: diagramBlock.code,
    };
  }

  return undefined;
}

