import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import {
  setInteractiveBlockState,
  getInteractiveBlockState,
  clearAllInteractiveBlockStates,
} from '../components/interactive-blocks/state';
import { McqBlockRenderer } from '../components/interactive-blocks/McqBlockRenderer';
import { QuizBlockRenderer } from '../components/interactive-blocks/QuizBlockRenderer';
import { InteractiveBlockSkeleton } from '../components/interactive-blocks/InteractiveBlockSkeleton';

describe('Ayatrisya Interactive Chat Blocks - Component Rendering & State Suite', () => {
  beforeEach(() => {
    clearAllInteractiveBlockStates();
  });

  // 1. Rendering an MCQ via MarkdownRenderer
  it('renders an interactive MCQ block embedded in markdown content', () => {
    const markdown = `Here is a practice question for you:

\`\`\`interactive
{
  "version": "1.0",
  "type": "mcq",
  "id": "mcq-unit-test",
  "question": "What is the primary role of an API Gateway?",
  "options": [
    { "id": "a", "label": "Direct database query engine" },
    { "id": "b", "label": "Single entry point for request routing and auth" },
    { "id": "c", "label": "CSS styling compiler" }
  ],
  "correctAnswer": "b",
  "explanation": "An API Gateway routes requests, validates auth, and applies rate limits."
}
\`\`\`

Let me know what you think!`;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));
    expect(html).toContain('Here is a practice question for you:');
    expect(html).toContain('What is the primary role of an API Gateway?');
    expect(html).toContain('Single entry point for request routing and auth');
    expect(html).toContain('Submit Answer');
    expect(html).toContain('Let me know what you think!');
  });

  // 2. MCQ Submit and Correctness State Verification
  it('displays correct feedback badge and explanation when submitted', () => {
    const block = {
      version: '1.0' as const,
      type: 'mcq' as const,
      id: 'mcq-feedback-test',
      question: 'Which protocol is secure by default?',
      options: [
        { id: 'http', label: 'HTTP' },
        { id: 'https', label: 'HTTPS' },
      ],
      correctAnswer: 'https',
      explanation: 'HTTPS encrypts communication with TLS.',
    };

    // Simulate user selecting 'https' and submitting
    setInteractiveBlockState('mcq-feedback-test', {
      selectedIds: ['https'],
      submitted: true,
      showHint: false,
    });

    const html = renderToStaticMarkup(
      React.createElement(McqBlockRenderer, { block, blockId: 'mcq-feedback-test' })
    );

    expect(html).toContain('Correct!');
    expect(html).toContain('Explanation:');
    expect(html).toContain('HTTPS encrypts communication with TLS.');
    expect(html).toContain('Try Again');
  });

  // 3. Multi-Question Quiz Progression & Score Calculation
  it('renders a multi-question quiz and summarizes score upon completion', () => {
    const quizBlock = {
      version: '1.0' as const,
      type: 'quiz' as const,
      id: 'quiz-unit-test',
      title: 'Security Knowledge Quiz',
      questions: [
        {
          id: 'q1',
          question: 'What is CSRF?',
          options: [
            { id: 'a', label: 'Cross-Site Request Forgery' },
            { id: 'b', label: 'Cascading Style Reference File' },
          ],
          correctAnswer: 'a',
          explanation: 'CSRF tricks an authenticated browser into sending unauthorized commands.',
        },
        {
          id: 'q2',
          question: 'What does PKCE add to OAuth?',
          options: [
            { id: 'a', label: 'Cryptographic proof of possession' },
            { id: 'b', label: 'Plaintext password transmission' },
          ],
          correctAnswer: 'a',
          explanation: 'PKCE protects against authorization code interception.',
        },
      ],
    };

    // Simulate quiz finished state with both answers correct
    setInteractiveBlockState('quiz-unit-test', {
      currentQuestionIndex: 1,
      answers: { q1: ['a'], q2: ['a'] },
      finished: true,
      showHints: {},
    });

    const html = renderToStaticMarkup(
      React.createElement(QuizBlockRenderer, { block: quizBlock, blockId: 'quiz-unit-test' })
    );

    expect(html).toContain('Quiz Completed');
    expect(html).toContain('2 / 2');
    expect(html).toContain('(100%)');
    expect(html).toContain('Retake Quiz');
  });

  // 4. Checklist Block Rendering
  it('renders an interactive checklist block', () => {
    const markdown = `\`\`\`interactive
{
  "version": "1.0",
  "type": "checklist",
  "title": "Onboarding Steps",
  "items": [
    { "id": "1", "label": "Setup repository clone", "checked": true },
    { "id": "2", "label": "Install pnpm workspace dependencies" }
  ]
}
\`\`\``;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));
    expect(html).toContain('Onboarding Steps');
    expect(html).toContain('Setup repository clone');
    expect(html).toContain('Install pnpm workspace dependencies');
  });

  // 5. Comparison Matrix Block Rendering
  it('renders a comparison block matrix', () => {
    const markdown = `\`\`\`interactive
{
  "version": "1.0",
  "type": "comparison",
  "title": "Database Comparison",
  "entities": ["PostgreSQL", "SQLite"],
  "criteria": [
    {
      "criterion": "Network Server",
      "values": { "PostgreSQL": true, "SQLite": false },
      "winner": "PostgreSQL"
    }
  ]
}
\`\`\``;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));
    expect(html).toContain('Database Comparison');
    expect(html).toContain('PostgreSQL');
    expect(html).toContain('SQLite');
    expect(html).toContain('Network Server');
  });

  // 6. Streaming Skeleton for Incomplete Interactive Blocks
  it('renders loading skeleton when stream is in progress and block is incomplete', () => {
    const partialStream = `Thinking about your quiz...

\`\`\`interactive
{
  "version": "1.0",
  "type": "quiz",
  "title": "Incomplete stream`;

    const html = renderToStaticMarkup(
      React.createElement(MarkdownRenderer, {
        content: partialStream,
        isStreaming: true,
        messageId: 'stream-msg',
      })
    );

    // Should render the streaming skeleton instead of crashing or showing broken JSON
    expect(html).toContain('interactive-skeleton');
    expect(html).toContain('Rendering interactive experience...');
  });

  // 7. Fallback to Ordinary Markdown / CodeBlock on Invalid Payload
  it('falls back gracefully to a standard code block when JSON is invalid and not streaming', () => {
    const invalidBlock = `\`\`\`interactive
{
  "not_valid_json": incomplete
\`\`\``;

    const html = renderToStaticMarkup(
      React.createElement(MarkdownRenderer, { content: invalidBlock, isStreaming: false })
    );

    // Should fall back to the standard CodeBlock component
    expect(html).toContain('chat-code');
    expect(html).toContain('INTERACTIVE');
    expect(html).toContain('not_valid_json');
  });

  // 8. State Isolation Between Different Blocks
  it('ensures separate block states are completely isolated', () => {
    setInteractiveBlockState('block-1', { value: 'first' });
    setInteractiveBlockState('block-2', { value: 'second' });

    expect(getInteractiveBlockState('block-1', { value: '' })).toEqual({ value: 'first' });
    expect(getInteractiveBlockState('block-2', { value: '' })).toEqual({ value: 'second' });
  });
});
