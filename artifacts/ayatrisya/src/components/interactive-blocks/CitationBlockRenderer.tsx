import React from 'react';
import { ExternalLink, BookmarkCheck, Globe, ShieldAlert } from 'lucide-react';

export interface CitationItem {
  id?: string;
  index?: number;
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
  sourceType?: 'web' | 'document' | 'knowledge' | 'memory';
  isVerified?: boolean;
}

export interface CitationBlockProps {
  citations: CitationItem[];
  title?: string;
}

export function CitationBlockRenderer({ citations, title = 'Sources & Citations' }: CitationBlockProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div
      className="interactive-citations my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-citation-block"
      role="region"
      aria-label={title}
    >
      <div className="mb-3.5 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
            <BookmarkCheck size={14} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            {title} ({citations.length})
          </h4>
        </div>
        <span className="text-[10px] text-slate-400">Click source to open external reference</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {citations.map((c, i) => {
          const indexNum = c.index ?? i + 1;
          let domainName = c.domain;
          let isSafe = true;

          try {
            const parsed = new URL(c.url);
            domainName = domainName || parsed.hostname;
            isSafe = ['http:', 'https:'].includes(parsed.protocol);
          } catch {
            isSafe = false;
            domainName = domainName || 'unknown source';
          }

          return (
            <div
              key={c.id || i}
              className="group relative flex flex-col justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 transition-colors hover:border-emerald-500/40 hover:bg-white/[0.04]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                      {indexNum}
                    </span>
                    <span className="flex items-center gap-1 truncate text-[11px] text-slate-400">
                      <Globe size={11} className="shrink-0 text-slate-400" />
                      <span className="truncate">{domainName}</span>
                    </span>
                  </div>
                  {c.isVerified && (
                    <span className="shrink-0 rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                      Verified
                    </span>
                  )}
                </div>

                <div className="mt-1.5">
                  {isSafe ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-100 transition-colors group-hover:text-emerald-300 hover:underline"
                    >
                      <span className="line-clamp-2">{c.title || c.url}</span>
                      <ExternalLink size={11} className="shrink-0 opacity-70 group-hover:opacity-100" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-300">
                      <ShieldAlert size={12} />
                      <span className="truncate">{c.title || 'Blocked unsafe URL'}</span>
                    </span>
                  )}
                </div>

                {c.snippet && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                    "{c.snippet}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

