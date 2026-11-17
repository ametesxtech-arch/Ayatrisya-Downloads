import React from 'react';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  Copy,
  Info,
  AlertTriangle,
  Lightbulb,
  Bookmark,
  Square,
  User,
  Hash,
} from 'lucide-react';
import type { DocumentAst, DocumentNode } from './types';

export function DocumentViewer({
  ast,
  className = '',
}: {
  ast: DocumentAst;
  className?: string;
}) {
  const [copiedCode, setCopiedCode] = React.useState<number | null>(null);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(idx);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const getCalloutIcon = (variant: string) => {
    switch (variant) {
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />;
      case 'tip':
        return <Lightbulb size={16} className="text-emerald-400 shrink-0 mt-0.5" />;
      case 'note':
        return <Bookmark size={16} className="text-sky-400 shrink-0 mt-0.5" />;
      default:
        return <Info size={16} className="text-violet-400 shrink-0 mt-0.5" />;
    }
  };

  const getCalloutClasses = (variant: string) => {
    switch (variant) {
      case 'warning':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
      case 'tip':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
      case 'note':
        return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
      default:
        return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
    }
  };

  return (
    <div
      className={`mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0c0d12] p-6 sm:p-10 md:p-14 text-slate-200 shadow-2xl ${className}`}
      data-testid="document-ast-viewer"
    >
      {/* Header / Document Metadata */}
      <header className="border-b border-white/10 pb-8 mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
            <BookOpen size={12} />
            {ast.template.toUpperCase()}
          </span>
          {ast.metadata.classification && (
            <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] text-slate-300">
              {ast.metadata.classification}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white display">
          {ast.title}
        </h1>

        {ast.subtitle && (
          <p className="mt-3 text-lg sm:text-xl text-slate-400 font-normal leading-relaxed max-w-3xl">
            {ast.subtitle}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          {ast.metadata.author && (
            <span className="inline-flex items-center gap-1.5">
              <User size={13} className="text-slate-500" />
              {ast.metadata.author}
            </span>
          )}
          {ast.metadata.date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-500" />
              {ast.metadata.date}
            </span>
          )}
          {ast.metadata.version && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              v{ast.metadata.version}
            </span>
          )}
        </div>
      </header>

      {/* Table of Contents */}
      {ast.includeToc && ast.tocEntries.length > 0 && (
        <nav
          aria-label="Table of contents"
          className="mb-10 rounded-xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6"
          data-testid="document-toc"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
            <Hash size={14} className="text-violet-400" />
            Table of Contents
          </div>
          <ul className="space-y-1.5 text-xs sm:text-sm">
            {ast.tocEntries.map((toc) => (
              <li
                key={toc.id}
                style={{ paddingLeft: `${Math.max(0, toc.level - 2) * 16}px` }}
              >
                <a
                  href={`#${toc.id}`}
                  className="text-violet-400 hover:text-violet-300 hover:underline transition-colors flex items-center justify-between group"
                >
                  <span className="truncate group-hover:translate-x-0.5 transition-transform">
                    {toc.text}
                  </span>
                  <span className="text-slate-600 font-mono text-xs opacity-60">
                    §{toc.level}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Body Content Nodes */}
      <div className="space-y-6 leading-relaxed">
        {ast.nodes.map((node, idx) => {
          switch (node.type) {
            case 'heading': {
              const Tag = `h${Math.min(Math.max(node.level, 1), 6)}` as
                | 'h1'
                | 'h2'
                | 'h3'
                | 'h4'
                | 'h5'
                | 'h6';
              const sizeClasses =
                node.level === 1
                  ? 'text-2xl sm:text-3xl font-bold text-white pt-6 border-b border-white/10 pb-2'
                  : node.level === 2
                  ? 'text-xl sm:text-2xl font-bold text-slate-100 pt-5'
                  : node.level === 3
                  ? 'text-lg sm:text-xl font-semibold text-slate-200 pt-3'
                  : 'text-base font-semibold text-slate-300 pt-2';

              return (
                <Tag
                  key={idx}
                  id={node.id}
                  className={`${sizeClasses} tracking-tight scroll-mt-20`}
                >
                  {node.text}
                </Tag>
              );
            }

            case 'paragraph':
              return (
                <p key={idx} className="text-sm sm:text-base text-slate-300 font-normal leading-7">
                  {node.text}
                </p>
              );

            case 'callout':
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 sm:p-5 text-xs sm:text-sm flex gap-3 ${getCalloutClasses(
                    node.variant
                  )}`}
                >
                  {getCalloutIcon(node.variant)}
                  <div className="space-y-1">
                    {node.title && (
                      <div className="font-semibold tracking-wide uppercase text-xs opacity-90">
                        {node.title}
                      </div>
                    )}
                    <p className="leading-relaxed opacity-95">{node.text}</p>
                  </div>
                </div>
              );

            case 'blockquote':
              return (
                <blockquote
                  key={idx}
                  className="border-l-4 border-violet-500/60 bg-violet-500/[.03] pl-5 py-3 pr-4 rounded-r-lg italic text-slate-200"
                >
                  <p className="text-sm sm:text-base">“{node.text}”</p>
                  {node.citation && (
                    <footer className="mt-2 text-xs text-slate-400 not-italic font-medium">
                      — {node.citation}
                    </footer>
                  )}
                </blockquote>
              );

            case 'table':
              return (
                <div key={idx} className="my-6 overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead className="bg-white/[.05] border-b border-white/10 text-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        {node.headers.map((h, hIdx) => (
                          <th
                            key={hIdx}
                            className="p-3 sm:p-3.5 font-semibold"
                            style={{ textAlign: node.align?.[hIdx] || 'left' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.06]">
                      {node.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-white/[.02] transition-colors odd:bg-white/[.01]"
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="p-3 sm:p-3.5 text-slate-300"
                              style={{ textAlign: node.align?.[cIdx] || 'left' }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {node.caption && (
                    <div className="p-2 text-center text-xs text-slate-500 italic bg-white/[.02]">
                      {node.caption}
                    </div>
                  )}
                </div>
              );

            case 'list': {
              const ListTag = node.ordered ? 'ol' : 'ul';
              return (
                <ListTag
                  key={idx}
                  className={`space-y-2 text-sm sm:text-base text-slate-300 pl-6 ${
                    node.ordered ? 'list-decimal' : 'list-disc'
                  }`}
                >
                  {node.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="leading-relaxed">
                      {item.checked !== undefined ? (
                        <span className="inline-flex items-center gap-2">
                          {item.checked ? (
                            <CheckSquare size={14} className="text-emerald-400 inline shrink-0" />
                          ) : (
                            <Square size={14} className="text-slate-500 inline shrink-0" />
                          )}
                          <span className={item.checked ? 'line-through text-slate-500' : ''}>
                            {item.text}
                          </span>
                        </span>
                      ) : (
                        item.text
                      )}
                      {item.subItems && item.subItems.length > 0 && (
                        <ul className="mt-1.5 space-y-1 pl-5 list-circle text-xs sm:text-sm text-slate-400">
                          {item.subItems.map((sub, sIdx) => (
                            <li key={sIdx}>{sub}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ListTag>
              );
            }

            case 'code':
              return (
                <div key={idx} className="my-5 rounded-xl border border-white/10 bg-[#06070a] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/[.08] bg-white/[.03] text-xs text-slate-400">
                    <span className="font-mono">{node.language || 'code'}</span>
                    <button
                      type="button"
                      onClick={() => copyCode(node.code, idx)}
                      className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <Copy size={12} />
                      {copiedCode === idx ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto font-mono text-xs text-violet-200/90 leading-relaxed">
                    <code>{node.code}</code>
                  </pre>
                </div>
              );

            case 'pageBreak':
              return (
                <div key={idx} className="my-10 flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex-1 border-t border-dashed border-white/10" />
                  <span className="uppercase tracking-widest font-mono text-[10px]">Page Break</span>
                  <div className="flex-1 border-t border-dashed border-white/10" />
                </div>
              );

            default:
              return null;
          }
        })}
      </div>

      {/* Document Footer */}
      <footer className="mt-14 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div>Generated with Ayatrisya Document Engine</div>
        <div>Confidential & Proprietary</div>
      </footer>
    </div>
  );
}

