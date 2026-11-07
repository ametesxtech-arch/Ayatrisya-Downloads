/**
 * Ayatrisya Interactive Chat Blocks Schema & Types (v1.0)
 *
 * Supports structured, safe, and rich interactive blocks inside AI responses:
 * - MCQs and quizzes
 * - Flashcards with reveal and mastery tracking
 * - Matching, sorting, and fill-in-the-blank activities
 * - Polls, ranked choices, and decision trees
 * - Expandable answers and step-by-step tutorials
 * - Checklists, Kanban task boards, forms, and multi-step wizards
 * - Sliders, toggles, what-if calculators, and scenario simulations
 * - Tables, comparisons, sortable data, and charts
 * - Flowcharts, mind maps, and Mermaid diagrams
 * - JSON viewers, regex testers, and API request builders
 * - Audio players, MIDI previews, storyboards, and 3D previews
 */

import type { ScheduledTaskData, ScheduledTaskExecution } from '@/lib/scheduled-tasks/types';

export type InteractiveBlockVersion = '1.0';

export interface BaseInteractiveBlock {
  version: InteractiveBlockVersion;
  id?: string;
  title?: string;
  caption?: string;
}

// 1. Multiple-Choice Questions (MCQ)
export interface McqOption {
  id: string;
  label: string;
  hint?: string;
}

export interface McqBlock extends BaseInteractiveBlock {
  type: 'mcq';
  question: string;
  options: McqOption[];
  multiSelect?: boolean;
  correctAnswer?: string | string[]; // Hidden until submitted/revealed
  explanation?: string;
  hint?: string;
  shuffleOptions?: boolean;
}

// 2. Multi-Question Quiz
export interface QuizQuestion {
  id: string;
  question: string;
  options: McqOption[];
  multiSelect?: boolean;
  correctAnswer: string | string[];
  explanation?: string;
  hint?: string;
}

export interface QuizBlock extends BaseInteractiveBlock {
  type: 'quiz';
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passingScore?: number; // e.g., 70%
  allowRetry?: boolean;
}

// 3. Polls and Selectable Choices
export interface PollOption {
  id: string;
  label: string;
  votes?: number;
  percentage?: number;
}

export interface PollBlock extends BaseInteractiveBlock {
  type: 'poll';
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  totalVotes?: number;
}

// 4. Flashcards
export interface FlashcardItem {
  id?: string;
  front: string;
  back: string;
  hint?: string;
  category?: string;
}

export interface FlashcardBlock extends BaseInteractiveBlock {
  type: 'flashcard' | 'flashcards';
  title?: string;
  cards: FlashcardItem[];
}

// 5. Matching & Sorting
export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface MatchingBlock extends BaseInteractiveBlock {
  type: 'matching';
  title?: string;
  pairs: MatchingPair[];
  explanation?: string;
}

export interface SortingItem {
  id: string;
  text: string;
  correctIndex?: number;
}

export interface SortingBlock extends BaseInteractiveBlock {
  type: 'sorting';
  title?: string;
  items: SortingItem[];
  explanation?: string;
}

// 6. Fill-in-the-Blank
export interface FillBlankItem {
  id: string;
  answer: string;
  hint?: string;
}

export interface FillBlankBlock extends BaseInteractiveBlock {
  type: 'fill_blank';
  title?: string;
  textWithBlanks: string; // e.g., "The capital of France is {{blank_1}}."
  blanks: FillBlankItem[];
  explanation?: string;
}

// 7. Decision Tree
export interface DecisionTreeNode {
  id?: string;
  prompt?: string;
  question?: string;
  description?: string;
  options: Array<{
    label: string;
    nextNodeId?: string;
    outcome?: string;
    tag?: string;
  }>;
}

export interface DecisionTreeBlock extends BaseInteractiveBlock {
  type: 'decision_tree';
  title?: string;
  rootNodeId: string;
  nodes: Record<string, DecisionTreeNode>;
}

// 8. Expandable Answers & Explanations (Accordion)
export interface AccordionItem {
  id: string;
  title: string;
  content: string;
  badge?: string;
  defaultExpanded?: boolean;
}

export interface AccordionBlock extends BaseInteractiveBlock {
  type: 'accordion';
  items: AccordionItem[];
}

// 9. Step-by-Step Solutions
export interface StepItem {
  number?: number;
  title: string;
  description: string;
  code?: string;
  language?: string;
  status?: 'completed' | 'current' | 'pending';
}

export interface StepsBlock extends BaseInteractiveBlock {
  type: 'steps';
  steps: StepItem[];
  allowCompleteToggle?: boolean;
}

// 10. Checklists and Task Lists
export interface ChecklistItem {
  id: string;
  label: string;
  checked?: boolean;
  category?: string;
}

export interface ChecklistBlock extends BaseInteractiveBlock {
  type: 'checklist';
  items: ChecklistItem[];
}

// 11. Kanban Task Board
export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  tag?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBlock extends BaseInteractiveBlock {
  type: 'kanban';
  title?: string;
  columns: KanbanColumn[];
}

// 12. Forms & Multi-Step Wizard
export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox';
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
  required?: boolean;
}

export interface FormStep {
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormWizardBlock extends BaseInteractiveBlock {
  type: 'form_wizard';
  title?: string;
  steps: FormStep[];
  submitLabel?: string;
  summaryMessage?: string;
}

// 13. What-If & Scenario Calculator
export interface CalculatorVariable {
  id: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface CalculatorBlock extends BaseInteractiveBlock {
  type: 'calculator';
  title: string;
  description?: string;
  formula: string; // descriptive math or simple algebraic expression
  variables: CalculatorVariable[];
  resultLabel?: string;
  resultUnit?: string;
  formulaType?: 'product' | 'sum' | 'roi' | 'compound';
}

// 14. Diagrams (Mermaid / Flowchart / Mindmap)
export interface DiagramBlock extends BaseInteractiveBlock {
  type: 'diagram';
  diagramType: 'mermaid' | 'flowchart' | 'mindmap';
  code: string;
  caption?: string;
}

// 14b. Dedicated Structured Visual Mind Map
export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  collapsed?: boolean;
  color?: string;
}

export interface MindMapBlock extends BaseInteractiveBlock {
  type: 'mindmap';
  root: MindMapNode;
  theme?: 'violet' | 'teal' | 'amber' | 'rose' | 'default';
  caption?: string;
}

// 15. JSON Viewer
export interface JsonViewerBlock extends BaseInteractiveBlock {
  type: 'json_viewer';
  title?: string;
  data: unknown;
}

// 16. Regex Tester
export interface RegexTesterBlock extends BaseInteractiveBlock {
  type: 'regex_tester';
  pattern: string;
  flags?: string;
  testString: string;
  explanation?: string;
}

// 17. API Request Builder
export interface ApiBuilderBlock extends BaseInteractiveBlock {
  type: 'api_builder';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  queryParams?: Record<string, string>;
  title?: string;
}

// 18. Comparison Cards & Matrices
export interface ComparisonCriterion {
  criterion: string;
  values: Record<string, string | boolean | number>;
  winner?: string;
  notes?: string;
}

export interface ComparisonBlock extends BaseInteractiveBlock {
  type: 'comparison';
  entities: string[];
  criteria: ComparisonCriterion[];
}

// 19. Structured Tables
export interface TableBlock extends BaseInteractiveBlock {
  type: 'table';
  headers: string[];
  rows: Array<Array<string | number | boolean>>;
  sortable?: boolean;
  filterable?: boolean;
}

// 20. Sliders, Toggles, and Input Controls
export type InputControl =
  | {
      type: 'slider';
      id: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      defaultValue: number;
      unit?: string;
    }
  | {
      type: 'toggle';
      id: string;
      label: string;
      defaultValue: boolean;
    }
  | {
      type: 'select';
      id: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      defaultValue: string;
    };

export interface InputControlsBlock extends BaseInteractiveBlock {
  type: 'input_controls';
  description?: string;
  controls: InputControl[];
  outputSummary?: string;
}

// 21. Progress Indicators
export interface ProgressItem {
  label: string;
  value: number; // 0 to max
  max?: number;  // defaults to 100
  color?: string;
  details?: string;
}

export interface ProgressBlock extends BaseInteractiveBlock {
  type: 'progress';
  items: ProgressItem[];
}

// 22. Lightweight Charts
export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

export interface ChartBlock extends BaseInteractiveBlock {
  type: 'chart';
  chartType: 'bar' | 'pie' | 'line' | 'metric';
  data: ChartDataPoint[];
  metricLabel?: string;
  metricValue?: string | number;
}

// 23. Audio Player
export interface AudioPlayerBlock extends BaseInteractiveBlock {
  type: 'audio_player';
  title: string;
  audioUrl?: string;
  dataBase64?: string;
  duration?: number;
  artist?: string;
}

// 24. MIDI & Music Composition Preview
export interface MidiNote {
  pitch: string; // e.g. "C4", "E4", "G4"
  duration: number; // in beats or seconds
  time: number;
}

export interface MidiPreviewBlock extends BaseInteractiveBlock {
  type: 'midi_preview';
  title: string;
  notes: MidiNote[];
  bpm?: number;
  instrument?: string;
}

// 25. Video Storyboard / Scene Sequences
export interface StoryboardScene {
  sceneNumber: number;
  title: string;
  description: string;
  duration?: string;
  visualPrompt?: string;
  imageUrl?: string;
}

export interface StoryboardBlock extends BaseInteractiveBlock {
  type: 'storyboard';
  title: string;
  scenes: StoryboardScene[];
}

// 26. Image Variations Comparison
export interface ImageVariationItem {
  label: string;
  url?: string;
  dataBase64?: string;
  promptAdjustment?: string;
}

export interface ImageVariationBlock extends BaseInteractiveBlock {
  type: 'image_variation';
  title?: string;
  prompt: string;
  variations: ImageVariationItem[];
}

// 27. Code Blocks with Interactive Run / Copy
export interface CodeInteractiveBlock extends BaseInteractiveBlock {
  type: 'code';
  code: string;
  language: string;
  output?: string;
  readOnly?: boolean;
}

// 28. Image and Media Previews
export interface MediaItem {
  url?: string;
  dataBase64?: string;
  title?: string;
  caption?: string;
  kind: 'image' | 'audio' | 'model3d';
}

export interface MediaBlock extends BaseInteractiveBlock {
  type: 'media';
  items: MediaItem[];
}

// 29. Scheduled Task and Automation Card
export interface ScheduledTaskBlock extends BaseInteractiveBlock {
  type: 'scheduled_task';
  task: ScheduledTaskData;
  allowEdit?: boolean;
  history?: ScheduledTaskExecution[];
}

// 32. Universal Artifact Preview Block
export interface ArtifactBlock extends BaseInteractiveBlock {
  type: 'artifact';
  artifactKind: 'website' | 'document' | 'spreadsheet' | 'presentation' | 'code';
  title?: string;
  description?: string;
  content: string;
  fileName?: string;
  language?: string;
  url?: string;
}

// Discriminated union of all interactive blocks
export type InteractiveBlock =
  | McqBlock
  | QuizBlock
  | PollBlock
  | FlashcardBlock
  | MatchingBlock
  | SortingBlock
  | FillBlankBlock
  | DecisionTreeBlock
  | AccordionBlock
  | StepsBlock
  | ChecklistBlock
  | KanbanBlock
  | FormWizardBlock
  | CalculatorBlock
  | DiagramBlock
  | MindMapBlock
  | JsonViewerBlock
  | RegexTesterBlock
  | ApiBuilderBlock
  | ComparisonBlock
  | TableBlock
  | InputControlsBlock
  | ProgressBlock
  | ChartBlock
  | AudioPlayerBlock
  | MidiPreviewBlock
  | StoryboardBlock
  | ImageVariationBlock
  | CodeInteractiveBlock
  | MediaBlock
  | ScheduledTaskBlock
  | ArtifactBlock;
