import { z } from "zod";

/**
 * Ayatrisya Universal Response Protocol 2.0
 * Comprehensive, versioned schema definitions for structured multimodal AI responses.
 */

export const ProtocolVersion = z.literal("2.0");

// Base Content Block
export const BaseContentBlockSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
});

// 1. Text & Markdown Block
export const TextBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("text"),
  content: z.string(),
});

export const MarkdownBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("markdown"),
  content: z.string(),
});

// 2. Code Block
export const CodeBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("code"),
  language: z.string().default("typescript"),
  code: z.string(),
  filename: z.string().optional(),
  executable: z.boolean().default(false),
});

// 3. Mathematical Notation Block
export const MathBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("math"),
  latex: z.string(),
  displayMode: z.boolean().default(false),
  explanation: z.string().optional(),
});

// 4. Structured Table Block
export const TableBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("table"),
  title: z.string().optional(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))),
  filterable: z.boolean().default(true),
  sortable: z.boolean().default(true),
});

// 5. Interactive Chart Block
export const ChartBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("chart"),
  chartType: z.enum(["bar", "line", "pie", "area", "scatter"]).default("bar"),
  title: z.string(),
  data: z.array(z.record(z.union([z.string(), z.number()]))),
  xAxisKey: z.string(),
  series: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string().optional(),
  })),
});

// 6. Diagram Block (Mermaid / SVG)
export const DiagramBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("diagram"),
  diagramType: z.enum(["mermaid", "flowchart", "sequence", "architecture"]).default("mermaid"),
  code: z.string(),
  caption: z.string().optional(),
});

// 7. Citation Block
export const CitationBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("citation"),
  sourceId: z.number().int().min(1),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  domain: z.string().optional(),
  verified: z.boolean().default(true),
});

// 8. Assessment Question Schema
export const AssessmentOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().optional(),
});

export const MatchPairSchema = z.object({
  id: z.string(),
  left: z.string(),
  right: z.string(),
});

export const AssessmentQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "single_choice",
    "multiple_choice",
    "true_false",
    "assertion_reason",
    "match_following",
    "case_based",
    "image_based",
  ]),
  question: z.string().min(1),
  assertion: z.string().optional(),
  reason: z.string().optional(),
  passage: z.string().optional(),
  imageUrl: z.string().optional(),
  options: z.array(AssessmentOptionSchema).optional(),
  matchPairs: z.array(MatchPairSchema).optional(),
  // In exam mode, correct answer is retained securely on server until submission
  correctAnswer: z.union([z.string(), z.array(z.string()), z.record(z.string())]).optional(),
  explanation: z.string().optional(),
  hint: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  isPyq: z.boolean().default(false),
  examTag: z.string().optional(),
});

export const AssessmentBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("assessment"),
  title: z.string().min(1),
  description: z.string().optional(),
  mode: z.enum(["practice", "examination"]).default("practice"),
  timeLimitMinutes: z.number().int().min(1).max(360).default(30),
  passingScore: z.number().min(0).max(100).default(70),
  totalMarks: z.number().optional(),
  examType: z.string().optional(), // 'CBSE', 'JEE', 'NEET', etc.
  questions: z.array(AssessmentQuestionSchema),
  topicSummary: z.array(z.string()).optional(),
});

// 9. Interactive Calculator Block
export const CalculatorBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("calculator"),
  title: z.string(),
  calculatorType: z.string().default("general"),
  inputs: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["number", "select", "slider"]).default("number"),
    defaultValue: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    options: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  })),
  formula: z.string(),
  unit: z.string().optional(),
});

// 10. Interactive Form Block
export const FormBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("form"),
  title: z.string(),
  fields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "number", "select", "checkbox"]),
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
  })),
  submitLabel: z.string().default("Submit"),
  actionId: z.string().optional(),
});

// 11. Artifact Preview Block
export const ArtifactBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("artifact"),
  artifactId: z.string().optional(),
  title: z.string(),
  artifactKind: z.enum(["website", "code", "document", "spreadsheet", "presentation"]),
  content: z.string(),
  language: z.string().optional(),
  previewUrl: z.string().optional(),
});

// 12. Comparison Block
export const ComparisonBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("comparison"),
  title: z.string().optional(),
  entities: z.array(z.string()),
  criteria: z.array(z.object({
    criterion: z.string(),
    values: z.record(z.string()),
  })),
});

// 13. Expandable Accordion Block
export const AccordionBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("accordion"),
  title: z.string().optional(),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
  })),
});

// 14. Timetable Block
export const TimetableBlockSchema = BaseContentBlockSchema.extend({
  type: z.literal("timetable"),
  title: z.string(),
  entries: z.array(z.object({
    dayOrTime: z.string(),
    subjectOrTask: z.string(),
    durationMinutes: z.number().optional(),
    notes: z.string().optional(),
  })),
});

// Union of all Content Blocks
export const ContentBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  MarkdownBlockSchema,
  CodeBlockSchema,
  MathBlockSchema,
  TableBlockSchema,
  ChartBlockSchema,
  DiagramBlockSchema,
  CitationBlockSchema,
  AssessmentBlockSchema,
  CalculatorBlockSchema,
  FormBlockSchema,
  ArtifactBlockSchema,
  ComparisonBlockSchema,
  AccordionBlockSchema,
  TimetableBlockSchema,
]);

// Full Universal Response Package
export const UniversalResponseSchema = z.object({
  version: ProtocolVersion,
  messageId: z.string(),
  conversationId: z.string(),
  intent: z.enum([
    "general_conversation",
    "assessment_request",
    "code_generation",
    "project_planning",
    "security_audit",
    "database_design",
    "algorithm_design",
    "technical_explanation",
    "data_visualization",
    "comparison_request",
    "calculation_request",
    "timetable_request",
    "artifact_creation",
    "research_query",
  ]).default("general_conversation"),
  plainText: z.string(), // Raw or formatted Markdown string for backward compatibility
  blocks: z.array(ContentBlockSchema),
  citations: z.array(CitationBlockSchema).default([]),
  suggestedFollowUps: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

export type ProtocolVersionType = z.infer<typeof ProtocolVersion>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type AssessmentBlock = z.infer<typeof AssessmentBlockSchema>;
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;
export type UniversalResponse = z.infer<typeof UniversalResponseSchema>;

