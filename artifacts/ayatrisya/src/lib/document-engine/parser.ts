import type {
  DocumentAst,
  DocumentNode,
  DocumentTemplate,
  HeadingNode,
  ListItem,
  TocEntry,
  CalloutNode,
  TableNode,
  CodeNode,
  ListNode,
  ParagraphNode,
} from './types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Parses markdown text into a structured, validated Document AST.
 * Handles headings, tables, code blocks, lists, callouts, and page breaks.
 */
export function parseMarkdownToAst(
  markdown: string,
  options: {
    fallbackTitle?: string;
    template?: DocumentTemplate;
    includeToc?: boolean;
    author?: string;
  } = {}
): DocumentAst {
  const {
    fallbackTitle = 'Untitled Document',
    template = 'report',
    includeToc = true,
    author = 'Ayatrisya Intelligence',
  } = options;

  const lines = markdown.split(/\r?\n/);
  const nodes: DocumentNode[] = [];
  const tocEntries: TocEntry[] = [];
  let mainTitle = '';
  let subtitle = '';
  const seenIds = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 1. Fenced Code Block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      nodes.push({
        type: 'code',
        code: codeLines.join('\n'),
        language: lang || undefined,
      } as CodeNode);
      continue;
    }

    // 2. Callouts (> [!NOTE] / > [!TIP] / > [!WARNING] / > [!IMPORTANT])
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|INFO|CAUTION)\](?:\s+(.*))?$/i);
    if (calloutMatch) {
      const rawTag = calloutMatch[1].toUpperCase();
      const inlineTitle = calloutMatch[2]?.trim() || '';
      let variant: 'info' | 'warning' | 'tip' | 'note' = 'info';
      if (rawTag === 'WARNING' || rawTag === 'CAUTION') variant = 'warning';
      else if (rawTag === 'TIP') variant = 'tip';
      else if (rawTag === 'NOTE' || rawTag === 'INFO') variant = 'note';
      else variant = 'info';

      const calloutTextLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        calloutTextLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      nodes.push({
        type: 'callout',
        variant,
        title: inlineTitle || `${rawTag.charAt(0)}${rawTag.slice(1).toLowerCase()}`,
        text: calloutTextLines.join(' ').trim(),
      } as CalloutNode);
      continue;
    }

    // 3. Blockquotes
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const fullQuote = quoteLines.join(' ');
      // Check for citation e.g. -- Author
      const citeMatch = fullQuote.match(/(.+?)\s*--\s*(.+)$/);
      if (citeMatch) {
        nodes.push({
          type: 'blockquote',
          text: citeMatch[1].trim(),
          citation: citeMatch[2].trim(),
        });
      } else {
        nodes.push({
          type: 'blockquote',
          text: fullQuote,
        });
      }
      continue;
    }

    // 4. Page Break
    if (line === '---' || line === '***' || line === '___' || line === '\\pagebreak') {
      nodes.push({ type: 'pageBreak' });
      i++;
      continue;
    }

    // 5. Headings (# H1 to ###### H6)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = headingMatch[2].trim();

      if (level === 1 && !mainTitle) {
        mainTitle = text;
      } else {
        let baseSlug = slugify(text) || `section-${nodes.length}`;
        let slug = baseSlug;
        let count = 1;
        while (seenIds.has(slug)) {
          slug = `${baseSlug}-${count++}`;
        }
        seenIds.add(slug);

        const headingNode: HeadingNode = {
          type: 'heading',
          level,
          text,
          id: slug,
        };
        nodes.push(headingNode);

        if (level <= 3) {
          tocEntries.push({
            id: slug,
            level,
            text,
          });
        }
      }
      i++;
      continue;
    }

    // 6. Tables (| Col 1 | Col 2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        // Check if line 1 is separator |---|---|
        let dataStartIndex = 1;
        const aligns: ('left' | 'center' | 'right')[] = [];
        if (tableLines[1].replace(/[\s|:-]/g, '').length === 0) {
          dataStartIndex = 2;
          const sepCells = tableLines[1].slice(1, -1).split('|');
          for (const s of sepCells) {
            const trimmed = s.trim();
            if (trimmed.startsWith(':') && trimmed.endsWith(':')) aligns.push('center');
            else if (trimmed.endsWith(':')) aligns.push('right');
            else aligns.push('left');
          }
        }

        const rows: string[][] = [];
        for (let r = dataStartIndex; r < tableLines.length; r++) {
          const cells = tableLines[r]
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          rows.push(cells);
        }

        nodes.push({
          type: 'table',
          headers: headerCells,
          rows,
          align: aligns.length ? aligns : undefined,
        } as TableNode);
        continue;
      }
    }

    // 7. Lists (ordered or unordered)
    const isUnordered = /^[-*+]\s+/.test(line);
    const isOrdered = /^\d+\.\s+/.test(line);

    if (isUnordered || isOrdered) {
      const ordered = isOrdered;
      const items: ListItem[] = [];

      while (i < lines.length) {
        const curLine = lines[i];
        const trimmed = curLine.trim();
        if (!trimmed) break;

        const uMatch = trimmed.match(/^[-*+]\s+(.+)$/);
        const oMatch = trimmed.match(/^\d+\.\s+(.+)$/);

        if ((ordered && oMatch) || (!ordered && uMatch)) {
          let itemText = (ordered ? oMatch![1] : uMatch![1]).trim();
          let checked: boolean | undefined = undefined;

          // Check for task list checkbox
          if (itemText.startsWith('[ ] ')) {
            checked = false;
            itemText = itemText.slice(4).trim();
          } else if (itemText.startsWith('[x] ') || itemText.startsWith('[X] ')) {
            checked = true;
            itemText = itemText.slice(4).trim();
          }

          items.push({ text: itemText, checked });
          i++;
        } else if (curLine.startsWith('   ') || curLine.startsWith('\t')) {
          // Sub-item attached to previous list item
          if (items.length > 0) {
            const last = items[items.length - 1];
            if (!last.subItems) last.subItems = [];
            last.subItems.push(trimmed.replace(/^[-*+\d.]+\s*/, ''));
          }
          i++;
        } else {
          break;
        }
      }

      nodes.push({
        type: 'list',
        ordered,
        items,
      } as ListNode);
      continue;
    }

    // 8. Regular Paragraphs
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrim = cur.trim();
      if (!curTrim) break;
      if (
        curTrim.startsWith('#') ||
        curTrim.startsWith('```') ||
        curTrim.startsWith('>') ||
        curTrim === '---' ||
        (curTrim.startsWith('|') && curTrim.endsWith('|')) ||
        /^[-*+]\s+/.test(curTrim) ||
        /^\d+\.\s+/.test(curTrim)
      ) {
        break;
      }
      paraLines.push(curTrim);
      i++;
    }

    if (paraLines.length > 0) {
      const pText = paraLines.join(' ');
      // If we don't have a subtitle yet and it's right after the title, use it
      if (mainTitle && !subtitle && nodes.length === 0 && pText.length < 250) {
        subtitle = pText;
      } else {
        nodes.push({
          type: 'paragraph',
          text: pText,
        } as ParagraphNode);
      }
    }
  }

  const resolvedTitle = mainTitle || fallbackTitle;

  return {
    version: 2,
    title: resolvedTitle,
    subtitle: subtitle || undefined,
    template,
    includeToc: includeToc && tocEntries.length >= 2,
    metadata: {
      author,
      date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      version: '1.0',
    },
    nodes,
    tocEntries,
  };
}
