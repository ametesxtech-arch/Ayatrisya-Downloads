import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  MarkdownRenderer,
  normalizeMathInMarkdown,
} from '@/components/MarkdownRenderer';

describe('Ayatrisya Answer Quality & Markdown Regression Suite', () => {
  // Helper to render MarkdownRenderer to HTML string
  function renderMarkdown(content: string): string {
    return renderToStaticMarkup(React.createElement(MarkdownRenderer, { content }));
  }

  // 1. A simple factual question
  it('renders a simple factual response cleanly as readable prose without unwanted artifacts', () => {
    const factualText = 'The speed of light in a vacuum is exactly 299,792,458 meters per second.';
    const html = renderMarkdown(factualText);
    expect(html).toContain('299,792,458 meters per second');
    expect(html).toContain('<p');
  });

  // 2. A conversational follow-up
  it('renders conversational follow-up formatting naturally with paragraph breaks and bold terms', () => {
    const convoText =
      'Continuing from our previous discussion, **Mars** has two moons: *Phobos* and *Deimos*.\n\nWould you like to explore their orbital characteristics next?';
    const html = renderMarkdown(convoText);
    expect(html).toContain('<strong>Mars</strong>');
    expect(html).toContain('<em>Phobos</em>');
    expect(html).toContain('explore their orbital characteristics');
  });

  // 3. A detailed technical explanation
  it('renders a structured technical explanation with headings, blockquotes, and ordered items', () => {
    const technicalText = `### Architecture Overview

> Clean Architecture separates concerns into concentric layers.

1. Domain entities hold enterprise business rules.
2. Use cases encapsulate application-specific business workflows.
3. Adapters translate between internal and external representations.`;

    const html = renderMarkdown(technicalText);
    expect(html).toContain('<h3');
    expect(html).toContain('Architecture Overview');
    expect(html).toContain('<blockquote');
    expect(html).toContain('Clean Architecture');
    expect(html).toContain('<ol');
    expect(html).toContain('Domain entities');
  });

  // 4. JavaScript / TypeScript code with syntax highlighting and copy functionality
  it('renders syntax-highlighted code blocks with language labels and copy buttons', () => {
    const codeMarkdown = `Here is the solution:

\`\`\`typescript
function fibonacci(n: number, memo = new Map<number, number>()): number {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n)!;
  const result = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  memo.set(n, result);
  return result;
}
\`\`\``;

    const html = renderMarkdown(codeMarkdown);
    expect(html).toContain('data-testid="code-block"');
    expect(html).toContain('TYPESCRIPT');
    expect(html).toContain('data-testid="button-copy-code"');
    expect(html).toContain('chat-token-keyword');
    expect(html).toContain('fibonacci');
  });

  // 5. Big-O notation and inline/display equations (LaTeX & KaTeX)
  it('correctly renders Big-O notation and math equations without raw dollar signs leaking', () => {
    const mathMarkdown = `The algorithm exhibits:
- Time Complexity: $\\mathcal{O}(n)$
- Worst Case: $\\mathcal{O}(2^n)$
- Space Complexity: $S(n) = \\mathcal{O}(n)$

Display Equation:
$$
T(n) = 2T(n/2) + \\mathcal{O}(n)
$$`;

    const html = renderMarkdown(mathMarkdown);
    // Verify KaTeX math elements are generated
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');

    // Crucial: The literal "$O(n)$" or "$\mathcal{O}(n)$" delimiter text must NOT be visible as raw text
    expect(html).not.toContain('$\\mathcal{O}(n)$');
    expect(html).not.toContain('$$\n');
  });

  it('normalizes alternative LaTeX math delimiters like \\(...\\) and \\[...\\] into rendered math', () => {
    const altMathMarkdown = `Inline: \\(O(n \\log n)\\) and Display: \\[E = mc^2\\]`;
    const html = renderMarkdown(altMathMarkdown);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('\\(O(n');
    expect(html).not.toContain('\\[E =');
  });

  it('strictly preserves dollar signs inside code blocks without parsing them as math', () => {
    const codeWithDollars = `\`\`\`bash
# Shell environment variables
export PORT=3001
echo $PORT
npm run start -- $PORT
\`\`\``;

    const html = renderMarkdown(codeWithDollars);
    expect(html).toContain('echo $PORT');
    expect(html).toContain('chat-code');
    // Code block must not contain KaTeX tags inside the pre
    expect(html).not.toContain('class="katex"');
  });

  // 6. Tables and nested lists
  it('renders GFM markdown tables with header formatting and cell alignments', () => {
    const tableMarkdown = `| Operation | Average Case | Worst Case |
| :--- | :---: | ---: |
| Lookup | $\\mathcal{O}(1)$ | $\\mathcal{O}(n)$ |
| Insertion | $\\mathcal{O}(1)$ | $\\mathcal{O}(n)$ |`;

    const html = renderMarkdown(tableMarkdown);
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Operation');
    expect(html).toContain('<td');
    expect(html).toContain('class="katex"');
  });

  it('renders nested ordered and unordered lists properly', () => {
    const nestedList = `- Frontend
  - React
  - Tailwind CSS
- Backend
  1. Node.js
  2. Express`;

    const html = renderMarkdown(nestedList);
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('Frontend');
    expect(html).toContain('Backend');
  });

  // 7. Long streaming responses and partial math updates
  it('supports progressive streaming updates without duplicating content or crashing on partial math', () => {
    // Step 1: Incomplete stream with opening math delimiter
    const step1 = 'The computed complexity is $O(n';
    const html1 = renderMarkdown(step1);
    expect(html1).toContain('The computed complexity is $O(n');

    // Step 2: Stream completes with closing delimiter
    const step2 = 'The computed complexity is $O(n)$ where $n$ is array length.';
    const html2 = renderMarkdown(step2);
    expect(html2).toContain('class="katex"');
    expect(html2).not.toContain('$O(n)$');
  });

  // 8. Model returning malformed or incomplete Markdown
  it('gracefully renders malformed Markdown without throwing exceptions', () => {
    const malformed = `### Incomplete title
This has an **unclosed bold and a [broken link](javascript:void(0))
\`\`\`typescript
const unclosedCode = true;
`;
    expect(() => {
      const html = renderMarkdown(malformed);
      expect(html).toContain('Incomplete title');
    }).not.toThrow();
  });

  // 9. Security sanitization
  it('disallows unsafe URL schemes like javascript: and data: in links', () => {
    const malicious = `Click [here](javascript:alert("hacked")) or [data](data:text/html,evil) or [safe](https://example.com)`;
    const html = renderMarkdown(malicious);
    // Unsafe URLs should be stripped or rendered as plain spans
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="data:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  // Mathematical normalization helper tests
  describe('normalizeMathInMarkdown', () => {
    it('handles escaped math delimiters like \\$\\mathcal{O}(n)\\$', () => {
      const input = 'Complexity: \\$\\mathcal{O}(n)\\$';
      const output = normalizeMathInMarkdown(input);
      expect(output).toBe('Complexity: $\\mathcal{O}(n)$');
    });

    it('does not touch inline code with dollars', () => {
      const input = 'Run `echo $HOME` to see your directory.';
      const output = normalizeMathInMarkdown(input);
      expect(output).toBe('Run `echo $HOME` to see your directory.');
    });

    it('converts display math \\[ ... \\] to $$ ... $$', () => {
      const input = '\\[ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]';
      const output = normalizeMathInMarkdown(input);
      expect(output).toContain('$$\n');
      expect(output).toContain('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
    });

    it('converts inline math \\( ... \\) to $ ... $', () => {
      const input = 'Equation \\(E = mc^2\\) is famous.';
      const output = normalizeMathInMarkdown(input);
      expect(output).toBe('Equation $E = mc^2$ is famous.');
    });
  });
});
