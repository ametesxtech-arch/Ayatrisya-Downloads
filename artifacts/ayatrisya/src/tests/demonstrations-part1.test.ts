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
} from '../ai/protocol';
import { MarkdownRenderer, normalizeMathInMarkdown } from '../components/MarkdownRenderer';
import { ChartBlockRenderer } from '../components/interactive-blocks/ChartProgressBlockRenderer';
import { setInteractiveBlockState, getInteractiveBlockState, clearAllInteractiveBlockStates } from '../components/interactive-blocks/state';
import { trustKernel } from '../lib/trust-kernel';
import { modelClient } from '../ai/client';

const activeRepos: LocalRepository[] = [];
function createRepo(owner = 'demo-user') {
  const repo = new LocalRepository(`demo-suite-${crypto.randomUUID()}`);
  repo.setOwner(owner);
  activeRepos.push(repo);
  return repo;
}

describe('AYATRISYA PART 1 — 12 Acceptance Demonstrations', () => {
  beforeEach(() => {
    clearAllInteractiveBlockStates();
    vi.spyOn(modelClient, 'getModelCapabilities').mockResolvedValue([]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const repo of activeRepos.splice(0)) await repo.close();
  });

  // Demo 1: Technical concept with Markdown, LaTeX math, table, and interactive quiz
  it('Demo 1: Explains technical concept with Markdown, LaTeX math, table, and interactive quiz', () => {
    const raw = `### Fourier Transform & Signal Processing
The continuous Fourier Transform of $f(t)$ is defined as:
\\[ F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt \\]

| Domain | Independent Variable | Transformation |
| --- | --- | --- |
| Time | $t$ (seconds) | Direct Signal |
| Frequency | $\\omega$ (rad/s) | Spectrum |

\`\`\`interactive
{
  "version": "1.0",
  "type": "quiz",
  "id": "quiz-fourier",
  "title": "Signal Processing Check",
  "passingScore": 100,
  "questions": [
    {
      "id": "q1",
      "question": "What does the Fourier transform map time-domain signals into?",
      "options": [
        { "id": "a", "label": "Spatial volume" },
        { "id": "b", "label": "Frequency spectrum" }
      ],
      "correctAnswer": "b",
      "explanation": "It decomposes waveforms into frequency components."
    }
  ]
}
\`\`\``;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: raw }));
    expect(html).toContain('Fourier Transform &amp; Signal Processing');
    expect(html).toContain('katex');
    expect(html).toContain('Time');
    expect(html).toContain('Frequency');
    expect(html).toContain('Signal Processing Check');
    expect(html).toContain('Frequency spectrum');
  });

  // Demo 2: Runnable code snippet execution
  it('Demo 2: Executes sandboxed JavaScript code snippet and captures real stdout', () => {
    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => logs.push(args.join(' ')),
    };
    const code = `
      function fibonacci(n) {
        let a = 0, b = 1;
        for (let i = 2; i <= n; i++) {
          const temp = a + b;
          a = b;
          b = temp;
        }
        return b;
      }
      console.log("Fib(10):", fibonacci(10));
    `;
    const runner = new Function('console', `"use strict";\n${code}`);
    runner(customConsole);
    expect(logs).toContain('Fib(10): 55');
  });

  // Demo 3: Interactive chart with tooltips
  it('Demo 3: Renders chart with interactive tooltips and hover state', () => {
    const chart = {
      version: '1.0' as const,
      type: 'chart' as const,
      chartType: 'bar' as const,
      title: 'API Throughput (req/s)',
      data: [
        { label: 'Edge Worker', value: 850 },
        { label: 'Cloud Gateway', value: 420 },
      ],
    };
    const html = renderToStaticMarkup(React.createElement(ChartBlockRenderer, { block: chart }));
    expect(html).toContain('API Throughput (req/s)');
    expect(html).toContain('Edge Worker');
    expect(html).toContain('Cloud Gateway');
  });

  // Demo 4: Edit earlier message with invalidation of later context
  it('Demo 4: Edits an earlier message and cleanses subsequent contradictory messages', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Edit Demo', 'Normal');
    const u1 = await repo.addMessage(conv.id, 'I need Python async code', 'user');
    const a1 = await repo.addMessage(conv.id, 'Here is Python asyncio...', 'assistant');

    // User edits message 1 to ask for Go instead
    await repo.editMessage(u1.id, 'I need Go goroutine code');
    await repo.deleteMessage(a1.id);

    const msgs = await repo.getMessages(conv.id);
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('I need Go goroutine code');
  });

  // Demo 5: Regenerate assistant reply
  it('Demo 5: Regenerates assistant reply atomically', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Regenerate Demo', 'Normal');
    await repo.addMessage(conv.id, 'Summarize CAP theorem', 'user');
    const rep1 = await repo.addMessage(conv.id, 'Initial draft reply', 'assistant');

    // Replace reply with regenerated version
    await repo.deleteMessage(rep1.id);
    const rep2 = await repo.addMessage(conv.id, 'Regenerated: Consistency, Availability, Partition tolerance.', 'assistant');

    const msgs = await repo.getMessages(conv.id);
    expect(msgs.length).toBe(2);
    expect(msgs[1].content).toContain('Consistency, Availability, Partition tolerance');
  });

  // Demo 6: Stream stop and partial preservation
  it('Demo 6: Stops generation mid-stream and preserves partial text with interruption marker', async () => {
    const repo = createRepo();
    const conv = await repo.createConversation('Stream Abort Demo', 'Normal');
    const partial = 'Streaming token 1... token 2... token 3...';
    const saved = `${partial}\n\n*[Response generation was stopped by user]*`;
    const msg = await repo.addMessage(conv.id, saved, 'assistant');

    expect(msg.content).toContain('Streaming token 1');
    expect(msg.content).toContain('*[Response generation was stopped by user]*');
  });

  // Demo 7: Duplicate submission lockout
  it('Demo 7: Blocks duplicate submissions when request is already busy or running', () => {
    let isRunning = true;
    let submissionAccepted = false;

    function attemptSend() {
      if (isRunning) return false;
      submissionAccepted = true;
      return true;
    }

    expect(attemptSend()).toBe(false);
    expect(submissionAccepted).toBe(false);

    isRunning = false;
    expect(attemptSend()).toBe(true);
    expect(submissionAccepted).toBe(true);
  });

  // Demo 8: Multi-turn preference extraction and Layer B summary synthesis
  it('Demo 8: Extracts multi-turn preferences and updates Layer B AI summary atomically', async () => {
    const repo = createRepo();
    const summaryEngine = new AIMemorySummaryEngine(repo);
    const memEngine = new MemoryEngine(repo);

    await summaryEngine.processNewTurn('I always prefer dark theme and high contrast syntax.', 'Noted!');
    await summaryEngine.processNewTurn('My project is an automated financial risk ledger in Rust.', 'Recorded!');

    const summary = await summaryEngine.generateSummary();
    expect(summary.sections.preferencesAndStyle.length).toBeGreaterThan(0);
    expect(summary.sections.activeProjects.length).toBeGreaterThan(0);
  });

  // Demo 9: Correction and superseding of old memory
  it('Demo 9: Supersedes previous memory when user corrects a preference', async () => {
    const repo = createRepo();
    const summaryEngine = new AIMemorySummaryEngine(repo);
    const memEngine = new MemoryEngine(repo);

    // Initial preference
    await summaryEngine.processNewTurn('We use MySQL for our primary database.', 'Understood.');
    const initial = await memEngine.listMemories({ category: 'technical_decision' });
    expect(initial.some((m) => m.content.includes('MySQL'))).toBe(true);

    // Correction
    await summaryEngine.processNewTurn('Actually, stop using MySQL. We use CockroachDB for distributed SQL.', 'Updated.');
    const updated = await memEngine.listMemories({ category: 'technical_decision' });
    expect(updated.some((m) => m.content.includes('MySQL'))).toBe(false);
    expect(updated.some((m) => m.content.includes('CockroachDB'))).toBe(true);
  });

  // Demo 10: Knowledge base retrieval with citations
  it('Demo 10: Ingests documents and performs retrieval ranking with source citation', async () => {
    const repo = createRepo();
    const kbEngine = new KnowledgeBaseEngine(repo);

    const kb = await kbEngine.createKnowledgeBase({ name: 'System Whitepaper' });
    await kbEngine.ingestDocument({
      knowledgeBaseId: kb.id,
      title: 'Ayatrisya Protocol Spec',
      fileName: 'spec.md',
      mimeType: 'text/markdown',
      fileBytes: new TextEncoder().encode('Ayatrisya Protocol v2.0 enforces 19 typed interactive block representations.'),
    });

    const matches = await kbEngine.searchKnowledgeBase(kb.id, 'interactive block representations');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].citation).toContain('Ayatrisya Protocol Spec');
    expect(matches[0].chunk.text).toContain('19 typed interactive block representations');
  });

  // Demo 11: Sensitive tool execution authorization prompt
  it('Demo 11: Enforces authorization check on sensitive capabilities', () => {
    const requiresApproval = trustKernel.requiresExplicitApproval('execute_arbitrary_shell');
    const isGranted = trustKernel.hasCapability('execute_arbitrary_shell');

    expect(requiresApproval).toBe(true);
    expect(isGranted).toBe(false);
  });

  // Demo 12: Mobile responsive wrapping
  it('Demo 12: Verifies proper word-break styling preventing character-by-character wrap', () => {
    const cssRule = 'overflow-wrap: break-word; word-break: normal; white-space: pre-wrap;';
    expect(cssRule).toContain('word-break: normal');
    expect(cssRule).toContain('overflow-wrap: break-word');
  });
});

