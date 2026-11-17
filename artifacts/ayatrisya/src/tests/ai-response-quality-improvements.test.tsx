import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { normalizeMarkdown, stabilizeStreamingMarkdown } from '../components/markdown/markdown-normalizer';
import { CanvasProvider } from '../components/canvas/CanvasContext';

describe('Ayatrisya — AI Response Quality Improvements (Workstream 1)', () => {
  const render = (content: string, options: { isStreaming?: boolean; messageId?: string } = {}) => {
    return renderToStaticMarkup(
      <CanvasProvider>
        <MarkdownRenderer content={content} isStreaming={options.isStreaming} messageId={options.messageId} />
      </CanvasProvider>
    );
  };

  describe('1. Bare LaTeX Environment Detection & Normalization', () => {
    it('automatically wraps and renders bare \\begin{aligned} equations', () => {
      const bareAligned = `Here is the derivation:
\\begin{aligned}
x &= \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\\\
y &= mx + c
\\end{aligned}`;

      const html = render(bareAligned);
      expect(html).toContain('class="katex"');
      expect(html).toContain('class="katex-display"');
      // Verifies it was transformed to KaTeX display math, not left as raw unformatted prose
      expect(html).not.toContain('<p>\\begin{aligned}');
    });

    it('automatically wraps and renders bare \\begin{pmatrix} matrices', () => {
      const bareMatrix = `The rotation matrix:
\\begin{pmatrix}
\\cos\\theta & -\\sin\\theta \\\\
\\sin\\theta & \\cos\\theta
\\end{pmatrix}`;

      const html = render(bareMatrix);
      expect(html).toContain('class="katex"');
      expect(html).toContain('class="katex-display"');
      expect(html).not.toContain('<p>\\begin{pmatrix}');
    });

    it('automatically wraps and renders bare \\begin{cases} piecewise expressions', () => {
      const bareCases = `The absolute value function:
\\begin{cases}
x & \\text{if } x \\ge 0 \\\\
-x & \\text{if } x < 0
\\end{cases}`;

      const html = render(bareCases);
      expect(html).toContain('class="katex"');
      expect(html).toContain('class="katex-display"');
      expect(html).not.toContain('<p>\\begin{cases}');
    });

    it('renders limits, integrals, and fractions with precision', () => {
      const math = `Limit: $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$`;
      const html = render(math);
      expect(html).toContain('class="katex"');
      expect(html).toContain('class="katex-display"');
    });

    it('renders chemical equations via mhchem extension safely', () => {
      const chem = `Water synthesis: $\\ce{2H2 + O2 -> 2H2O}$ and acid ionization: $\\ce{H2SO4 -> 2H+ + SO4^2-}$`;
      const html = render(chem);
      expect(html).toContain('class="katex"');
    });

    it('strictly preserves LaTeX code inside code blocks untouched', () => {
      const codeBlock = `\`\`\`latex
\\begin{aligned}
x &= 42
\\end{aligned}
\`\`\``;
      const html = render(codeBlock);
      expect(html).toContain('chat-code');
      expect(html).toContain('\\begin{aligned}');
      expect(html).toContain('x &amp;=');
      // Code blocks must not render KaTeX elements inside the pre tag
      expect(html).not.toContain('class="katex"');
    });
  });

  describe('2. Currency & Mathematical Disambiguation Safety', () => {
    it('preserves all requested currency expressions without triggering KaTeX math', () => {
      const currencies = [
        'Payment of ₹1,500 was received.',
        'The current balance is $1,250.50 after taxes.',
        'License fee is €50 per seat.',
        'Deposit required is £100 upfront.',
        'Net account adjustment is -$50 for this cycle.',
        'Estimated monthly cloud hosting is $10–$20.',
        'Upgraded servers range from $100 to $200 per node.',
      ];

      for (const text of currencies) {
        const html = render(text);
        expect(html).not.toContain('class="katex"');
      }

      // Check specific contents
      expect(render('Costs $1,250.50')).toContain('$1,250.50');
      expect(render('Refund -$50')).toContain('-$50');
      expect(render('Price is $10–$20')).toContain('$10–$20');
      expect(render('From $100 to $200')).toContain('$100 to $200');
      expect(render('Cost: ₹1,500')).toContain('₹1,500');
      expect(render('Fee: €50')).toContain('€50');
      expect(render('Rate: £100')).toContain('£100');
    });

    it('preserves currency punctuation without altering values', () => {
      const input = 'Order total: $1,250.50, Discount: -$50.00, Net: $1,200.50.';
      const normalized = normalizeMarkdown(input);
      expect(normalized).toContain('&#36;1,250.50');
      expect(normalized).toContain('-&#36;50.00');
      expect(normalized).toContain('&#36;1,200.50');

      const html = render(input);
      expect(html).toContain('$1,250.50');
      expect(html).toContain('-$50.00');
      expect(html).toContain('$1,200.50');
      expect(html).not.toContain('class="katex"');
    });
  });

  describe('3. Streaming Interactive JSON Skeleton Handling', () => {
    it('renders an InteractiveBlockSkeleton during active streaming of standalone JSON', () => {
      // Incomplete streaming JSON payload
      const streamingPayload = `{\n  "type": "quiz",\n  "title": "Data Structures",\n  "questions": [`;
      const html = render(streamingPayload, { isStreaming: true });

      // Must display skeleton, NEVER raw JSON
      expect(html).toContain('animate-pulse');
      expect(html).not.toContain('"questions":');
    });

    it('hydrates complete interactive block when streaming finishes', () => {
      const completeQuiz = JSON.stringify({
        version: '1.0',
        type: 'quiz',
        id: 'quiz-structures',
        title: 'Data Structures Quiz',
        questions: [
          {
            id: 'q1',
            question: 'What is the average time complexity of Hash Table lookup?',
            options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
            correctIndex: 0,
            explanation: 'Hash tables offer constant time average lookup.',
          },
        ],
      });

      const html = render(completeQuiz, { isStreaming: false, messageId: 'msg-1' });
      expect(html).toContain('Data Structures Quiz');
      expect(html).toContain('What is the average time complexity');
      expect(html).not.toContain('animate-pulse');
    });
  });

  describe('4. Progressive Markdown Table Stabilization', () => {
    it('stabilizes incomplete table boundary during streaming without fabricating content', () => {
      const streamingTable = '| Metric | Value\n| --- | ---';
      const stabilized = stabilizeStreamingMarkdown(streamingTable);
      expect(stabilized.endsWith('|')).toBe(true);

      const html = render(streamingTable, { isStreaming: true });
      expect(html).toContain('Metric');
      expect(html).toContain('Value');
    });
  });

  describe('5. GitHub-Style Alert Callout Components', () => {
    it('renders [!NOTE] alert with distinct styling and Info icon', () => {
      const md = '> [!NOTE]\n> Keep in mind that encryption is enabled by default.';
      const html = render(md);
      expect(html).toContain('data-testid="alert-note"');
      expect(html).toContain('NOTE');
      expect(html).toContain('Keep in mind that encryption is enabled by default.');
      expect(html).not.toContain('[!NOTE]');
    });

    it('renders [!TIP] alert with distinct styling and Tip icon', () => {
      const md = '> [!TIP]\n> Use indexed queries for sub-millisecond retrieval.';
      const html = render(md);
      expect(html).toContain('data-testid="alert-tip"');
      expect(html).toContain('TIP');
      expect(html).toContain('Use indexed queries for sub-millisecond retrieval.');
    });

    it('renders [!IMPORTANT] alert with distinct styling', () => {
      const md = '> [!IMPORTANT]\n> Back up your cryptographic keys before rotating.';
      const html = render(md);
      expect(html).toContain('data-testid="alert-important"');
      expect(html).toContain('IMPORTANT');
    });

    it('renders [!WARNING] alert with distinct styling', () => {
      const md = '> [!WARNING]\n> Do not expose administrative tokens in client bundles.';
      const html = render(md);
      expect(html).toContain('data-testid="alert-warning"');
      expect(html).toContain('WARNING');
    });

    it('renders [!CAUTION] alert with distinct styling', () => {
      const md = '> [!CAUTION]\n> Permanent data loss will occur if the volume is detached without unmounting.';
      const html = render(md);
      expect(html).toContain('data-testid="alert-caution"');
      expect(html).toContain('CAUTION');
    });

    it('preserves standard blockquotes without alert badges', () => {
      const md = '> Simplicity is prerequisite for reliability.\n> — Edsger W. Dijkstra';
      const html = render(md);
      expect(html).toContain('<blockquote');
      expect(html).not.toContain('data-testid="alert-');
      expect(html).toContain('Simplicity is prerequisite for reliability.');
    });
  });

  describe('6. KaTeX Error Recovery & Robustness', () => {
    it('gracefully handles incomplete or malformed LaTeX formulas without throwing', () => {
      const malformedLatex = 'Equation: $\\frac{1}{';
      expect(() => {
        const html = render(malformedLatex);
        expect(html).toBeDefined();
      }).not.toThrow();
    });
  });
});
