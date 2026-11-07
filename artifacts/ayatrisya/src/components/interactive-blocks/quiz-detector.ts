import { z } from 'zod';
import type { QuizBlock, McqBlock, InteractiveBlock } from './types';
import { interactiveBlockSchema } from './schema';
import type { AssessmentBlockData, AssessmentQuestion } from './assessment/assessment-types';

export interface DetectedInteractiveContent {
  beforeText: string;
  block: InteractiveBlock;
  afterText: string;
}

/**
 * Checks whether text contains structured MCQ, Assertion-Reason, Match-Following,
 * or Quiz/Assessment content and parses it into a typed, validated InteractiveBlock.
 */
export function detectMarkdownQuizOrMcq(rawText: string): DetectedInteractiveContent | null {
  if (!rawText || rawText.includes('```interactive') || rawText.includes('```assessment')) {
    return null;
  }

  // 1. Detect Assertion-Reason Question patterns
  // Assertion (A): ... Reason (R): ...
  const arPattern = /(?:^|\n)(?:(?:###\s*)?(?:Question\s*)?(\d+)[.:]\s*|\*\*Question\s*(\d+):?\*\*\s*)?(?:Assertion\s*(?:\(A\))?:?\s*([^\n]+))\n(?:Reason\s*(?:\(R\))?:?\s*([^\n]+))\n((?:[ \t]*(?:[-*]\s*)?[A-Da-d][).]\s+[^\n]+\n?){2,4})(?:[ \t]*(?:\*\*|__)?(?:Answer|Correct Answer|Ans)(?:\*\*|__)?:\s*([A-Da-d])\b[^\n]*)?(?:\n[ \t]*(?:\*\*|__)?Explanation(?:\*\*|__)?:\s*([^\n]+))?/gi;

  const arMatches: Array<{
    fullMatch: string;
    index: number;
    assertion: string;
    reason: string;
    optionsRaw: string;
    correctLetter?: string;
    explanation?: string;
  }> = [];

  let arMatch: RegExpExecArray | null;
  while ((arMatch = arPattern.exec(rawText)) !== null) {
    const assertion = (arMatch[3] || '').trim();
    const reason = (arMatch[4] || '').trim();
    const optionsRaw = (arMatch[5] || '').trim();
    const correctLetter = arMatch[6]?.toLowerCase();
    const explanation = arMatch[7]?.trim();

    if (assertion && reason) {
      arMatches.push({
        fullMatch: arMatch[0],
        index: arMatch.index,
        assertion,
        reason,
        optionsRaw,
        correctLetter,
        explanation,
      });
    }
  }

  // 2. Standard MCQ & Practice Question pattern
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

  if (matches.length === 0 && arMatches.length === 0) {
    return null;
  }

  // Parse questions list
  const allParsedQuestions: AssessmentQuestion[] = [];

  // Parse standard questions
  matches.forEach((m, qIndex) => {
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

    // Detect PYQ tags like [CBSE 2023], [NEET 2022], [JEE Main 2024]
    const pyqMatch = /\[(CBSE|NEET|JEE|UPSC|ICSE|BOARDS)\s*([0-9]{4})?\]/i.exec(m.questionText);
    const isPyq = Boolean(pyqMatch);
    const pyqSource = pyqMatch ? pyqMatch[0].replace(/[\[\]]/g, '') : undefined;
    const cleanQuestionText = m.questionText.replace(/\[(CBSE|NEET|JEE|UPSC|ICSE|BOARDS)[^\]]*\]/gi, '').trim();

    // Detect topic from question text or headers
    let topic: string | undefined;
    const topicMatch = /(?:Topic|Unit|Chapter):\s*([^,\n.]+)/i.exec(m.questionText);
    if (topicMatch) {
      topic = topicMatch[1].trim();
    }

    if (options.length >= 2) {
      allParsedQuestions.push({
        id: `q${qIndex + 1}`,
        type: 'single_choice',
        question: cleanQuestionText,
        options,
        correctAnswer: finalCorrect,
        explanation: m.explanation || undefined,
        topic,
        isPyq,
        pyqSource,
      });
    }
  });

  // Parse Assertion-Reason questions
  arMatches.forEach((m, arIdx) => {
    const qIndex = allParsedQuestions.length + 1;
    const optLines = m.optionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
    const options: Array<{ id: string; label: string }> = [];

    for (const line of optLines) {
      const optMatch = /^[-*]?\s*([A-Da-d])[).]\s+(.+)$/.exec(line);
      if (optMatch) {
        const id = optMatch[1].toLowerCase();
        const label = optMatch[2].trim();
        if (id && label) {
          options.push({ id, label });
        }
      }
    }

    allParsedQuestions.push({
      id: `ar${qIndex}`,
      type: 'assertion_reason',
      question: `Assertion (A): ${m.assertion}`,
      assertion: m.assertion,
      reason: m.reason,
      options: options.length >= 2 ? options : undefined,
      correctAnswer: m.correctLetter || 'a',
      explanation: m.explanation || undefined,
      topic: 'Assertion & Reasoning',
    });
  });

  if (allParsedQuestions.length === 0) {
    return null;
  }

  // Determine span of interactive block in raw text
  const allMatchIndices = [
    ...matches.map((m) => ({ start: m.index, end: m.index + m.fullMatch.length })),
    ...arMatches.map((m) => ({ start: m.index, end: m.index + m.fullMatch.length })),
  ].sort((a, b) => a.start - b.start);

  const firstIndex = allMatchIndices[0].start;
  const lastIndex = allMatchIndices[allMatchIndices.length - 1].end;

  const beforeText = rawText.slice(0, firstIndex).trim();
  const afterText = rawText.slice(lastIndex).trim();

  // Extract metadata from beforeText (e.g. title, duration, exam mode)
  let title = 'Interactive Assessment';
  let timeLimitMinutes = Math.max(5, allParsedQuestions.length * 2);
  let mode: 'practice' | 'exam' = 'practice';

  if (beforeText) {
    const titleMatch = /(?:assessment on|quiz on|quiz for|test on|examination|mock test|practice set|class \d+ [^\n]+)\b[^\n]*/i.exec(beforeText);
    if (titleMatch) {
      title = titleMatch[0].trim().replace(/^#+\s*/, '');
    }

    const timeMatch = /(?:time(?:\s+allowed|\s+limit)?|duration):\s*(\d+)\s*(?:mins?|minutes)/i.exec(beforeText);
    if (timeMatch) {
      timeLimitMinutes = parseInt(timeMatch[1], 10);
    }

    if (/exam mode|mock test|timed test|strict exam/i.test(beforeText)) {
      mode = 'exam';
    }
  }

  let blockPayload: unknown;

  if (allParsedQuestions.length === 1 && allParsedQuestions[0].type === 'single_choice') {
    const q = allParsedQuestions[0];
    blockPayload = {
      version: '1.0',
      type: 'mcq',
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    };
  } else {
    // Multi-question Assessment / Quiz
    blockPayload = {
      version: '1.0',
      type: 'quiz',
      title: title.slice(0, 100),
      description: `${allParsedQuestions.length} Questions · ${timeLimitMinutes} Mins · ${mode.toUpperCase()} Mode`,
      questions: allParsedQuestions,
      mode,
      timeLimitMinutes,
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
