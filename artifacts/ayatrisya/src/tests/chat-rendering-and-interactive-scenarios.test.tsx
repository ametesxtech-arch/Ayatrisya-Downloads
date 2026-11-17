import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { normalizeMarkdown, stabilizeStreamingMarkdown } from '../components/markdown/markdown-normalizer';
import { CanvasProvider } from '../components/canvas/CanvasContext';

describe('Ayatrisya — 13 Critical Chat Rendering & Interactive AI Scenarios', () => {
  const render = (content: string, options: { isStreaming?: boolean; messageId?: string } = {}) => {
    return renderToStaticMarkup(
      <CanvasProvider>
        <MarkdownRenderer content={content} isStreaming={options.isStreaming} messageId={options.messageId} />
      </CanvasProvider>
    );
  };

  it('Scenario 1: Mixed prose, headings, lists, inline code, bold, italic and spacing', () => {
    const markdown = `# Architecture Overview
In this system, we use **modular services** and *immutable event streams*.

Key advantages:
- High availability with \`zero-downtime\` deploys
- Deterministic state transitions
- Granular permission boundaries

1. First initiate handshake
2. Verify token signature
3. Dispatch request to worker`;

    const html = render(markdown);
    expect(html).toContain('<h1');
    expect(html).toContain('Architecture Overview');
    expect(html).toContain('<strong');
    expect(html).toContain('modular services');
    expect(html).toContain('<em');
    expect(html).toContain('immutable event streams');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<code');
    expect(html).toContain('zero-downtime');
  });

  it('Scenario 2: Code blocks with syntax highlighting, language badge, copy button', () => {
    const codeSnippet = `\`\`\`typescript
export function computeMetrics(samples: number[]): number {
  const total = samples.reduce((acc, curr) => acc + curr, 0);
  return total / samples.length;
}
\`\`\``;

    const html = render(codeSnippet);
    expect(html).toContain('data-testid="code-block"');
    expect(html).toContain('TYPESCRIPT');
    expect(html).toContain('data-testid="button-copy-code"');
    expect(html).toContain('chat-token-keyword');
    expect(html).toContain('computeMetrics');
  });

  it('Scenario 3: Complex LaTeX equations (fractions, square roots, matrices, aligned, cases)', () => {
    const mathContent = `Derivation of root:
$$\\begin{aligned}
x &= \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\\\
E &= mc^2
\\end{aligned}$$

Rotation Matrix:
\\begin{pmatrix}
\\cos\\theta & -\\sin\\theta \\\\
\\sin\\theta & \\cos\\theta
\\end{pmatrix}

Piecewise Definition:
\\begin{cases}
f(x) = x^2 & \\text{for } x \\ge 0 \\\\
f(x) = -x & \\text{for } x < 0
\\end{cases}`;

    const html = render(mathContent);
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    // Ensure bare environments were wrapped into display math
    expect(html).not.toContain('<p>\\begin{pmatrix}');
    expect(html).not.toContain('<p>\\begin{cases}');
  });

  it('Scenario 4: Chemical equations and reaction formulas with nested braces', () => {
    const chemMarkdown = `Photosynthesis reaction: $\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}$
Oxidation of iron: \\ce{Fe^{2+} + 2e- -> Fe}
Sulfate dissociation: \\ce{H2SO4 -> 2H+ + SO4^{2-}}`;

    const html = render(chemMarkdown);
    expect(html).toContain('class="katex"');
    expect(html).toContain('Photosynthesis reaction');
    expect(html).toContain('Oxidation of iron');
  });

  it('Scenario 5: Markdown tables with multiple columns and alignment', () => {
    const tableMarkdown = `| Service | Latency (p99) | Throughput | Availability |
| :--- | :---: | ---: | :--- |
| Auth Gateway | 12ms | 45k rps | 99.99% |
| Ingestion Bus | 8ms | 120k rps | 99.999% |
| Storage Engine | 28ms | 18k rps | 99.95% |`;

    const html = render(tableMarkdown);
    expect(html).toContain('<table');
    expect(html).toContain('Auth Gateway');
    expect(html).toContain('120k rps');
    expect(html).toContain('99.999%');
  });

  it('Scenario 6: GitHub alert callouts ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])', () => {
    const alerts = `> [!NOTE]
> Database migrations run automatically during deployment.

> [!TIP]
> Enable Redis caching to reduce latency by up to 60%.

> [!IMPORTANT]
> Verify environment variables before promoting to production.

> [!WARNING]
> Deprecated v1 endpoints will be decommissioned next quarter.

> [!CAUTION]
> Dropping schema tables is irreversible.`;

    const html = render(alerts);
    expect(html).toContain('data-testid="alert-note"');
    expect(html).toContain('data-testid="alert-tip"');
    expect(html).toContain('data-testid="alert-important"');
    expect(html).toContain('data-testid="alert-warning"');
    expect(html).toContain('data-testid="alert-caution"');
    expect(html).not.toContain('[!NOTE]');
    expect(html).not.toContain('[!CAUTION]');
  });

  it('Scenario 7: Interactive Quiz / MCQ with clickable options, structure and question cards', () => {
    const quizPayload = `\`\`\`interactive
{
  "version": "1.0",
  "type": "assessment",
  "title": "Computer Networks Mastery",
  "mode": "practice",
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "Which layer of the OSI model does TLS/SSL operate at?",
      "options": [
        { "id": "a", "label": "Application Layer" },
        { "id": "b", "label": "Transport / Presentation Layer" },
        { "id": "c", "label": "Network Layer" },
        { "id": "d", "label": "Data Link Layer" }
      ],
      "correctAnswer": "b",
      "explanation": "TLS operates between transport (Layer 4) and application (Layer 7)."
    }
  ]
}
\`\`\``;

    const html = render(quizPayload, { messageId: 'msg-quiz-test' });
    expect(html).toContain('Computer Networks Mastery');
    expect(html).toContain('Which layer of the OSI model does TLS/SSL operate at?');
    expect(html).toContain('Transport / Presentation Layer');
    expect(html).toContain('role="radio"');
  });

  it('Scenario 8: Interactive Flashcards with prompt and answer structure', () => {
    const flashcardPayload = `\`\`\`interactive
{
  "version": "1.0",
  "type": "flashcard",
  "title": "Operating Systems Flashcards",
  "items": [
    {
      "id": "fc1",
      "front": "What are the four necessary conditions for Deadlock?",
      "back": "Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait"
    }
  ]
}
\`\`\``;

    const html = render(flashcardPayload);
    expect(html).toContain('Operating Systems Flashcards');
    expect(html).toContain('What are the four necessary conditions for Deadlock?');
  });

  it('Scenario 9: Interactive Poll with voting and options', () => {
    const pollPayload = `\`\`\`interactive
{
  "version": "1.0",
  "type": "poll",
  "question": "Which architecture pattern do you prefer for high-scale apps?",
  "options": [
    { "id": "p1", "label": "Event-Driven Microservices" },
    { "id": "p2", "label": "Modular Monolith" }
  ]
}
\`\`\``;

    const html = render(pollPayload);
    expect(html).toContain('Which architecture pattern do you prefer for high-scale apps?');
    expect(html).toContain('Event-Driven Microservices');
    expect(html).toContain('Modular Monolith');
  });

  it('Scenario 10: Interactive Step-by-Step guide with progress indicators', () => {
    const stepsPayload = `\`\`\`interactive
{
  "version": "1.0",
  "type": "steps",
  "title": "Deploying to Kubernetes",
  "steps": [
    { "title": "Build Container Image", "description": "Run docker build with multi-stage caching." },
    { "title": "Apply Manifests", "description": "Execute kubectl apply -f manifests/." },
    { "title": "Verify Rollout", "description": "Ensure pods pass health and readiness probes." }
  ]
}
\`\`\``;

    const html = render(stepsPayload);
    expect(html).toContain('Deploying to Kubernetes');
    expect(html).toContain('Build Container Image');
    expect(html).toContain('Verify Rollout');
  });

  it('Scenario 11: Interactive Chart visualization', () => {
    const chartPayload = `\`\`\`interactive
{
  "version": "1.0",
  "type": "chart",
  "title": "Quarterly Revenue Growth",
  "chartType": "bar",
  "data": [
    { "name": "Q1", "value": 450 },
    { "name": "Q2", "value": 680 },
    { "name": "Q3", "value": 920 }
  ],
  "xAxisKey": "name",
  "series": [{ "key": "value", "label": "Revenue ($k)" }]
}
\`\`\``;

    const html = render(chartPayload);
    expect(html).toContain('Quarterly Revenue Growth');
    expect(html).toContain('Revenue ($k)');
  });

  it('Scenario 12: Streaming message with partial markdown and math stabilization', () => {
    const streamingMath = 'We calculate the radius using $r = \\sqrt{x^2 + y';
    const stabilized = stabilizeStreamingMarkdown(streamingMath);
    expect(stabilized.endsWith('$')).toBe(true);

    const html = render(streamingMath, { isStreaming: true });
    expect(html).toContain('katex');
  });

  it('Scenario 13: Streaming incomplete interactive JSON rendered as skeleton without raw text flashing', () => {
    const partialJson = `{\n  "version": "1.0",\n  "type": "assessment",\n  "title": "Algorithms Practice",\n  "questions": [`;
    const html = render(partialJson, { isStreaming: true });

    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('"questions":');
    expect(html).not.toContain('Algorithms Practice');
  });
});
