export type DocumentNodeType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'blockquote'
  | 'callout'
  | 'metric'
  | 'timeline'
  | 'pageBreak'
  | 'citation';

export interface HeadingNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
}

export interface ParagraphNode {
  type: 'paragraph';
  text: string;
}

export interface ListItem {
  text: string;
  checked?: boolean;
  subItems?: string[];
}

export interface ListNode {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface TableNode {
  type: 'table';
  headers: string[];
  rows: string[][];
  align?: ('left' | 'center' | 'right')[];
  caption?: string;
}

export interface CodeNode {
  type: 'code';
  code: string;
  language?: string;
  caption?: string;
}

export interface BlockquoteNode {
  type: 'blockquote';
  text: string;
  citation?: string;
}

export interface CalloutNode {
  type: 'callout';
  variant: 'info' | 'warning' | 'tip' | 'note';
  title: string;
  text: string;
}

export interface MetricNode {
  type: 'metric';
  value: string;
  label: string;
  change?: string;
  description?: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

export interface TimelineNode {
  type: 'timeline';
  events: TimelineEvent[];
}

export interface PageBreakNode {
  type: 'pageBreak';
}

export interface CitationNode {
  type: 'citation';
  id: string;
  text: string;
  url?: string;
}

export type DocumentNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | TableNode
  | CodeNode
  | BlockquoteNode
  | CalloutNode
  | MetricNode
  | TimelineNode
  | PageBreakNode
  | CitationNode;

export interface TocEntry {
  id: string;
  level: number;
  text: string;
}

export type DocumentTemplate =
  | 'report'
  | 'research'
  | 'proposal'
  | 'notes'
  | 'executive';

export interface DocumentMetadata {
  author?: string;
  date?: string;
  version?: string;
  abstract?: string;
  tags?: string[];
  classification?: string;
}

export interface DocumentAst {
  version: 2;
  title: string;
  subtitle?: string;
  template: DocumentTemplate;
  includeToc: boolean;
  metadata: DocumentMetadata;
  nodes: DocumentNode[];
  tocEntries: TocEntry[];
}
