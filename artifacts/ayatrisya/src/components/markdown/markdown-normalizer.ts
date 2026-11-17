/**
 * Ayatrisya Unified Markdown Normalizer & Streaming Stabilizer
 * 
 * Ensures robust Markdown parsing across all AI response types, streaming outputs,
 * research reports, documents, and interactive blocks.
 * 
 * Capabilities:
 * 1. Streaming recovery: auto-closes dangling delimiters (fences, inline code, bold, italic, tables)
 * 2. Syntax normalization: unescapes double-escaped markdown, fixes loose asterisk spacing,
 *    and normalizes headings/lists without damaging legitimate literal code.
 * 3. Protocol & security verification: validates safe link schemes (blocks javascript:, vbscript:, data:)
 */

/**
 * Validates whether a URL is safe to open/render.
 * Allows https, http, mailto, relative routes (/), and anchors (#).
 * Blocks javascript:, vbscript:, data:, and file: schemes.
 */
export function isSafeUrl(rawHref?: string): boolean {
  if (!rawHref) return false;
  const trimmed = rawHref.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  if (/^(https?:|mailto:)/i.test(trimmed)) {
    // Disallow javascript: inside data or query tricks
    return !/javascript:/i.test(trimmed);
  }
  return false;
}

/**
 * Recovers incomplete Markdown syntax during streaming.
 * Prevents raw asterisks, backticks, or mangled fences from flashing on screen.
 */
export function stabilizeStreamingMarkdown(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Incomplete fenced code blocks:
  // Count ``` occurrences. If odd, a fenced code block was opened and not closed.
  const fenceMatches = text.match(/```/g);
  const fenceCount = fenceMatches ? fenceMatches.length : 0;
  if (fenceCount % 2 === 1) {
    // If the last line contains only ``` (or ```lang), ensure a newline before closing
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    text += '```';
    return text;
  }

  // Split into code block chunks vs prose chunks so we only stabilize prose
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, index) => {
      // Index % 2 === 1 is a closed code block, preserve untouched
      if (index % 2 === 1) return part;

      let segment = part;

      // 2. Unclosed inline code backticks:
      // Count single backticks (not triple)
      const inlineBackticks = segment.match(/(?<!`)`(?!`)/g);
      if (inlineBackticks && inlineBackticks.length % 2 === 1) {
        segment += '`';
      }

      // 3. Unclosed bold delimiters: ** or __
      // Count double asterisks
      const boldMatches = segment.match(/\*\*/g);
      if (boldMatches && boldMatches.length % 2 === 1) {
        segment += '**';
      }

      const underscoreBolds = segment.match(/__/g);
      if (underscoreBolds && underscoreBolds.length % 2 === 1) {
        segment += '__';
      }

      // 4. Unclosed block math: $$
      const blockMathMatches = segment.match(/(?<!\\)\$\$/g);
      if (blockMathMatches && blockMathMatches.length % 2 === 1) {
        segment += '$$';
        return segment;
      }

      // 5. Unclosed inline math: $ (not block math)
      const inlineMathMatches = segment.match(/(?<!\\|\$)\$(?!\$)/g);
      if (inlineMathMatches && inlineMathMatches.length % 2 === 1) {
        segment += '$';
        return segment;
      }

      // 6. Unclosed single italic: * or _ (outside math)
      const italicMatches = segment.match(/(?<!\*)\*(?!\*)/g);
      if (italicMatches && italicMatches.length % 2 === 1) {
        segment += '*';
      }

      const underscoreItalics = segment.match(/(?<!_)_(?!_)/g);
      if (underscoreItalics && underscoreItalics.length % 2 === 1) {
        segment += '_';
      }

      // 7. Progressive Markdown Table Stabilization:
      // When a table is streaming, e.g. '| Header 1 | Header 2' without trailing | or without separator row
      if (segment.includes('|')) {
        const lines = segment.split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.trim().startsWith('|') && !lastLine.trim().endsWith('|')) {
          lines[lines.length - 1] = lastLine + ' |';
        }

        // If table has header row but incomplete or missing separator row during streaming
        const pipeLines = lines.filter((l) => l.trim().startsWith('|'));
        if (pipeLines.length === 1 && !lines.some((l) => /^[ \t]*\|[ \t]*[-:]+[-| :]*\|?[ \t]*$/.test(l))) {
          const headerPipes = (pipeLines[0].match(/\|/g) || []).length;
          const colCount = Math.max(1, headerPipes - 1);
          const separatorRow = '|' + Array(colCount).fill(' --- ').join('|') + '|';
          lines.push(separatorRow);
        } else if (pipeLines.length >= 2) {
          const lastPipeLine = lines[lines.length - 1].trim();
          if (lastPipeLine.startsWith('|') && /\|[ \t]*[-:]+/.test(lastPipeLine) && !lastPipeLine.endsWith('|')) {
            lines[lines.length - 1] = lastPipeLine + ' |';
          }
        }

        segment = lines.join('\n');
      }

      return segment;
    })
    .join('');
}

/**
 * List of bare LaTeX mathematical environments that should be safely wrapped
 * in $$ ... $$ display blocks when emitted by models without explicit delimiters.
 */
const BARE_LATEX_ENV_REGEX =
  /(?:^|\n|[ \t]*)(\\begin\{(aligned|align\*?|equation\*?|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|gather\*?|split|multline\*?)\}[\s\S]*?\\end\{\2\})/g;

/**
 * Normalizes Markdown syntax across responses to resolve common LLM defects
 * while strictly preserving legitimate literal syntax inside code blocks.
 */
export function normalizeMarkdown(
  raw: string,
  options: { isStreaming?: boolean } = {}
): string {
  if (!raw) return '';

  let content = raw;

  // If streaming, stabilize open delimiters first
  if (options.isStreaming) {
    content = stabilizeStreamingMarkdown(content);
  }

  // 1. Split by fenced code blocks first so fenced code blocks are 100% preserved
  const fencedParts = content.split(/(```[\s\S]*?```)/g);

  return fencedParts
    .map((fencedPart, fIdx) => {
      // Inside fenced code blocks: preserve 100% as-is
      if (fIdx % 2 === 1) return fencedPart;

      let text = fencedPart;

      // 2. Unescape double-escaped markdown commonly emitted by models or JSON serialization:
      // e.g. \`code\` -> `code`, \*\*bold\*\* -> **bold**, \_italic\_ -> _italic_
      text = text.replace(/\\`/g, '`');
      text = text.replace(/\\(\*\*|__|\*|_)/g, '$1');

      // 3. Now split by inline code spans so inline code contents are preserved as-is
      const inlineParts = text.split(/(`[^`\n]*`)/g);

      return inlineParts
        .map((sub, sIdx) => {
          if (sIdx % 2 === 1) return sub;

          let prose = sub;

          // Disambiguate standalone currency amounts ($50, -$50, $1,250.50, $10-$20, $100 to $200)
          // so remark-math does not misparse them as LaTeX math delimiters.
          prose = prose.replace(
            /(^|[\s(\[{"'–—\-+~=])\$(\d[\d,]*(?:\.\d+)?)(?=$|[\s)\]}"'.,?!;:–—\-+/]|\b)/g,
            (_m, p1, p2) => `${p1}&#36;${p2}`
          );
          prose = prose.replace(
            /(^|[\s(\[{"'–—\-+~=])\\\$(\d[\d,]*(?:\.\d+)?)(?=$|[\s)\]}"'.,?!;:–—\-+/]|\b)/g,
            (_m, p1, p2) => `${p1}&#36;${p2}`
          );

          // Normalize KaTeX math output (\[ ... \] -> $$, \( ... \) -> $)
          prose = prose.replace(/\\\[([\s\S]*?)\\\]/g, (_m, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`);
          prose = prose.replace(/\\\(([\s\S]*?)\\\)/g, (_m, math: string) => `$${math.trim()}$`);
          prose = prose.replace(/\\\$\\$([\s\S]*?)\\\$\\$/g, (_m, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`);
          prose = prose.replace(/\\\$([^\s$][^$\n]*?[^\s$]?)\\\$/g, (_m, math: string) => `$${math.trim()}$`);

          // Ensure $$ display math is reliably formatted with newlines for remark-math AST parsing
          prose = prose.replace(/(?<!\$)\$\$(?!\$)([\s\S]*?)(?<!\$)\$\$(?!\$)/g, (_m, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`);

          // Normalize chemical equations \ce{...} not already wrapped in math (supports nested sub/superscript braces)
          prose = prose.replace(/(?<!\$)\\ce\{((?:[^{}]|\{[^{}]*\})*)\}(?!\$)/g, '$\\ce{$1}$');

          // Detect bare LaTeX environments (aligned, matrix, pmatrix, cases, etc.) not wrapped in $$
          // Protect any existing $$ blocks first
          if (prose.includes('\\begin{')) {
            const mathParts = prose.split(/(\$\$[\s\S]*?\$\$)/g);
            prose = mathParts
              .map((part, mIdx) => {
                if (mIdx % 2 === 1) return part; // Inside existing $$ ... $$ block, preserve
                return part.replace(BARE_LATEX_ENV_REGEX, (_match, env) => `\n\n$$\n${env.trim()}\n$$\n\n`);
              })
              .join('');
          }

          // Fix loose spaces inside bold:
          // In CommonMark: "** text **" or "**text **" is not bold due to flanking whitespace rules.
          prose = prose.replace(/\*\*\s+([^\s*](?:[\s\S]*?[^\s*])?)\s+\*\*/g, '**$1**');
          prose = prose.replace(/\*\*\s+([^\s*](?:[\s\S]*?[^\s*])?)\*\*/g, '**$1**');
          prose = prose.replace(/\*\*([^\s*](?:[\s\S]*?[^\s*])?)\s+\*\*/g, '**$1**');

          // Fix loose spaces inside italic:
          prose = prose.replace(/(?<!\*)\*\s+([^\s*](?:[\s\S]*?[^\s*])?)\s+\*(?!\*)/g, '*$1*');

          // Ensure headings preceded by text have a blank line before them:
          prose = prose.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');

          // Ensure lists preceded by non-list text have a blank line before them:
          prose = prose.replace(/([^\n\s\-*+0-9])\n([ \t]*[-*+]\s+)/g, '$1\n\n$2');
          prose = prose.replace(/([^\n\s\-*+0-9])\n([ \t]*\d+\.\s+)/g, '$1\n\n$2');

          // Ensure blockquotes preceded by non-blockquote text have a blank line before them:
          prose = prose.replace(/([^\n>])\n([ \t]*>[ \t]*)/g, '$1\n\n$2');

          // Ensure horizontal dividers preceded by text have a blank line before them:
          prose = prose.replace(/([^\n])\n([ \t]*[-*_]{3,}[ \t]*)(?=\n|$)/g, '$1\n\n$2');

          // Ensure markdown tables followed by non-table text have a blank line after them:
          prose = prose.replace(/(\|[ \t]*\n)([^|\n\s])/g, '$1\n$2');

          return prose;
        })
        .join('');
    })
    .join('');
}
