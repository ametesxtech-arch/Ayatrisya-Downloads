/**
 * Ayatrisya Unified Response Protocol (v2.0)
 *
 * Provides a strongly-typed, versioned, validated response protocol for all
 * conversational interactions between the model pipeline and frontend renderer.
 */

import type { QuizQuestion, FormStep, ChartDataPoint } from "@/components/interactive-blocks/types";

export type ResponseProtocolVersion = "2.0" | "1.0";

export interface ProtocolCitationSource {
  id: string;
  title: string;
  url?: string;
  domain?: string;
  snippet?: string;
  verified?: boolean;
}

export interface ProtocolSlide {
  title: string;
  bullets: string[];
  visualPrompt?: string;
}

export interface ProtocolToolCall {
  callId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: "pending" | "approved" | "executing" | "completed" | "failed" | "rejected";
  approvalRequired?: boolean;
  permissionDomain?: "research" | "coding" | "image" | "workspace" | "general";
}

export interface ProtocolToolResult {
  callId: string;
  toolName: string;
  output: unknown;
  error?: string;
  success: boolean;
}

// ─── Block Variants ──────────────────────────────────────────────────────────

export type ResponseBlock =
  | {
      type: "markdown";
      id: string;
      content: string;
    }
  | {
      type: "plain_text";
      id: string;
      content: string;
    }
  | {
      type: "code";
      id: string;
      language: string;
      code: string;
      title?: string;
      filename?: string;
      allowRun?: boolean;
    }
  | {
      type: "math";
      id: string;
      expression: string;
      displayMode: boolean; // true = display ($$), false = inline ($)
    }
  | {
      type: "table";
      id: string;
      headers: string[];
      rows: Array<Array<string | number | boolean>>;
      title?: string;
      sortable?: boolean;
      filterable?: boolean;
    }
  | {
      type: "chart";
      id: string;
      chartType: "bar" | "pie" | "line" | "metric";
      data: ChartDataPoint[];
      title?: string;
      metricLabel?: string;
      metricValue?: string | number;
    }
  | {
      type: "flowchart";
      id: string;
      code: string;
      title?: string;
    }
  | {
      type: "diagram";
      id: string;
      diagramType: "mermaid" | "flowchart" | "mindmap";
      code: string;
      title?: string;
      caption?: string;
    }
  | {
      type: "quiz";
      id: string;
      title: string;
      description?: string;
      questions: QuizQuestion[];
      passingScore?: number;
    }
  | {
      type: "form";
      id: string;
      title?: string;
      steps: FormStep[];
      submitLabel?: string;
      summaryMessage?: string;
    }
  | {
      type: "citation";
      id: string;
      sources: ProtocolCitationSource[];
      summary?: string;
    }
  | {
      type: "image";
      id: string;
      url?: string;
      dataBase64?: string;
      mimeType?: string;
      alt?: string;
      caption?: string;
      prompt?: string;
    }
  | {
      type: "media";
      id: string;
      mediaType: "audio" | "video" | "3d";
      url?: string;
      dataBase64?: string;
      title?: string;
      format?: string;
    }
  | {
      type: "document";
      id: string;
      title: string;
      documentType: "docx" | "pdf" | "markdown" | "text";
      content?: string;
      downloadUrl?: string;
      fileName?: string;
    }
  | {
      type: "presentation";
      id: string;
      title: string;
      slides: ProtocolSlide[];
      theme?: string;
    }
  | {
      type: "tool_call";
      id: string;
      toolCall: ProtocolToolCall;
    }
  | {
      type: "tool_result";
      id: string;
      toolResult: ProtocolToolResult;
    }
  | {
      type: "progress";
      id: string;
      label: string;
      percent?: number;
      stage?: string;
      details?: string;
    }
  | {
      type: "error";
      id: string;
      message: string;
      code?: string;
      recoverable?: boolean;
    }
  | {
      type: "completion";
      id: string;
      finishReason?: "stop" | "length" | "tool_call" | "cancelled" | "error";
      tokensUsed?: number;
    };

export interface UnifiedMessageResponse {
  version: ResponseProtocolVersion;
  messageId: string;
  blocks: ResponseBlock[];
  metadata?: {
    model?: string;
    mode?: string;
    timestamp?: string;
    source?: string;
    intent?: string;
    latencyMs?: number;
  };
}

export type CitationBlock = Extract<ResponseBlock, { type: "citation" }>;
export type ChartBlock = Extract<ResponseBlock, { type: "chart" }>;
export type CodeBlock = Extract<ResponseBlock, { type: "code" }>;
export type MarkdownBlock = Extract<ResponseBlock, { type: "markdown" }>;
export type MathBlock = Extract<ResponseBlock, { type: "math" }>;
export type QuizBlock = Extract<ResponseBlock, { type: "quiz" }>;
export type FormBlock = Extract<ResponseBlock, { type: "form" }>;
export type ToolCallBlock = Extract<ResponseBlock, { type: "tool_call" }>;
export type ToolResultBlock = Extract<ResponseBlock, { type: "tool_result" }>;
export type ProgressBlock = Extract<ResponseBlock, { type: "progress" }>;
export type CompletionBlock = Extract<ResponseBlock, { type: "completion" }>;
