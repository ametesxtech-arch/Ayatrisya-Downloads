import { z } from 'zod';
import type { InteractiveBlock } from './types';

// Sub-schemas
const mcqOptionSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(500),
  hint: z.string().max(500).optional(),
});

const mcqBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('mcq'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  question: z.string().min(1).max(2000),
  options: z.array(mcqOptionSchema).min(2).max(12),
  multiSelect: z.boolean().optional(),
  correctAnswer: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
  explanation: z.string().max(3000).optional(),
  hint: z.string().max(1000).optional(),
  shuffleOptions: z.boolean().optional(),
});

const quizQuestionSchema = z.object({
  id: z.string().min(1).max(50),
  question: z.string().min(1).max(2000),
  options: z.array(mcqOptionSchema).min(2).max(12),
  multiSelect: z.boolean().optional(),
  correctAnswer: z.union([z.string().min(1), z.array(z.string().min(1))]),
  explanation: z.string().max(3000).optional(),
  hint: z.string().max(1000).optional(),
});

const quizBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('quiz'),
  id: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  caption: z.string().max(300).optional(),
  questions: z.array(quizQuestionSchema).min(1).max(25),
  passingScore: z.number().min(0).max(100).optional(),
  allowRetry: z.boolean().optional(),
});

const pollOptionSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(300),
  votes: z.number().nonnegative().optional(),
  percentage: z.number().min(0).max(100).optional(),
});

const pollBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('poll'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  question: z.string().min(1).max(1000),
  options: z.array(pollOptionSchema).min(2).max(10),
  allowMultiple: z.boolean().optional(),
  totalVotes: z.number().nonnegative().optional(),
});

const flashcardItemSchema = z.object({
  id: z.string().max(50).optional(),
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(5000),
  hint: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

const flashcardBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('flashcard'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  cards: z.array(flashcardItemSchema).min(1).max(50),
});

const matchingPairSchema = z.object({
  id: z.string().min(1).max(50),
  left: z.string().min(1).max(300),
  right: z.string().min(1).max(300),
});

const matchingBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('matching'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  pairs: z.array(matchingPairSchema).min(2).max(10),
  explanation: z.string().max(2000).optional(),
});

const sortingItemSchema = z.object({
  id: z.string().min(1).max(50),
  text: z.string().min(1).max(300),
  correctIndex: z.number().int().nonnegative().optional(),
});

const sortingBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('sorting'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  items: z.array(sortingItemSchema).min(2).max(10),
  explanation: z.string().max(2000).optional(),
});

const fillBlankItemSchema = z.object({
  id: z.string().min(1).max(50),
  answer: z.string().min(1).max(200),
  hint: z.string().max(300).optional(),
});

const fillBlankBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('fill_blank'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  textWithBlanks: z.string().min(1).max(3000),
  blanks: z.array(fillBlankItemSchema).min(1).max(10),
  explanation: z.string().max(2000).optional(),
});

const decisionTreeNodeSchema = z.object({
  prompt: z.string().min(1).max(1000),
  options: z.array(
    z.object({
      label: z.string().min(1).max(200),
      nextNodeId: z.string().max(50).optional(),
      outcome: z.string().max(1000).optional(),
      tag: z.string().max(50).optional(),
    })
  ).min(1).max(8),
});

const decisionTreeBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('decision_tree'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  rootNodeId: z.string().min(1).max(50),
  nodes: z.record(decisionTreeNodeSchema),
});

const accordionItemSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(10000),
  badge: z.string().max(50).optional(),
  defaultExpanded: z.boolean().optional(),
});

const accordionBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('accordion'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  items: z.array(accordionItemSchema).min(1).max(30),
});

const stepItemSchema = z.object({
  number: z.number().int().positive().optional(),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  code: z.string().max(20000).optional(),
  language: z.string().max(50).optional(),
  status: z.enum(['completed', 'current', 'pending']).optional(),
});

const stepsBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('steps'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  steps: z.array(stepItemSchema).min(1).max(50),
  allowCompleteToggle: z.boolean().optional(),
});

const checklistItemSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(500),
  checked: z.boolean().optional(),
  category: z.string().max(100).optional(),
});

const checklistBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('checklist'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  items: z.array(checklistItemSchema).min(1).max(50),
});

const kanbanCardSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  tag: z.string().max(50).optional(),
});

const kanbanColumnSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(100),
  cards: z.array(kanbanCardSchema).max(30),
});

const kanbanBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('kanban'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  columns: z.array(kanbanColumnSchema).min(2).max(6),
});

const formFieldSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'email', 'number', 'select', 'checkbox']),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string().max(100)).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().optional(),
});

const formStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  fields: z.array(formFieldSchema).min(1).max(15),
});

const formWizardBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('form_wizard'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  steps: z.array(formStepSchema).min(1).max(10),
  submitLabel: z.string().max(50).optional(),
  summaryMessage: z.string().max(500).optional(),
});

const calculatorVariableSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  defaultValue: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
});

const calculatorBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('calculator'),
  id: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  caption: z.string().max(300).optional(),
  formula: z.string().min(1).max(500),
  variables: z.array(calculatorVariableSchema).min(1).max(10),
  resultLabel: z.string().max(100).optional(),
  resultUnit: z.string().max(20).optional(),
  formulaType: z.enum(['product', 'sum', 'roi', 'compound']).optional(),
});

const diagramBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('diagram'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  diagramType: z.enum(['mermaid', 'flowchart', 'mindmap']),
  code: z.string().min(1).max(10000),
});

export const mindMapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(300),
    children: z.array(mindMapNodeSchema).optional(),
    collapsed: z.boolean().optional(),
    color: z.string().max(50).optional(),
  })
);

export const mindMapBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('mindmap'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  root: mindMapNodeSchema,
  theme: z.enum(['violet', 'teal', 'amber', 'rose', 'default']).optional(),
});

const jsonViewerBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('json_viewer'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  data: z.unknown(),
});

const regexTesterBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('regex_tester'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  pattern: z.string().min(1).max(500),
  flags: z.string().max(10).optional(),
  testString: z.string().min(1).max(10000),
  explanation: z.string().max(1000).optional(),
});

const apiBuilderBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('api_builder'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  url: z.string().min(1).max(2048),
  headers: z.record(z.string().max(500)).optional(),
  body: z.string().max(20000).optional(),
  queryParams: z.record(z.string().max(500)).optional(),
});

const comparisonCriterionSchema = z.object({
  criterion: z.string().min(1).max(200),
  values: z.record(z.union([z.string().max(500), z.boolean(), z.number()])),
  winner: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

const comparisonBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('comparison'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  entities: z.array(z.string().min(1).max(100)).min(2).max(6),
  criteria: z.array(comparisonCriterionSchema).min(1).max(30),
});

const tableBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('table'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  headers: z.array(z.string().max(150)).min(1).max(15),
  rows: z.array(z.array(z.union([z.string().max(1000), z.number(), z.boolean()]))).max(200),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
});

const inputControlSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('slider'),
    id: z.string().min(1).max(50),
    label: z.string().min(1).max(200),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(),
    defaultValue: z.number(),
    unit: z.string().max(20).optional(),
  }),
  z.object({
    type: z.literal('toggle'),
    id: z.string().min(1).max(50),
    label: z.string().min(1).max(200),
    defaultValue: z.boolean(),
  }),
  z.object({
    type: z.literal('select'),
    id: z.string().min(1).max(50),
    label: z.string().min(1).max(200),
    options: z.array(z.object({ value: z.string(), label: z.string() })).min(1).max(20),
    defaultValue: z.string(),
  }),
]);

const inputControlsBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('input_controls'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  caption: z.string().max(300).optional(),
  controls: z.array(inputControlSchema).min(1).max(10),
  outputSummary: z.string().max(1000).optional(),
});

const progressItemSchema = z.object({
  label: z.string().min(1).max(200),
  value: z.number(),
  max: z.number().positive().optional(),
  color: z.string().max(50).optional(),
  details: z.string().max(300).optional(),
});

const progressBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('progress'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  items: z.array(progressItemSchema).min(1).max(20),
});

const chartDataPointSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.number(),
  secondaryValue: z.number().optional(),
  color: z.string().max(50).optional(),
});

const chartBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('chart'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  chartType: z.enum(['bar', 'pie', 'line', 'metric']),
  data: z.array(chartDataPointSchema).min(1).max(50),
  metricLabel: z.string().max(100).optional(),
  metricValue: z.union([z.string().max(100), z.number()]).optional(),
});

const audioPlayerBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('audio_player'),
  id: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  caption: z.string().max(300).optional(),
  audioUrl: z.string().url().max(2048).optional(),
  dataBase64: z.string().max(20_000_000).optional(),
  duration: z.number().positive().optional(),
  artist: z.string().max(100).optional(),
});

const midiNoteSchema = z.object({
  pitch: z.string().min(1).max(10),
  duration: z.number().positive(),
  time: z.number().nonnegative(),
});

const midiPreviewBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('midi_preview'),
  id: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  caption: z.string().max(300).optional(),
  notes: z.array(midiNoteSchema).min(1).max(500),
  bpm: z.number().positive().optional(),
  instrument: z.string().max(50).optional(),
});

const storyboardSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  duration: z.string().max(50).optional(),
  visualPrompt: z.string().max(1000).optional(),
  imageUrl: z.string().url().max(2048).optional(),
});

const storyboardBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('storyboard'),
  id: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  caption: z.string().max(300).optional(),
  scenes: z.array(storyboardSceneSchema).min(1).max(20),
});

const imageVariationItemSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url().max(2048).optional(),
  dataBase64: z.string().max(10_000_000).optional(),
  promptAdjustment: z.string().max(500).optional(),
});

const imageVariationBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('image_variation'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  prompt: z.string().min(1).max(2000),
  variations: z.array(imageVariationItemSchema).min(1).max(8),
});

const codeInteractiveBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('code'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  code: z.string().min(1).max(50000),
  language: z.string().max(50),
  output: z.string().max(10000).optional(),
  readOnly: z.boolean().optional(),
});

const mediaItemSchema = z.object({
  url: z.string().url().max(2048).optional(),
  dataBase64: z.string().max(10_000_000).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
  kind: z.enum(['image', 'audio', 'model3d']),
});

const mediaBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('media'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  items: z.array(mediaItemSchema).min(1).max(10),
});

const scheduledTaskExecutionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  triggeredAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(['success', 'failed', 'missed', 'skipped']),
  output: z.string().optional(),
  error: z.string().optional(),
  target: z.enum(['cloud', 'desktop']),
});

const scheduledTaskDataSchema = z.object({
  id: z.string().min(1).max(100),
  ownerId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'failed', 'missed']),
  recurrence: z.enum(['one-time', 'daily', 'weekly', 'weekdays', 'monthly', 'interval_days']),
  time: z.string().max(20).optional(),
  timezone: z.string().min(1).max(100),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  intervalDays: z.number().positive().optional(),
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
  nextRunAt: z.string().nullable().optional(),
  lastRunAt: z.string().nullable().optional(),
  lastExecution: scheduledTaskExecutionSchema.nullable().optional(),
  actionType: z.enum([
    'notification',
    'study_reminder',
    'task_summary',
    'practice_quiz',
    'project_status',
    'code_review',
    'custom',
  ]),
  actionPayload: z.record(z.unknown()).optional(),
  executionTarget: z.enum(['cloud', 'desktop']),
  requiresConfirmation: z.boolean().optional(),
  retriesRemaining: z.number().min(0).max(10).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  retryIntervalMinutes: z.number().min(1).max(1440).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const scheduledTaskBlockSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('scheduled_task'),
  id: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  task: scheduledTaskDataSchema,
  allowEdit: z.boolean().optional(),
  history: z.array(scheduledTaskExecutionSchema).optional(),
});

export const interactiveBlockSchema = z.discriminatedUnion('type', [
  mcqBlockSchema,
  quizBlockSchema,
  pollBlockSchema,
  flashcardBlockSchema,
  matchingBlockSchema,
  sortingBlockSchema,
  fillBlankBlockSchema,
  decisionTreeBlockSchema,
  accordionBlockSchema,
  stepsBlockSchema,
  checklistBlockSchema,
  kanbanBlockSchema,
  formWizardBlockSchema,
  calculatorBlockSchema,
  diagramBlockSchema,
  mindMapBlockSchema,
  jsonViewerBlockSchema,
  regexTesterBlockSchema,
  apiBuilderBlockSchema,
  comparisonBlockSchema,
  tableBlockSchema,
  inputControlsBlockSchema,
  progressBlockSchema,
  chartBlockSchema,
  audioPlayerBlockSchema,
  midiPreviewBlockSchema,
  storyboardBlockSchema,
  imageVariationBlockSchema,
  codeInteractiveBlockSchema,
  mediaBlockSchema,
  scheduledTaskBlockSchema,
]);

export type ParseInteractiveResult =
  | { status: 'valid'; block: InteractiveBlock }
  | { status: 'streaming_incomplete' }
  | { status: 'invalid'; error: string };

/**
 * Deterministically normalizes model output variants (such as series-based charts,
 * string-array quiz options, or natural index references) to conform strictly to the Zod schema.
 */
export function normalizeInteractivePayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  // 1. Chart Normalization: Convert series-based charts to data array
  if (obj.type === 'chart') {
    if (!Array.isArray(obj.data) && Array.isArray(obj.series) && obj.series.length > 0) {
      const firstSeries = obj.series[0];
      if (firstSeries && Array.isArray(firstSeries.data)) {
        const normalizedData: Array<{ label: string; value: number; color?: string }> = [];
        for (const pt of firstSeries.data) {
          if (pt && typeof pt === 'object') {
            const label = String(pt.label ?? pt.name ?? pt.x ?? '').trim();
            const rawVal = pt.value ?? pt.y;
            const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
            if (label && !isNaN(numVal)) {
              normalizedData.push({
                label,
                value: numVal,
                ...(typeof pt.color === 'string' ? { color: pt.color } : {}),
              });
            }
          }
        }
        if (normalizedData.length > 0) {
          obj.data = normalizedData;
        }
      }
    }
  }

  // 2. Quiz Normalization: Convert string options to mcqOptionSchema { id, label } and validate answers
  if (obj.type === 'quiz' && Array.isArray(obj.questions)) {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    obj.questions = obj.questions.map((q: unknown, qIdx: number) => {
      if (!q || typeof q !== 'object') return q;
      const questionObj = { ...(q as Record<string, unknown>) };

      // Ensure question id exists
      if (!questionObj.id || typeof questionObj.id !== 'string') {
        questionObj.id = `q${qIdx + 1}`;
      }

      // Normalize options if they are an array of strings or missing id/label
      if (Array.isArray(questionObj.options)) {
        questionObj.options = questionObj.options.map((opt: unknown, oIdx: number) => {
          if (typeof opt === 'string') {
            const letterId = letters[oIdx] || `opt${oIdx + 1}`;
            return { id: letterId, label: opt.trim() };
          }
          if (opt && typeof opt === 'object') {
            const optRecord = { ...(opt as Record<string, unknown>) };
            const id = String(optRecord.id ?? letters[oIdx] ?? `opt${oIdx + 1}`);
            const label = String(optRecord.label ?? optRecord.text ?? optRecord.title ?? id);
            return { ...optRecord, id, label };
          }
          return opt;
        });
      }

      // Normalize correctAnswer / correctOptionIndex
      const validOptionIds = Array.isArray(questionObj.options)
        ? questionObj.options.map((o: any) => o?.id).filter(Boolean)
        : [];

      // If model gave correctOptionIndex (e.g. 0) or correctAnswer: 0
      if (
        questionObj.correctAnswer === undefined &&
        typeof questionObj.correctOptionIndex === 'number'
      ) {
        const targetId = validOptionIds[questionObj.correctOptionIndex];
        if (targetId) questionObj.correctAnswer = targetId;
      } else if (typeof questionObj.correctAnswer === 'number') {
        const targetId = validOptionIds[questionObj.correctAnswer];
        if (targetId) questionObj.correctAnswer = targetId;
      } else if (typeof questionObj.correctAnswer === 'string') {
        const trimmed = questionObj.correctAnswer.trim();
        // If it matches an option id (e.g. "a", "b")
        const directMatch = validOptionIds.find(
          (id) => String(id).toLowerCase() === trimmed.toLowerCase()
        );
        if (directMatch) {
          questionObj.correctAnswer = directMatch;
        } else {
          // If the model gave the full text of the option as the answer, map it to the matching option id
          const textMatch = Array.isArray(questionObj.options)
            ? questionObj.options.find(
                (o: any) => o?.label?.toLowerCase() === trimmed.toLowerCase()
              )
            : null;
          if (textMatch) {
            questionObj.correctAnswer = textMatch.id;
          }
        }
      }

      return questionObj;
    });
  }

  return obj;
}

/**
 * Safely parses raw text (from an interactive code block or JSON) into a typed InteractiveBlock.
 * Treats all model output as untrusted and avoids throwing exceptions.
 */
export function parseInteractiveBlock(
  rawText: string,
  options: { isStreaming?: boolean } = {}
): ParseInteractiveResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return options.isStreaming ? { status: 'streaming_incomplete' } : { status: 'invalid', error: 'Empty payload' };
  }

  // Strip markdown code fences if wrapped inside ``` or ```json
  let cleaned = trimmed;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:[a-zA-Z0-9_-]+)?\s*/i, '');
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3).trim();
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    if (options.isStreaming) {
      return { status: 'streaming_incomplete' };
    }
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return { status: 'invalid', error: `Malformed JSON: ${message}` };
  }

  const normalized = normalizeInteractivePayload(parsed);
  const result = interactiveBlockSchema.safeParse(normalized);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`).join(', ');
    return { status: 'invalid', error: `Schema validation failed: ${errorDetails}` };
  }

  return { status: 'valid', block: result.data as InteractiveBlock };
}
