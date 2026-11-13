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

      // 4. Incomplete table rows (e.g. '| Col 1 | Col 2' without trailing | or newline)
      if (segment.includes('|') && segment.includes('---')) {
        const lines = segment.split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.trim().startsWith('|') && !lastLine.trim().endsWith('|')) {
          lines[lines.length - 1] = lastLine + ' |';
          segment = lines.join('\n');
        }
      }

      return segment;
    })
    .join('');
}

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

          // Normalize KaTeX math output (\[ ... \] -> $$, \( ... \) -> $)
          prose = prose.replace(/\\\[([\s\S]*?)\\\]/g, (_m, math: string) => `$$\n${math.trim()}\n$$`);
          prose = prose.replace(/\\\(([\s\S]*?)\\\)/g, (_m, math: string) => `$${math.trim()}$`);
          prose = prose.replace(/\\\$([^\s$][^$]*?[^\s$]?)\\\$/g, (_m, math: string) => `$${math.trim()}$`);

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

          return prose;
        })
        .join('');
    })
    .join('');
}
