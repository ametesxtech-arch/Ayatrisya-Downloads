import { z } from 'zod';
import type { QuizBlock, McqBlock, InteractiveBlock } from './types';
import { interactiveBlockSchema } from './schema';

export interface DetectedInteractiveContent {
  beforeText: string;
  block: InteractiveBlock;
  afterText: string;
}

/**
 * Checks whether text contains structured MCQ/Quiz content and parses it
 * into a typed, validated InteractiveBlock.
 *
 * Avoids false positives on regular numbered lists: questions MUST have
 * distinct options (A, B, C, D) and option text.
 */
export function detectMarkdownQuizOrMcq(rawText: string): DetectedInteractiveContent | null {
  if (!rawText || rawText.includes('```interactive')) {
    return null;
  }

  // Regex to detect questions:
  // Starts with "1. " or "Question 1:" or "Q1." followed by question text
  // followed by A), B), C), D) options
  const questionPattern = /(?:^|\n)(?:(?:###\s*)?(?:Question\s*)?(\d+)[.:]\s*|\*\*Question\s*(\d+):?\*\*\s*)([^\n]+)\n((?:[ \t]*(?:[-*]\s*)?[A-Ea-e][).]\s+[^\n]+\n?){2,6})(?:[ \t]*(?:\*\*|__)?(?:Answer|Correct Answer|Ans)(?:\*\*|__)?:\s*([A-Ea-e])\b[^\n]*)?(?:\n[ \t]*(?:\*\*|__)?Explanation(?:\*\*|__)?:\s*([^\n]+))?/gi;

  const matches: Array<{
    fullMatch: string;
    index: number;
    questionText: string;
    optionsRaw: string;
    correctLetter?: string;
    explanation?: string;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = questionPattern.exec(rawText)) !== null) {
    const qText = (match[3] || '').trim();
    const optsRaw = (match[4] || '').trim();
    const correctLetter = match[5]?.toLowerCase();
    const explanation = match[6]?.trim();

    if (qText && optsRaw) {
      matches.push({
        fullMatch: match[0],
        index: match.index,
        questionText: qText,
        optionsRaw: optsRaw,
        correctLetter,
        explanation,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Parse options for each question
  const parsedQuestions = matches.map((m, qIndex) => {
    const optLines = m.optionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
    const options: Array<{ id: string; label: string }> = [];

    for (const line of optLines) {
      const optMatch = /^[-*]?\s*([A-Ea-e])[).]\s+(.+)$/.exec(line);
      if (optMatch) {
        const id = optMatch[1].toLowerCase();
        const label = optMatch[2].trim();
        if (id && label) {
          options.push({ id, label });
        }
      }
    }

    const defaultCorrect = options[0]?.id || 'a';
    const finalCorrect = m.correctLetter && options.some((o) => o.id === m.correctLetter)
      ? m.correctLetter
      : defaultCorrect;

    return {
      id: `q${qIndex + 1}`,
      question: m.questionText,
      options,
      correctAnswer: finalCorrect,
      explanation: m.explanation || undefined,
    };
  });

  // Verify all questions have at least 2 valid options
  if (parsedQuestions.some((q) => q.options.length < 2)) {
    return null;
  }

  const firstIndex = matches[0].index;
  const lastMatch = matches[matches.length - 1];
  const lastIndex = lastMatch.index + lastMatch.fullMatch.length;

  const beforeText = rawText.slice(0, firstIndex).trim();
  const afterText = rawText.slice(lastIndex).trim();

  let blockPayload: unknown;

  if (parsedQuestions.length === 1) {
    // Single question -> McqBlock
    const q = parsedQuestions[0];
    blockPayload = {
      version: '1.0',
      type: 'mcq',
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    };
  } else {
    // Multiple questions -> QuizBlock
    // Extract potential title from beforeText or use sensible default
    let title = 'Interactive Quiz';
    if (beforeText) {
      const titleMatch = /(?:quiz on|quiz for|test on|class \d+ [^\n]+)\b[^\n]*/i.exec(beforeText);
      if (titleMatch) {
        title = titleMatch[0].trim().replace(/^#+\s*/, '');
      }
    }

    blockPayload = {
      version: '1.0',
      type: 'quiz',
      title: title.slice(0, 100),
      questions: parsedQuestions,
      allowRetry: true,
      passingScore: 70,
    };
  }

  const validation = interactiveBlockSchema.safeParse(blockPayload);
  if (!validation.success) {
    return null;
  }

  return {
    beforeText,
    block: validation.data as InteractiveBlock,
    afterText,
  };
}
