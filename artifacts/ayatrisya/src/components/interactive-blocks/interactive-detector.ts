import type { InteractiveBlock, TableBlock, ChartBlock } from './types';
import { interactiveBlockSchema } from './schema';
import { detectMarkdownQuizOrMcq, type DetectedInteractiveContent } from './quiz-detector';

export type { DetectedInteractiveContent };

/**
 * Parses markdown pipe tables into structured TableBlock if valid.
 */
export function detectMarkdownTable(rawText: string): DetectedInteractiveContent | null {
  if (!rawText || rawText.includes('```interactive') || rawText.includes('```table')) {
    return null;
  }

  // Regex to match a markdown table:
  // | Header 1 | Header 2 |
  // | -------- | -------- |
  // | Cell 1   | Cell 2   |
  const tableRegex = /(?:^|\n)((?:\|[^\n]+\|\r?\n)\|[ \t]*[-:]+[-| :]*\r?\n(?:\|[^\n]+\|\r?\n?)+)/m;
  const match = tableRegex.exec(rawText);
  if (!match) return null;

  const fullMatch = match[1];
  const tableStartIndex = match.index + (match[0].length - fullMatch.length);
  const tableEndIndex = tableStartIndex + fullMatch.length;

  const lines = fullMatch.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // Header line
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .slice(1, -1)
    .map((h) => h.trim());

  if (headers.length < 2) return null;

  // Row lines (skip separator at index 1)
  const rows: Array<Array<string | number | boolean>> = [];
  for (let i = 2; i < lines.length; i++) {
    const rowCells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => {
        const val = c.trim();
        if (/^-?\d+(\.\d+)?$/.test(val)) return parseFloat(val);
        if (/^(true|yes|✓)$/i.test(val)) return true;
        if (/^(false|no|✗|x)$/i.test(val)) return false;
        return val;
      });

    // Pad or trim to match headers length
    while (rowCells.length < headers.length) rowCells.push('');
    rows.push(rowCells.slice(0, headers.length));
  }

  if (rows.length === 0) return null;

  const beforeText = rawText.slice(0, tableStartIndex).trim();
  const afterText = rawText.slice(tableEndIndex).trim();

  // Try extracting a title from the line immediately before the table
  let title = 'Comparison Table';
  const beforeLines = beforeText.split(/\r?\n/);
  const lastBeforeLine = beforeLines[beforeLines.length - 1]?.trim();
  if (lastBeforeLine && /^#{1,4}\s+/.test(lastBeforeLine)) {
    title = lastBeforeLine.replace(/^#{1,4}\s+/, '').trim();
  }

  const tableBlock: TableBlock = {
    version: '1.0',
    type: 'table',
    title: title.slice(0, 100),
    headers,
    rows,
    sortable: true,
    filterable: rows.length >= 3,
  };

  const validation = interactiveBlockSchema.safeParse(tableBlock);
  if (!validation.success) return null;

  return {
    beforeText,
    block: validation.data as InteractiveBlock,
    afterText,
  };
}

/**
 * Universal interactive content detector that checks for:
 * 1. Quizzes and MCQs
 * 2. Markdown comparison tables
 */
export function detectUniversalInteractiveContent(rawText: string): DetectedInteractiveContent | null {
  // 1. Quizzes take priority
  const quiz = detectMarkdownQuizOrMcq(rawText);
  if (quiz) return quiz;

  // 2. Data tables
  const table = detectMarkdownTable(rawText);
  if (table) return table;

  return null;
}

