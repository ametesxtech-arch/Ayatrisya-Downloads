/**
 * Ayatrisya Unified Response Protocol Zod Schemas
 * Enforces rigorous schema validation, safe types, and version compatibility.
 */

import { z } from "zod";

const citationSourceSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  title: z.string().min(1).max(300),
  url: z.string().url().max(2048).optional(),
  domain: z.string().max(200).optional(),
  snippet: z.string().max(2000).optional(),
  verified: z.boolean().default(false),
});

const slideSchema = z.object({
  title: z.string().min(1).max(200),
  bullets: z.array(z.string().max(1000)).default([]),
  visualPrompt: z.string().max(1000).optional(),
});

const toolCallSchema = z.object({
  callId: z.string().default(() => crypto.randomUUID()),
  toolName: z.string().min(1).max(100),
  parameters: z.record(z.unknown()).default({}),
  status: z.enum(["pending", "approved", "executing", "completed", "failed", "rejected"]).default("pending"),
  approvalRequired: z.boolean().default(false),
  permissionDomain: z.enum(["research", "coding", "image", "workspace", "general"]).default("general"),
});

const toolResultSchema = z.object({
  callId: z.string(),
  toolName: z.string().min(1).max(100),
  output: z.unknown(),
  error: z.string().optional(),
  success: z.boolean().default(true),
});

const mcqOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().optional(),
});

const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(mcqOptionSchema).min(2),
  multiSelect: z.boolean().optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string().optional(),
  hint: z.string().optional(),
});

const formFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "email", "number", "select", "checkbox"]).default("text"),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().optional(),
});

const formStepSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(formFieldSchema),
});

const chartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  secondaryValue: z.number().optional(),
  color: z.string().optional(),
});

export const responseBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("markdown"),
    id: z.string().default(() => crypto.randomUUID()),
    content: z.string(),
  }),
  z.object({
    type: z.literal("plain_text"),
    id: z.string().default(() => crypto.randomUUID()),
    content: z.string(),
  }),
  z.object({
    type: z.literal("code"),
    id: z.string().default(() => crypto.randomUUID()),
    language: z.string().default("text"),
    code: z.string(),
    title: z.string().optional(),
    filename: z.string().optional(),
    allowRun: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("math"),
    id: z.string().default(() => crypto.randomUUID()),
    expression: z.string(),
    displayMode: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("table"),
    id: z.string().default(() => crypto.randomUUID()),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))),
    title: z.string().optional(),
    sortable: z.boolean().default(true),
    filterable: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("chart"),
    id: z.string().default(() => crypto.randomUUID()),
    chartType: z.enum(["bar", "pie", "line", "metric"]).default("bar"),
    data: z.array(chartDataPointSchema),
    title: z.string().optional(),
    metricLabel: z.string().optional(),
    metricValue: z.union([z.string(), z.number()]).optional(),
  }),
  z.object({
    type: z.literal("flowchart"),
    id: z.string().default(() => crypto.randomUUID()),
    code: z.string(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("diagram"),
    id: z.string().default(() => crypto.randomUUID()),
    diagramType: z.enum(["mermaid", "flowchart", "mindmap"]).default("mermaid"),
    code: z.string(),
    title: z.string().optional(),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal("quiz"),
    id: z.string().default(() => crypto.randomUUID()),
    title: z.string().min(1),
    description: z.string().optional(),
    questions: z.array(quizQuestionSchema).min(1),
    passingScore: z.number().min(0).max(100).default(70),
  }),
  z.object({
    type: z.literal("form"),
    id: z.string().default(() => crypto.randomUUID()),
    title: z.string().optional(),
    steps: z.array(formStepSchema).min(1),
    submitLabel: z.string().optional(),
    summaryMessage: z.string().optional(),
  }),
  z.object({
    type: z.literal("citation"),
    id: z.string().default(() => crypto.randomUUID()),
    sources: z.array(citationSourceSchema),
    summary: z.string().optional(),
  }),
  z.object({
    type: z.literal("image"),
    id: z.string().default(() => crypto.randomUUID()),
    url: z.string().optional(),
    dataBase64: z.string().optional(),
    mimeType: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    prompt: z.string().optional(),
  }),
  z.object({
    type: z.literal("media"),
    id: z.string().default(() => crypto.randomUUID()),
    mediaType: z.enum(["audio", "video", "3d"]),
    url: z.string().optional(),
    dataBase64: z.string().optional(),
    title: z.string().optional(),
    format: z.string().optional(),
  }),
  z.object({
    type: z.literal("document"),
    id: z.string().default(() => crypto.randomUUID()),
    title: z.string().min(1),
    documentType: z.enum(["docx", "pdf", "markdown", "text"]).default("markdown"),
    content: z.string().optional(),
    downloadUrl: z.string().optional(),
    fileName: z.string().optional(),
  }),
  z.object({
    type: z.literal("presentation"),
    id: z.string().default(() => crypto.randomUUID()),
    title: z.string().min(1),
    slides: z.array(slideSchema).min(1),
    theme: z.string().optional(),
  }),
  z.object({
    type: z.literal("tool_call"),
    id: z.string().default(() => crypto.randomUUID()),
    toolCall: toolCallSchema,
  }),
  z.object({
    type: z.literal("tool_result"),
    id: z.string().default(() => crypto.randomUUID()),
    toolResult: toolResultSchema,
  }),
  z.object({
    type: z.literal("progress"),
    id: z.string().default(() => crypto.randomUUID()),
    label: z.string(),
    percent: z.number().min(0).max(100).optional(),
    stage: z.string().optional(),
    details: z.string().optional(),
  }),
  z.object({
    type: z.literal("error"),
    id: z.string().default(() => crypto.randomUUID()),
    message: z.string(),
    code: z.string().optional(),
    recoverable: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("completion"),
    id: z.string().default(() => crypto.randomUUID()),
    finishReason: z.enum(["stop", "length", "tool_call", "cancelled", "error"]).default("stop"),
    tokensUsed: z.number().optional(),
  }),
]);

export const unifiedResponseSchema = z.object({
  version: z.enum(["1.0", "2.0"]).default("2.0"),
  messageId: z.string().default(() => crypto.randomUUID()),
  blocks: z.array(responseBlockSchema).default([]),
  metadata: z
    .object({
      model: z.string().optional(),
      mode: z.string().optional(),
      timestamp: z.string().optional(),
      source: z.string().optional(),
      intent: z.string().optional(),
      latencyMs: z.number().optional(),
    })
    .optional(),
});

