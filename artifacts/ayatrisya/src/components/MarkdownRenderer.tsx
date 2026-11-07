import React, { useState, createContext, useContext, type ReactNode, memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  ArrowUpRight,
  Check,
  Copy,
  PanelsRightBottom,
  Download,
  FileArchive,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Hash,
  Terminal,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import 'katex/dist/katex.min.css';
import {
  parseInteractiveBlock,
  InteractiveBlockRenderer,
  InteractiveBlockSkeleton,
  DiagramBlockRenderer,
  CitationBlockRenderer,
  ArtifactBlockRenderer,
} from './interactive-blocks';
import { detectUniversalInteractiveContent } from './interactive-blocks/interactive-detector';
import { useOptionalCanvas } from './canvas/CanvasContext';
import { downloadZip } from '@/lib/zip-export';
import { parseModelResponseToProtocol } from '@/ai/protocol/parser';
import type { CitationBlock, UnifiedMessageResponse } from '@/ai/protocol/types';

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
 */
export function normalizeMathInMarkdown(raw: string): string {
  if (!raw) return '';
  const parts = raw.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      let text = part;
      text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, math: string) => `$$\n${math.trim()}\n$$`);
      text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, math: string) => `$${math.trim()}$`);
      text = text.replace(/\\\$([^\s$][^$]*?[^\s$]?)\\\$/g, (_m, math: string) => `$${math.trim()}$`);
      return text;
    })
    .join('');
}

function nodeText(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join('');
  if (n && typeof n === 'object' && 'props' in n) {
    return nodeText((n as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function highlightedCode(source: string): ReactNode[] {
  const token =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|new|async|await|import|from|export|default|throw|try|catch|true|false|null|undefined|def|print|lambda|pass|self|public|private|static|void|int|string|boolean|interface|type|extends|implements|SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE)\b|\b\d+(?:\.\d+)?\b)/g;
  const result: ReactNode[] = [];
  let cursor = 0,
    index = 0,
    match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match.index > cursor) result.push(source.slice(cursor, match.index));
    const value = match[0];
    const kind = /^(\/\*|\/\/|#)/.test(value)
      ? 'comment'
      : /^(["'`])/.test(value)
      ? 'string'
      : /^\d/.test(value)
      ? 'number'
      : 'keyword';
    result.push(
      <span key={index++} className={`chat-token-${kind}`}>
        {value}
      </span>
    );
    cursor = match.index + value.length;
  }
  if (cursor < source.length) result.push(source.slice(cursor));
  return result;
}

export function CodeBlock({ children }: { children?: ReactNode }) {
  const { messageId, isStreaming } = useContext(MarkdownContext);
  const canvas = useOptionalCanvas();
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<{ logs: string[]; error?: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const text = nodeText(children).replace(/\n$/, '');
  const first = Array.isArray(children) ? children[0] : children;
  const rawLang =
    first && typeof first === 'object' && 'props' in first
      ? String((first as { props: { className?: string } }).props.className ?? '').replace('language-', '')
      : '';
  const langLower = rawLang.trim().toLowerCase();
  const language = rawLang.trim().toUpperCase() || 'CODE';

  // Automatic diagram/flowchart detection
  if (/^(mermaid|flowchart|sequenceDiagram|stateDiagram|erDiagram)$/i.test(langLower)) {
    return (
      <DiagramBlockRenderer
        block={{
          version: '1.0',
          type: 'diagram',
          diagramType: langLower.includes('mermaid') ? 'mermaid' : 'flowchart',
          code: text,
          title: `${language} Diagram`,
        }}
      />
    );
  }

  // Automatic Artifact Previews (Website, Spreadsheet, Presentation, Document)
  if (/^(website|html-preview|web-preview)$/i.test(langLower)) {
    return (
      <ArtifactBlockRenderer
        block={{
          type: 'artifact',
          artifactKind: 'website',
          title: 'Interactive Website Preview',
          content: text,
        }}
      />
    );
  }
  if (/^(spreadsheet|csv-preview|table-preview)$/i.test(langLower)) {
    return (
      <ArtifactBlockRenderer
        block={{
          type: 'artifact',
          artifactKind: 'spreadsheet',
          title: 'Live Spreadsheet',
          content: text,
        }}
      />
    );
  }
  if (/^(presentation|slides|deck|ppt|pptx|powerpoint)$/i.test(langLower)) {
    return (
      <ArtifactBlockRenderer
        block={{
          type: 'artifact',
          artifactKind: 'presentation',
          title: 'Presentation Slides',
          content: text,
        }}
      />
    );
  }
  if (/^(document|doc-preview|report|pdf|docx|word)$/i.test(langLower)) {
    return (
      <ArtifactBlockRenderer
        block={{
          type: 'artifact',
          artifactKind: 'document',
          title: 'Structured Document',
          content: text,
        }}
      />
    );
  }
  if (langLower === 'artifact') {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return <ArtifactBlockRenderer block={{ type: 'artifact', ...parsed }} />;
      }
    } catch {}
    return (
      <ArtifactBlockRenderer
        block={{
          type: 'artifact',
          artifactKind: text.includes('<html') ? 'website' : 'document',
          title: 'Artifact',
          content: text,
        }}
      />
    );
  }

  // Check if this is an interactive block
  if (
    /^(interactive|interactive-block|ayatrisya-block|ayatrisya-interactive|quiz|mcq|assessment|exam|mock-test)$/i.test(langLower) ||
    (langLower === 'json' && /"type"\s*:\s*"(quiz|mcq|poll|flashcards|accordion|input_controls|chart|assessment|mock_test|exam)"/.test(text))
  ) {
    const parsed = parseInteractiveBlock(text, { isStreaming });
    if (parsed.status === 'valid') {
      const blockId = messageId ? `${messageId}:${parsed.block.id || parsed.block.type}` : parsed.block.id;
      return <InteractiveBlockRenderer block={parsed.block} blockId={blockId} fallbackRaw={text} />;
    }
    if (parsed.status === 'streaming_incomplete') {
      return <InteractiveBlockSkeleton />;
    }
  }

  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  const getExtension = (lang: string) => {
    const ext = lang.toLowerCase();
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
      sh: 'sh',
      bash: 'sh',
    };
    return extMap[ext] || (ext.length <= 4 && ext !== 'code' ? ext : 'txt');
  };

  const downloadSingleFile = () => {
    const ext = getExtension(langLower);
    const filename = `code-${Date.now().toString().slice(-4)}.${ext}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Supported client-side execution environments
  const isRunnable = ['javascript', 'js', 'ts', 'typescript'].includes(langLower);

  const runCode = () => {
    if (!isRunnable) return;
    setIsRunning(true);
    setExecutionOutput(null);

    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      warn: (...args: any[]) => logs.push(`[WARN] ` + args.map((a) => String(a)).join(' ')),
      error: (...args: any[]) => logs.push(`[ERROR] ` + args.map((a) => String(a)).join(' ')),
      info: (...args: any[]) => logs.push(args.map((a) => String(a)).join(' ')),
    };

    try {
      // Execute in isolated function context with captured console
      const runner = new Function('console', `"use strict";\n${text}`);
      const result = runner(customConsole);
      if (result !== undefined) {
        logs.push(`=> ${typeof result === 'object' ? JSON.stringify(result) : String(result)}`);
      }
      setExecutionOutput({ logs: logs.length > 0 ? logs : ['Execution completed with no console output.'] });
    } catch (err: any) {
      setExecutionOutput({
        logs,
        error: err?.message || String(err),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const lines = text.split('\n');
  const isLong = lines.length > 15;

  return (
    <div
      className="chat-code group relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d0e12] shadow-md"
      data-testid="code-block"
    >
      <div className="chat-code-head flex flex-wrap items-center justify-between gap-1 border-b border-white/[.08] bg-white/[.03] px-3.5 py-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium tracking-wider text-slate-300">{language}</span>
          <span className="text-[10px] text-slate-500">({lines.length} lines)</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Runnable execution button */}
          {isRunnable && (
            <button
              type="button"
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center gap-1 rounded bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-300 transition-colors hover:bg-teal-500/25 disabled:opacity-50"
              data-testid="button-run-code"
              title="Run sandboxed JavaScript in browser"
            >
              <Play size={11} className={isRunning ? 'animate-spin' : ''} />
              <span>{isRunning ? 'Running...' : 'Run'}</span>
            </button>
          )}

          {/* Line numbers toggle */}
          <button
            type="button"
            onClick={() => setShowLineNumbers((prev) => !prev)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
              showLineNumbers ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:bg-white/[.08] hover:text-white'
            }`}
            title="Toggle line numbers"
            data-testid="button-toggle-line-numbers"
          >
            <Hash size={11} />
          </button>

          {/* Collapse/Expand for long code */}
          {isLong && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-white/[.08] hover:text-white"
              title={isCollapsed ? 'Expand code' : 'Collapse code'}
              data-testid="button-toggle-code-collapse"
            >
              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          )}

          {/* Canvas IDE */}
          {canvas && (
            <button
              type="button"
              onClick={() => {
                const ext = getExtension(langLower);
                const filename = `code-${Date.now().toString().slice(-4)}.${ext}`;
                canvas.openCanvas({
                  name: filename,
                  content: text,
                  language: ext !== 'code' ? ext : 'typescript',
                });
                window.open('/workspace/canvas', '_blank');
              }}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-teal-300/90 transition-colors hover:bg-teal-500/10 hover:text-teal-200"
              data-testid="button-open-in-canvas"
              title="Open in interactive Canvas IDE"
            >
              <PanelsRightBottom size={11} />
              <span className="hidden sm:inline">Canvas</span>
            </button>
          )}

          {/* Direct File Download */}
          <button
            type="button"
            onClick={downloadSingleFile}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white"
            data-testid="button-download-code-file"
            title="Download source file"
          >
            <Download size={11} />
            <span className="hidden sm:inline">File</span>
          </button>

          {/* ZIP Download */}
          <button
            type="button"
            onClick={() => {
              const ext = getExtension(langLower);
              const filename = `snippet-${Date.now().toString().slice(-4)}.${ext}`;
              downloadZip(filename.replace(/\.[^.]+$/, ''), [{ path: filename, data: text }]);
            }}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white"
            data-testid="button-download-zip"
            title="Download as .ZIP"
          >
            <FileArchive size={11} className="text-amber-300" />
            <span className="hidden sm:inline">.ZIP</span>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white"
            data-testid="button-copy-code"
            aria-label={copied ? 'Code copied' : 'Copy code'}
          >
            {copied ? <Check size={11} className="text-teal-300" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code body */}
      <pre
        className={`overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-slate-200 ${
          isCollapsed ? 'max-h-36 overflow-y-hidden relative' : ''
        }`}
      >
        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-[#0d0e12] to-transparent pb-2">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white shadow hover:bg-white/20"
            >
              Show all {lines.length} lines
            </button>
          </div>
        )}
        <code>
          {showLineNumbers ? (
            <div className="table w-full">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row">
                  <span className="table-cell select-none pr-3 text-right font-mono text-[11px] text-slate-600">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre">{highlightedCode(line)}</span>
                </div>
              ))}
            </div>
          ) : (
            highlightedCode(text)
          )}
        </code>
      </pre>

      {/* Execution Output Panel */}
      {executionOutput && (
        <div
          data-testid="code-execution-output"
          className="border-t border-white/10 bg-[#07080a] p-3 text-xs font-mono"
        >
          <div className="mb-2 flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-teal-300">
              <Terminal size={12} /> Execution Output
            </span>
            <button
              type="button"
              onClick={() => setExecutionOutput(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Dismiss
            </button>
          </div>
          {executionOutput.logs.length > 0 && (
            <div className="space-y-1 text-slate-200">
              {executionOutput.logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {log}
                </div>
              ))}
            </div>
          )}
          {executionOutput.error && (
            <div className="mt-2 flex items-start gap-1.5 rounded bg-rose-500/10 p-2 text-rose-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div className="whitespace-pre-wrap">{executionOutput.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const mdComponents = {
  pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children, ...props }: { className?: string; children?: ReactNode }) => {
    const isBlock = className && /language-/.test(className);
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded border border-white/10 bg-white/[.06] px-1.5 py-0.5 font-mono text-[12.5px] text-teal-200/90"
        {...props}
      >
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
  li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
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
  p: ({ children }: { children?: ReactNode }) => <p className="my-1.5 leading-relaxed text-slate-200">{children}</p>,
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

  // 1. Unconditionally compute protocol response & citation blocks at top of hook
  const protocolResponse = useMemo(() => {
    if (!trimmed || isStreaming) return null;
    return parseModelResponseToProtocol(trimmed, messageId);
  }, [trimmed, messageId, isStreaming]);

  const citationBlocks = useMemo(() => {
    if (!protocolResponse) return [];
    return protocolResponse.blocks.filter((b): b is CitationBlock => b.type === 'citation');
  }, [protocolResponse]);

  // 2. If content is a standalone JSON interactive block
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const directParse = parseInteractiveBlock(trimmed, { isStreaming });
    if (directParse.status === 'valid') {
      return (
        <div className={className}>
          <InteractiveBlockRenderer block={directParse.block} blockId={messageId} fallbackRaw={trimmed} />
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

  // 3. Detect structured interactive content (quizzes, MCQs, or interactive comparison tables)
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
            <InteractiveBlockRenderer block={detected.block} blockId={blockId} fallbackRaw="" />
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
          {citationBlocks.length > 0 && (
            <CitationBlockRenderer
              citations={citationBlocks.flatMap((c) =>
                (c.sources || []).map((s, idx) => ({
                  id: s.id,
                  index: idx + 1,
                  title: s.title,
                  url: s.url || '#',
                  snippet: s.snippet,
                  domain: s.domain,
                  isVerified: s.verified,
                }))
              )}
            />
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
        {citationBlocks.length > 0 && (
          <CitationBlockRenderer
            citations={citationBlocks.flatMap((c) =>
              (c.sources || []).map((s, idx) => ({
                id: s.id,
                index: idx + 1,
                title: s.title,
                url: s.url || '#',
                snippet: s.snippet,
                domain: s.domain,
                isVerified: s.verified,
              }))
            )}
          />
        )}
      </div>
    </MarkdownContext.Provider>
  );
});
