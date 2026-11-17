import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { normalizeMarkdown, stabilizeStreamingMarkdown, isSafeUrl } from '../components/markdown/markdown-normalizer';
import { CanvasProvider } from '../components/canvas/CanvasContext';

describe('Ayatrisya — Unified Markdown Renderer Acceptance Test Suite', () => {
  // Helper to render MarkdownRenderer in static HTML
  const render = (content: string, options: { isStreaming?: boolean } = {}) => {
    return renderToStaticMarkup(
      <CanvasProvider>
        <MarkdownRenderer content={content} isStreaming={options.isStreaming} />
      </CanvasProvider>
    );
  };

  describe('Core Markdown Elements (Acceptance Checks)', () => {
    it('renders "**Hello World**" as bold Hello World with no visible asterisks', () => {
      const html = render('**Hello World**');
      expect(html).toContain('<strong');
      expect(html).toContain('Hello World');
      expect(html).not.toContain('**Hello World**');
      expect(html).not.toContain('**');
    });

    it('renders "`npm run dev`" with inline code styling and no visible backticks', () => {
      const html = render('`npm run dev`');
      expect(html).toContain('<code');
      expect(html).toContain('npm run dev');
      expect(html).not.toContain('`npm run dev`');
      expect(html).not.toContain('`');
    });

    it('renders "## Introduction" as a properly formatted H2 heading', () => {
      const html = render('## Introduction');
      expect(html).toContain('<h2');
      expect(html).toContain('Introduction');
      expect(html).not.toContain('##');
    });

    it('renders "- First item" as an unordered list', () => {
      const html = render('- First item\n- Second item');
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
      expect(html).toContain('First item');
      expect(html).toContain('Second item');
    });

    it('renders "1. First item" as an ordered list', () => {
      const html = render('1. First item\n2. Second item');
      expect(html).toContain('<ol');
      expect(html).toContain('<li');
      expect(html).toContain('First item');
      expect(html).toContain('Second item');
    });

    it('renders "[Ayatrisya](https://ayatrisya.web.app)" as a safe, clickable link with target and rel attributes', () => {
      const html = render('[Ayatrisya](https://ayatrisya.web.app)');
      expect(html).toContain('<a');
      expect(html).toContain('href="https://ayatrisya.web.app"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer nofollow"');
      expect(html).toContain('Ayatrisya');
    });
  });

  describe('Streaming Stabilization & Incomplete Delimiters', () => {
    it('recovers incomplete bold syntax during streaming without showing raw asterisks', () => {
      const rawStreaming = '**Hello World';
      const stabilized = stabilizeStreamingMarkdown(rawStreaming);
      expect(stabilized).toBe('**Hello World**');

      const html = render(rawStreaming, { isStreaming: true });
      expect(html).toContain('<strong');
      expect(html).toContain('Hello World');
      expect(html).not.toContain('**');
    });

    it('recovers incomplete inline code during streaming without showing raw backticks', () => {
      const rawStreaming = 'Run `npm run dev';
      const stabilized = stabilizeStreamingMarkdown(rawStreaming);
      expect(stabilized).toBe('Run `npm run dev`');

      const html = render(rawStreaming, { isStreaming: true });
      expect(html).toContain('<code');
      expect(html).toContain('npm run dev');
    });

    it('recovers incomplete fenced code block during streaming without breaking layout', () => {
      const rawStreaming = '```javascript\nconst count = 42;';
      const html = render(rawStreaming, { isStreaming: true });
      expect(html).toContain('chat-code');
      expect(html).toContain('count =');
      expect(html).toContain('chat-token-keyword');
      expect(html).toContain('JAVASCRIPT');
    });

    it('stabilizes incomplete table row during streaming', () => {
      const rawTable = '| Feature | Status |\n| --- | --- |\n| Encryption | Active';
      const html = render(rawTable, { isStreaming: true });
      expect(html).toContain('Feature');
      expect(html).toContain('Status');
      expect(html).toContain('Active');
    });
  });

  describe('Model Artifact Cleaning & Normalization', () => {
    it('normalizes loose bold syntax with spaces inside asterisks: "** bold text **"', () => {
      const html = render('Here is ** bold text ** for review.');
      expect(html).toContain('<strong');
      expect(html).toContain('bold text');
      expect(html).not.toContain('**');
    });

    it('unescapes double-escaped markdown produced by models: "\\*\\*bold\\*\\*"', () => {
      const html = render('Here is \\*\\*escaped bold\\*\\* and \\`code\\`.');
      expect(html).toContain('<strong');
      expect(html).toContain('escaped bold');
      expect(html).toContain('<code');
      expect(html).toContain('code');
    });

    it('ensures headings without preceding blank lines are parsed as genuine headings', () => {
      const html = render('Introduction paragraph text\n## Section Overview\nMore body text');
      expect(html).toContain('<h2');
      expect(html).toContain('Section Overview');
      expect(html).toContain('Introduction paragraph text');
    });

    it('preserves literal markdown inside code blocks untouched', () => {
      const codeWithMd = '```markdown\n# Not a real heading\n**not bold**\n```';
      const html = render(codeWithMd);
      expect(html).toContain('chat-code');
      expect(html).toContain('# Not a real heading');
      expect(html).toContain('**not bold**');
    });
  });

  describe('Comprehensive Formatting Support (H1-H6, Task Lists, Blockquotes, HR)', () => {
    it('renders all heading levels H1 through H6 with appropriate tags', () => {
      const headings = '# H1 Title\n## H2 Title\n### H3 Title\n#### H4 Title\n##### H5 Title\n###### H6 Title';
      const html = render(headings);
      expect(html).toContain('<h1');
      expect(html).toContain('<h2');
      expect(html).toContain('<h3');
      expect(html).toContain('<h4');
      expect(html).toContain('<h5');
      expect(html).toContain('<h6');
    });

    it('renders GFM task lists with styled checkbox inputs', () => {
      const tasks = '- [ ] Pending item\n- [x] Completed item';
      const html = render(tasks);
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('Pending item');
      expect(html).toContain('Completed item');
      expect(html).toContain('checked');
    });

    it('renders blockquotes and horizontal rules', () => {
      const content = '> Important notice about intelligence.\n\n---\n\nConclusion';
      const html = render(content);
      expect(html).toContain('<blockquote');
      expect(html).toContain('Important notice about intelligence.');
      expect(html).toContain('<hr');
      expect(html).toContain('Conclusion');
    });

    it('renders rich markdown formatting inside interactive table cells', () => {
      const tableMd = '| Component | Status | Protocol |\n| --- | --- | --- |\n| **Trust Kernel** | `Active` | [RFC 7519](https://jwt.io) |\n| *Loopback IPC* | `Encrypted` | Local IPC |';
      const html = render(tableMd);
      expect(html).toContain('<strong');
      expect(html).toContain('Trust Kernel');
      expect(html).toContain('<code');
      expect(html).toContain('Active');
      expect(html).toContain('<em');
      expect(html).toContain('Loopback IPC');
      expect(html).toContain('<a');
      expect(html).toContain('href="https://jwt.io"');
    });
  });

  describe('Security & XSS Defense', () => {
    it('blocks dangerous javascript: links', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      const html = render('[Click me](javascript:alert(1))');
      expect(html).not.toContain('href="javascript:');
      expect(html).toContain('Click me');
    });

    it('blocks dangerous data: URL schemes', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      const html = render('[Malicious](data:text/html,<script>alert(1)</script>)');
      expect(html).not.toContain('href="data:');
    });

    it('allows valid relative and anchor links', () => {
      expect(isSafeUrl('/workspace/canvas')).toBe(true);
      expect(isSafeUrl('#section-2')).toBe(true);
      const html = render('[Go to Canvas](/workspace/canvas)');
      expect(html).toContain('href="/workspace/canvas"');
    });
  });

  describe('Priority 1 Quality Restoration: Math, Currency & Streaming KaTeX', () => {
    it('protects standalone currency amounts ($50 and $100) from being misparsed as KaTeX math', () => {
      const content = 'The monthly server cost is $50 and the extra disk is $20 per month.';
      const html = render(content);
      expect(html).not.toContain('class="katex"');
      expect(html).toContain('$50');
      expect(html).toContain('$20');
    });

    it('accurately renders legitimate inline and block LaTeX formulas via KaTeX', () => {
      const inlineMath = 'Einstein formulated $E = mc^2$ as equivalence.';
      const inlineHtml = render(inlineMath);
      expect(inlineHtml).toContain('class="katex"');

      // Regression check for "$0 \text{ RPM}$" not being mangled by currency parser
      const rpmContent = 'The electric vehicle delivers instantaneous torque at $0 \\text{ RPM}$ while priced at $55,000.';
      const rpmHtml = render(rpmContent);
      expect(rpmHtml).toContain('class="katex"');
      expect(rpmHtml).toContain('RPM');
      expect(rpmHtml).not.toContain('$0 \\text{ RPM}$');
      expect(rpmHtml).toContain('$55,000');

      const blockMath = 'The normal distribution:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$';
      const blockHtml = render(blockMath);
      expect(blockHtml).toContain('class="katex"');
    });

    it('stabilizes streaming incomplete block LaTeX ($$) without leaking broken raw dollars', () => {
      const streamingMath = 'Computing integral:\n$$\\int_0^1 x^2 dx';
      const stabilized = stabilizeStreamingMarkdown(streamingMath);
      expect(stabilized.endsWith('$$')).toBe(true);

      const html = render(streamingMath, { isStreaming: true });
      expect(html).toContain('class="katex"');
    });

    it('stabilizes streaming incomplete single italic (*)', () => {
      const streamingItalic = 'This is *critical';
      const stabilized = stabilizeStreamingMarkdown(streamingItalic);
      expect(stabilized).toBe('This is *critical*');
    });
  });
});
