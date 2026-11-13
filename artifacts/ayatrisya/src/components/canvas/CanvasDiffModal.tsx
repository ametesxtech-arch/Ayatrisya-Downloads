import React, { useState } from 'react';
import { Check, X, Split, Layers, FileCode } from 'lucide-react';
import type { CanvasDiff } from './types';
import { cx } from '@/lib/cx';

interface CanvasDiffModalProps {
  diff: CanvasDiff | null;
  onAccept: () => void;
  onReject: () => void;
}

export function CanvasDiffModal({ diff, onAccept, onReject }: CanvasDiffModalProps) {
  const [diffView, setDiffView] = useState<'split' | 'unified'>('unified');

  if (!diff) return null;

  const originalLines = diff.original.split('\n');
  const proposedLines = diff.proposed.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md">
      <div className="flex h-full max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-violet-500/30 bg-[#12111b] shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#161524] px-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded p-1.5 bg-violet-500/20 text-violet-300">
              <FileCode size={15} />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                Review AI Changes
                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300 font-mono">
                  {diff.path}
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10">
              <button
                type="button"
                onClick={() => setDiffView('unified')}
                className={cx(
                  'px-2 py-1 rounded text-[11px] transition flex items-center gap-1',
                  diffView === 'unified' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                )}
              >
                <Layers size={11} />
                Unified
              </button>
              <button
                type="button"
                onClick={() => setDiffView('split')}
                className={cx(
                  'px-2 py-1 rounded text-[11px] transition flex items-center gap-1',
                  diffView === 'split' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                )}
              >
                <Split size={11} />
                Split
              </button>
            </div>

            <button
              type="button"
              onClick={onReject}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Diff Surface */}
        <div className="flex-1 min-h-0 overflow-auto p-4 bg-[#09080e]">
          {diffView === 'unified' ? (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-rose-400 bg-rose-950/30 px-2.5 py-1 rounded border border-rose-500/20">
                Original Code (-):
              </div>
              <div className="space-y-0.5">
                {originalLines.map((line, idx) => (
                  <div key={`orig-${idx}`} className="flex items-start bg-rose-950/20 text-rose-300 px-2 py-0.5 rounded leading-relaxed border-l-2 border-rose-500">
                    <span className="w-8 shrink-0 text-rose-500/70 select-none">-</span>
                    <span className="w-10 shrink-0 text-slate-600 select-none text-right pr-3">{idx + 1}</span>
                    <span className="flex-1 whitespace-pre-wrap">{line || ' '}</span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/30 px-2.5 py-1 rounded border border-emerald-500/20 mt-3">
                Proposed AI Changes (+):
              </div>
              <div className="space-y-0.5">
                {proposedLines.map((line, idx) => (
                  <div key={`prop-${idx}`} className="flex items-start bg-emerald-950/20 text-emerald-300 px-2 py-0.5 rounded leading-relaxed border-l-2 border-emerald-500">
                    <span className="w-8 shrink-0 text-emerald-500 select-none">+</span>
                    <span className="w-10 shrink-0 text-slate-600 select-none text-right pr-3">{idx + 1}</span>
                    <span className="flex-1 whitespace-pre-wrap">{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 h-full">
              <div className="flex flex-col border border-rose-500/30 rounded-xl overflow-hidden bg-rose-950/10">
                <div className="bg-rose-950/30 px-3 py-1.5 text-[11px] font-semibold text-rose-300 border-b border-rose-500/20">
                  Original Code
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-0.5">
                  {originalLines.map((l, i) => (
                    <div key={i} className="flex text-rose-200/90 leading-relaxed">
                      <span className="w-8 text-slate-600 select-none text-right pr-2">{i + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap">{l || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col border border-emerald-500/30 rounded-xl overflow-hidden bg-emerald-950/10">
                <div className="bg-emerald-950/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 border-b border-emerald-500/20">
                  Proposed AI Changes
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-0.5">
                  {proposedLines.map((l, i) => (
                    <div key={i} className="flex text-emerald-200 leading-relaxed">
                      <span className="w-8 text-slate-600 select-none text-right pr-2">{i + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap">{l || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex h-14 shrink-0 items-center justify-between border-t border-white/[.08] bg-[#161524] px-4">
          <span className="text-xs text-slate-400">
            Review changes carefully. Click "Accept Changes" to replace the file content.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReject}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition"
            >
              Reject Changes
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 shadow-md transition"
            >
              <Check size={14} />
              Accept Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
