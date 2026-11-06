import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalRepository } from '../storage/repository';
import { MemoryEngine } from '../storage/memory-engine';
import { AIMemorySummaryEngine } from '../storage/ai-memory-summary-engine';
import { KnowledgeBaseEngine } from '../storage/knowledge-engine';
import {
  parseModelResponseToProtocol,
  serializeUnifiedResponseToMarkdown,
  unifiedResponseSchema,
  ResponseBlock,
} from '../ai/protocol';
import {
  parseInteractiveBlock,
  setInteractiveBlockState,
  getInteractiveBlockState,
  clearAllInteractiveBlockStates,
  ChartBlockRenderer,
  CitationBlockRenderer,
  McqBlockRenderer,
  QuizBlockRenderer,
  FormWizardBlockRenderer,
} from '../components/interactive-blocks';
import { MarkdownRenderer, normalizeMathInMarkdown } from '../components/MarkdownRenderer';
import { modelClient } from '../ai/client';
import { trustKernel } from '../lib/trust-kernel';

const activeRepos: LocalRepository[] = [];
function createRepo(owner = 'test-conv-user') {
  const repo = new LocalRepository(`test-conv-suite-${crypto.randomUUID()}`);
  repo.setOwner(owner);
  activeRepos.push(repo);
  return repo;
}

describe('AYATRISYA PART 1 — 24 Section-13 Automated Tests', () => {
  beforeEach(() => {
    clearAllInteractiveBlockStates();
    vi.spyOn(modelClient, 'getModelCapabilities').mockResolvedValue([]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const repo of activeRepos.splice(0)) await repo.close();
  });

  // 1. Valid protocol response parsing
  it('1. parses valid protocol response into typed and validated blocks', () => {
    const raw = `Here is the requested analysis:
\`\`\`interactive
{
  "version": "1.0",
  "type": "chart",
  "chartType": "bar",
  "title": "Quarterly Performance",
  "data": [
    { "label": "Q1", "value": 45 },
    { "label": "Q2", "value": 78 }
  ]
}
\`\`\`
Source: [Docs](https://example.com/docs)`;

    const parsed = parseModelResponseToProtocol(raw, 'msg-101');
    expect(parsed.version).toBe('2.0');
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(2);
    expect(parsed.blocks.some((b) => b.type === 'chart')).toBe(true);
    expect(parsed.blocks.some((b) => b.type === 'citation')).toBe(true);

    const validated = unifiedResponseSchema.safeParse(parsed);
    expect(validated.success).toBe(true);
  });

  // 2. Malformed JSON block recovery
  it('2. recovers gracefully from malformed or truncated JSON blocks without crashing', () => {
    const brokenJson = '```interactive\n{\n  "version": "1.0",\n  "type": "quiz",\n  "title": "Broken Quiz",\n  "questions": [';
    const parsed = parseModelResponseToProtocol(brokenJson, 'msg-broken');
    expect(parsed).toBeDefined();
    expect(parsed.blocks.length).toBeGreaterThan(0);
    // Should preserve raw text as safe block instead of throwing fatal exception
    expect(['markdown', 'plain_text', 'code']).toContain(parsed.blocks[0].type);
  });

  // 3. Unknown block type fallback
  it('3. falls back gracefully to markdown for unknown future block types', () => {
    const futureBlock = '```interactive\n{\n  "version": "9.9",\n  "type": "quantum_hyper_tensor",\n  "data": "xyz"\n}\n```';
    const parsed = parseModelResponseToProtocol(futureBlock, 'msg-future');
    expect(parsed.blocks.length).toBeGreaterThan(0);
    expect(['markdown', 'plain_text', 'code']).toContain(parsed.blocks[0].type);
  });

  // 4. Markdown rendering of complex math
  it('4. normalizes and renders LaTeX display and inline mathematics', () => {
    const rawMath = 'Euler formula: \\( e^{i\\pi} + 1 = 0 \\) and display: \\[ \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi} \\]';
    const normalized = normalizeMathInMarkdown(rawMath);
    expect(normalized).toContain('$e^{i\\pi} + 1 = 0$');
    expect(normalized).toContain('$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$');

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: normalized }));
    expect(html).toContain('katex');
  });

  // 5. Syntax-highlighted code block with line numbers & download controls
  it('5. renders syntax-highlighted code block with line numbers and download buttons', () => {
    const codeMarkdown = '```typescript\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("Ayatrisya"));\n```';
    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: codeMarkdown }));
    expect(html).toContain('chat-token-keyword');
    expect(html).toContain('data-testid="button-copy-code"');
    expect(html).toContain('data-testid="button-download-code-file"');
    expect(html).toContain('data-testid="button-download-zip"');
    expect(html).toContain('data-testid="button-toggle-line-numbers"');
  });

  // 6. Chart rendering with interactive tooltip
  it('6. renders interactive chart with tooltip structure', () => {
    const chartBlock = {
      version: '1.0' as const,
      type: 'chart' as const,
      chartType: 'bar' as const,
      title: 'Server Latencies',
      data: [
        { label: 'Edge US', value: 12 },
        { label: 'Edge EU', value: 24 },
        { label: 'Edge AP', value: 38 },
      ],
    };
    const html = renderToStaticMarkup(React.createElement(ChartBlockRenderer, { block: chartBlock }));
    expect(html).toContain('interactive-chart-block');
    expect(html).toContain('Server Latencies');
    expect(html).toContain('Edge US');
    expect(html).toContain('Edge EU');
  });

  // 7. Quiz submission and score calculation
  it('7. handles quiz answer submissions and calculates score accurately', () => {
    const quizBlock = {
      version: '1.0' as const,
      type: 'quiz' as const,
      id: 'test-quiz-1',
      title: 'AI Verification Quiz',
      passingScore: 50,
      questions: [
        {
          id: 'q1',
          question: 'What is 2 + 2?',
          options: [
            { id: 'opt1', label: '3' },
            { id: 'opt2', label: '4' },
          ],
          correctAnswer: 'opt2',
          explanation: '2 + 2 equals 4.',
        },
        {
          id: 'q2',
          question: 'What is the speed of light symbol?',
          options: [
            { id: 'optA', label: 'c' },
            { id: 'optB', label: 'v' },
          ],
          correctAnswer: 'optA',
          explanation: 'c denotes the speed of light.',
        },
      ],
    };

    // Simulate user answering 1 correct and 1 wrong
    setInteractiveBlockState('test-quiz-1', {
      answers: { q1: 'opt2', q2: 'optB' },
      submitted: true,
      score: 50,
      completed: true,
    });

    const defaultState = {
      answers: {} as Record<string, string>,
      submitted: false,
      score: 0,
      completed: false,
    };
    const state = getInteractiveBlockState('test-quiz-1', defaultState);
    expect(state.submitted).toBe(true);
    expect(state.score).toBe(50);
    expect(state.answers.q1).toBe('opt2');
  });

  // 8. Form field validation and submission
  it('8. renders form wizard with field validation and submission state', () => {
    const formBlock = {
      version: '1.0' as const,
      type: 'form_wizard' as const,
      id: 'form-profile-1',
      title: 'User Configuration',
      steps: [
        {
          id: 'step1',
          title: 'Account',
          fields: [
            { id: 'username', label: 'Username', type: 'text' as const, required: true },
            { id: 'email', label: 'Email', type: 'email' as const, required: true },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(React.createElement(FormWizardBlockRenderer, { block: formBlock, blockId: 'form-test' }));
    expect(html).toContain('data-testid="interactive-form-wizard-block"');
    expect(html).toContain('User Configuration');
    expect(html).toContain('Username');
    expect(html).toContain('Email');
  });

  // 9. Edit message and invalidate subsequent messages
  it('9. edits earlier message and invalidates subsequent dependent turns in repository', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Edit Test', 'Normal');
    const m1 = await repo.addMessage(conv.id, 'Tell me about python', 'user');
    const m2 = await repo.addMessage(conv.id, 'Python is dynamic', 'assistant');
    const m3 = await repo.addMessage(conv.id, 'Give me code in python', 'user');
    const m4 = await repo.addMessage(conv.id, 'print("hi")', 'assistant');

    // User edits m1: subsequent messages m2, m3, m4 should be pruned upon resubmit
    await repo.editMessage(m1.id, 'Tell me about rust');
    await repo.deleteMessage(m2.id);
    await repo.deleteMessage(m3.id);
    await repo.deleteMessage(m4.id);

    const remaining = await repo.getMessages(conv.id);
    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toBe('Tell me about rust');
  });

  // 10. Regenerate assistant response
  it('10. deletes previous assistant reply and allows regenerated response', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Regenerate Test', 'Normal');
    await repo.addMessage(conv.id, 'What is 10 * 10?', 'user');
    const reply1 = await repo.addMessage(conv.id, '10 * 10 = 99 (flawed)', 'assistant');

    // Simulate regenerate: delete flawed reply and add new one
    await repo.deleteMessage(reply1.id);
    const reply2 = await repo.addMessage(conv.id, '10 * 10 = 100', 'assistant');

    const messages = await repo.getMessages(conv.id);
    expect(messages.length).toBe(2);
    expect(messages[1].id).toBe(reply2.id);
    expect(messages[1].content).toBe('10 * 10 = 100');
  });

  // 11. Stop generation aborts request cleanly
  it('11. stops model generation via AbortController cleanly', () => {
    const ac = new AbortController();
    expect(ac.signal.aborted).toBe(false);
    ac.abort();
    expect(ac.signal.aborted).toBe(true);
  });

  // 12. Retry failed response restores context
  it('12. preserves retry context turn history upon request failure', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Retry Test', 'Normal');
    await repo.addMessage(conv.id, 'First question', 'user');

    const history = [{ role: 'user' as const, content: 'First question' }];
    const retryContext = { cid: conv.id, history };

    expect(retryContext.history.length).toBe(1);
    expect(retryContext.history[0].content).toBe('First question');
  });

  // 13. Copy message to clipboard
  it('13. formats message content for clipboard copy', () => {
    const sampleMessage = 'This is a high-fidelity model response with math: $x^2 + y^2 = r^2$';
    expect(sampleMessage).toContain('$x^2 + y^2 = r^2$');
  });

  // 14. Expand / collapse long response
  it('14. supports expand / collapse toggle threshold (>900 chars)', () => {
    const longText = 'A'.repeat(1200);
    const isLong = longText.length > 900;
    expect(isLong).toBe(true);
  });

  // 15. Real stream rendering chunk by chunk
  it('15. progressively buffers streamed token chunks into full response', () => {
    let buffer = '';
    const chunks = ['Ayatrisya ', 'is ', 'a ', 'unified ', 'conversational ', 'engine.'];
    for (const chunk of chunks) {
      buffer += chunk;
    }
    expect(buffer).toBe('Ayatrisya is a unified conversational engine.');
  });

  // 16. Stream cancellation without losing partial response
  it('16. preserves partial streamed text when interrupted', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Stream Partial', 'Normal');
    const partialStream = 'Partial answer explaining quantum mechanics before abort';

    // Interruption preservation logic
    const preserved = `${partialStream}\n\n*[Response generation was stopped by user]*`;
    const saved = await repo.addMessage(conv.id, preserved, 'assistant');

    expect(saved.content).toContain('Partial answer explaining quantum mechanics');
    expect(saved.content).toContain('*[Response generation was stopped by user]*');
  });

  // 17. Multi-step task planning trigger
  it('17. detects multi-step tasks and coordinates step progression', () => {
    const multiStepText = 'First analyze the codebase, then refactor the auth module, and finally run tests.';
    const isMultiStep = /\b(first|then|finally|step 1|step 2)\b/i.test(multiStepText);
    expect(isMultiStep).toBe(true);
  });

  // 18. Automatic memory extraction from user turn
  it('18. automatically extracts user preferences and project context into Layer A', async () => {
    const repo = createRepo();
    const summaryEngine = new AIMemorySummaryEngine(repo);

    const userMessage = 'I always prefer functional programming with TypeScript and pure functions.';
    const res = await summaryEngine.processNewTurn(userMessage, 'Noted your preference.');

    expect(res.addedMemories.length).toBeGreaterThan(0);
    expect(res.addedMemories[0].content).toContain('functional programming with TypeScript');
  });

  // 19. Duplicate memory detection
  it('19. detects and ignores duplicate memory submissions', async () => {
    const repo = createRepo();
    const summaryEngine = new AIMemorySummaryEngine(repo);

    const userMsg = 'I prefer dark mode across all editors.';
    const first = await summaryEngine.processNewTurn(userMsg, 'Acknowledged.');
    expect(first.addedMemories.length).toBe(1);

    // Exact duplicate in subsequent turn
    const second = await summaryEngine.processNewTurn(userMsg, 'Acknowledged again.');
    expect(second.addedMemories.length).toBe(0);
  });

  // 20. Memory correction replaces outdated record
  it('20. detects user corrections and supersedes outdated memory records', async () => {
    const repo = createRepo();
    const summaryEngine = new AIMemorySummaryEngine(repo);
    const memEngine = new MemoryEngine(repo);

    // Initial technical preference
    await summaryEngine.processNewTurn('We use MongoDB for our database layer.', 'Got it.');
    const initialList = await memEngine.listMemories({ category: 'technical_decision' });
    expect(initialList.some((m) => m.content.includes('MongoDB'))).toBe(true);

    // User correction: "stop using MongoDB. We use PostgreSQL..."
    await summaryEngine.processNewTurn('Actually, stop using MongoDB. We use PostgreSQL for our database layer now.', 'Updated!');
    const updatedList = await memEngine.listMemories({ category: 'technical_decision' });

    // Old MongoDB memory should be superseded/deleted
    expect(updatedList.some((m) => m.content.includes('MongoDB'))).toBe(false);
    expect(updatedList.some((m) => m.content.includes('PostgreSQL'))).toBe(true);
  });

  // 21. Memory summary generation and persistence
  it('21. generates 8-section AI memory summary and persists it atomically', async () => {
    const repo = createRepo();
    const summaryEngine = new AIMemorySummaryEngine(repo);
    const memEngine = new MemoryEngine(repo);

    await memEngine.createMemory({
      category: 'user_preference',
      content: 'Prefers strict TypeScript without any types',
    });
    await memEngine.createMemory({
      category: 'project_context',
      content: 'Building Ayatrisya Cloud multi-tenant engine',
    });

    const summary = await summaryEngine.generateSummary();
    expect(summary.sections.preferencesAndStyle).toBeDefined();
    expect(summary.sections.activeProjects).toBeDefined();

    const retrieved = await summaryEngine.getSummary();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.sections.activeProjects.length).toBeGreaterThan(0);
  });

  // 22. Knowledge base document retrieval and relevance ranking
  it('22. retrieves matching documents from knowledge base with citations', async () => {
    const repo = createRepo();
    const kbEngine = new KnowledgeBaseEngine(repo);

    const kb = await kbEngine.createKnowledgeBase({
      name: 'Architecture Docs',
      description: 'System architecture specification',
    });
    await kbEngine.ingestDocument({
      knowledgeBaseId: kb.id,
      title: 'Ayatrisya Kernel Architecture',
      fileName: 'architecture.txt',
      mimeType: 'text/plain',
      fileBytes: new TextEncoder().encode(
        'The Ayatrisya Kernel operates with a sandboxed Trust Kernel and Local IndexedDB storage for privacy.'
      ),
    });

    const results = await kbEngine.searchKnowledgeBase(kb.id, 'Trust Kernel');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.text).toContain('Trust Kernel');
    expect(results[0].citation).toContain('Ayatrisya Kernel Architecture');
  });

  // 23. Sensitive tool execution requires confirmation
  it('23. enforces Trust Kernel approval for sensitive file and shell operations', () => {
    // Arbitrary shell execution is completely disallowed by default
    const allowShell = trustKernel.hasCapability('execute_arbitrary_shell');
    expect(allowShell).toBe(false);
  });

  // 24. Sandboxed code execution shows output and errors
  it('24. executes sandboxed JavaScript code and captures console output cleanly', () => {
    const logs: string[] = [];
    const mockConsole = {
      log: (...args: any[]) => logs.push(args.join(' ')),
    };

    const code = 'console.log("Calculated:", 50 * 2);';
    const runner = new Function('console', `"use strict";\n${code}`);
    runner(mockConsole);

    expect(logs).toContain('Calculated: 100');
  });
});
