import React, { useState, createContext, useContext, type ReactNode, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ArrowUpRight, Check, Copy, PanelsRightBottom, Download, FileArchive } from 'lucide-react';
import 'katex/dist/katex.min.css';
import {
  parseInteractiveBlock,
  InteractiveBlockRenderer,
  InteractiveBlockSkeleton,
} from './interactive-blocks';
import { detectUniversalInteractiveContent } from './interactive-blocks/interactive-detector';
import { useOptionalCanvas } from './canvas/CanvasContext';
import { downloadZip } from '@/lib/zip-export';

export interface MarkdownContextValue {
  messageId?: string;
  isStreaming?: boolean;
}

export const MarkdownContext = createContext<MarkdownContextValue>({
  messageId: undefined,
  isStreaming: false,
});

/**
 * Normalizes common model math outputs while strictly preserving code blocks and inline code untouched.
 * Handles:
 * - LaTeX display math: \[ ... \] -> $$ ... $$
 * - LaTeX inline math: \( ... \) -> $ ... $
 * - Escaped dollar math delimiters: \$ ... \$ -> $ ... $
 */
export function normalizeMathInMarkdown(raw: string): string {
  if (!raw) return '';
  // Split by fenced code blocks (```...```) and inline code (`...`)
  const parts = raw.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts.map((part, index) => {
    // Odd index parts are code spans and must never be altered
    if (index % 2 === 1) return part;

    let text = part;
    // 1. Convert display math: \[ ... \] to $$ ... $$
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, math: string) => `$$\n${math.trim()}\n$$`);
    // 2. Convert inline math: \( ... \) to $ ... $
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, math: string) => `$${math.trim()}$`);
    // 3. Convert escaped dollar math delimiters: \$...\$ to $...$
    text = text.replace(/\\\$([^\s$][^$]*?[^\s$]?)\\\$/g, (_m, math: string) => `$${math.trim()}$`);
    return text;
  }).join('');
}

function nodeText(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join('');
  if (n && typeof n === 'object' && 'props' in n) return nodeText((n as { props: { children?: ReactNode } }).props.children);
  return '';
}

function highlightedCode(source: string): ReactNode[] {
  const token = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|new|async|await|import|from|export|default|throw|try|catch|true|false|null|undefined|def|print|lambda|pass|self|public|private|static|void|int|string|boolean|interface|type|extends|implements|SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE)\b|\b\d+(?:\.\d+)?\b)/g;
  const result: ReactNode[] = [];
  let cursor = 0, index = 0, match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match.index > cursor) result.push(source.slice(cursor, match.index));
    const value = match[0];
    const kind = /^(\/\*|\/\/|#)/.test(value) ? 'comment' : /^(["'`])/.test(value) ? 'string' : /^\d/.test(value) ? 'number' : 'keyword';
    result.push(<span key={index++} className={`chat-token-${kind}`}>{value}</span>);
    cursor = match.index + value.length;
  }
  if (cursor < source.length) result.push(source.slice(cursor));
  return result;
}

export function CodeBlock({ children }: { children?: ReactNode }) {
  const { messageId, isStreaming } = useContext(MarkdownContext);
  const canvas = useOptionalCanvas();
  const [copied, setCopied] = useState(false);
  const text = nodeText(children).replace(/\n$/, '');
  const first = Array.isArray(children) ? children[0] : children;
  const rawLang = first && typeof first === 'object' && 'props' in first
    ? String((first as { props: { className?: string } }).props.className ?? '').replace('language-', '')
    : '';
  const language = rawLang.trim().toUpperCase() || 'CODE';

  // Check if this is an interactive block
  if (/^(interactive|interactive-block|ayatrisya-block|ayatrisya-interactive|quiz|mcq)$/i.test(rawLang.trim()) || (rawLang.trim().toLowerCase() === 'json' && /"type"\s*:\s*"(quiz|mcq|poll|flashcards|accordion|input_controls)"/.test(text))) {
    const parsed = parseInteractiveBlock(text, { isStreaming });
    if (parsed.status === 'valid') {
      const blockId = messageId ? `${messageId}:${parsed.block.id || parsed.block.type}` : parsed.block.id;
      return <InteractiveBlockRenderer block={parsed.block} blockId={blockId} fallbackRaw={text} />;
    }
    if (parsed.status === 'streaming_incomplete') {
      return <InteractiveBlockSkeleton />;
    }
    // If invalid, fall back gracefully to the code block view below
  }

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  return (
    <div className="chat-code group relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d0e12] shadow-md" data-testid="code-block">
      <div className="chat-code-head flex items-center justify-between border-b border-white/[.08] bg-white/[.03] px-3.5 py-1.5 text-xs text-slate-400">
        <span className="font-mono text-[11px] font-medium tracking-wider text-slate-300">{language}</span>
        <div className="flex items-center gap-1.5">
          {canvas && (
            <button
              type="button"
              onClick={() => {
                const ext = language.toLowerCase();
                const extMap: Record<string, string> = {
                  typescript: 'ts',
                  javascript: 'js',
                  python: 'py',
                  html: 'html',
                  css: 'css',
                  json: 'json',
                  markdown: 'md',
                  rust: 'rs',
                  go: 'go',
                  sql: 'sql',
                };
                const extension = extMap[ext] || (ext.length <= 4 && ext !== 'code' ? ext : 'txt');
                const filename = `code-${Date.now().toString().slice(-4)}.${extension}`;
                canvas.openCanvas({
                  name: filename,
                  content: text,
                  language: ext !== 'code' ? ext : 'typescript',
                });
                // Also open dedicated full-screen tab
                window.open('/workspace/canvas', '_blank');
              }}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-teal-300/90 transition-colors hover:bg-teal-500/10 hover:text-teal-200"
              data-testid="button-open-in-canvas"
              title="Open in interactive Canvas IDE"
            >
              <PanelsRightBottom size={12} />
              <span>Canvas IDE</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const ext = language.toLowerCase();
              const extMap: Record<string, string> = {
                typescript: 'ts',
                javascript: 'js',
                python: 'py',
                html: 'html',
                css: 'css',
                json: 'json',
                markdown: 'md',
                rust: 'rs',
                go: 'go',
                sql: 'sql',
              };
              const extension = extMap[ext] || (ext.length <= 4 && ext !== 'code' ? ext : 'txt');
              const filename = `snippet-${Date.now().toString().slice(-4)}.${extension}`;
              downloadZip(filename.replace(/\.[^.]+$/, ''), [
                { path: filename, data: text }
              ]);
            }}
            className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white"
            data-testid="button-download-zip"
            title="Download as .ZIP"
          >
            <FileArchive size={12} className="text-amber-300" />
            <span>.ZIP</span>
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white"
            data-testid="button-copy-code"
            aria-label={copied ? 'Code copied' : 'Copy code'}
          >
            {copied ? <Check size={12} className="text-teal-300" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
        <code>{highlightedCode(text)}</code>
      </pre>
    </div>
  );
}

export const mdComponents = {
  pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children, ...props }: { className?: string; children?: ReactNode }) => {
    // If it has a language- class, it will be handled inside pre/CodeBlock
    const isBlock = className && /language-/.test(className);
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code className="rounded border border-white/10 bg-white/[.06] px-1.5 py-0.5 font-mono text-[12.5px] text-teal-200/90" {...props}>
        {children}
      </code>
    );
  },
  a: ({ href, children }: { href?: string; children?: ReactNode }) => {
    const safe = href && /^(https?:|mailto:|\/|#)/i.test(href);
    if (!safe) return <span>{children}</span>;
    const isExt = href.startsWith('http');
    return (
      <a
        href={href}
        target={isExt ? '_blank' : undefined}
        rel={isExt ? 'noopener noreferrer nofollow' : undefined}
        className="inline-flex items-center text-teal-300 underline underline-offset-2 transition-colors hover:text-teal-200"
      >
        {children}
        {isExt && <ArrowUpRight className="ml-0.5 inline-block shrink-0" size={12} aria-hidden />}
      </a>
    );
  },
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <img
      src={src}
      alt={alt || 'Image'}
      className="my-2.5 max-h-80 max-w-full rounded-lg border border-white/10 object-contain shadow-sm"
      loading="lazy"
    />
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="chat-table-wrap my-3 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-white/10 bg-white/[.04] px-3.5 py-2 font-semibold text-slate-200">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-white/[.06] px-3.5 py-2 text-slate-300">{children}</td>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-teal-400/60 bg-white/[.02] py-1 pl-4 italic text-slate-300">
      {children}
    </blockquote>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-slate-200">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-slate-200">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mt-4 mb-2 text-lg font-bold tracking-tight text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-3.5 mb-1.5 text-base font-semibold tracking-tight text-white">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold text-slate-100">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mt-2.5 mb-1 text-xs font-semibold uppercase tracking-wider text-slate-300">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-1.5 leading-relaxed text-slate-200">{children}</p>
  ),
};

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  messageId?: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  messageId,
  isStreaming,
}: MarkdownRendererProps) {
  const trimmed = (content || '').trim();

  // If the entire message content is a standalone JSON interactive block
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const directParse = parseInteractiveBlock(trimmed, { isStreaming });
    if (directParse.status === 'valid') {
      return (
        <div className={className}>
          <InteractiveBlockRenderer
            block={directParse.block}
            blockId={messageId}
            fallbackRaw={trimmed}
          />
        </div>
      );
    }
    if (directParse.status === 'streaming_incomplete') {
      return (
        <div className={className}>
          <InteractiveBlockSkeleton />
        </div>
      );
    }
  }

  // Detect structured interactive content (quizzes, MCQs, or interactive comparison tables)
  const detected = !isStreaming ? detectUniversalInteractiveContent(trimmed) : null;
  if (detected && detected.block) {
    const intro = detected.beforeText ? normalizeMathInMarkdown(detected.beforeText) : null;
    const outro = detected.afterText ? normalizeMathInMarkdown(detected.afterText) : null;
    const blockId = messageId ? `${messageId}:${detected.block.id || detected.block.type}` : detected.block.id;
    return (
      <MarkdownContext.Provider value={{ messageId, isStreaming }}>
        <div className={className}>
          {intro && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
              components={mdComponents}
            >
              {intro}
            </ReactMarkdown>
          )}
          <div className="my-3">
            <InteractiveBlockRenderer
              block={detected.block}
              blockId={blockId}
              fallbackRaw=""
            />
          </div>
          {outro && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
              components={mdComponents}
            >
              {outro}
            </ReactMarkdown>
          )}
        </div>
      </MarkdownContext.Provider>
    );
  }

  const normalized = normalizeMathInMarkdown(content);
  return (
    <MarkdownContext.Provider value={{ messageId, isStreaming }}>
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          components={mdComponents}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    </MarkdownContext.Provider>
  );
});
