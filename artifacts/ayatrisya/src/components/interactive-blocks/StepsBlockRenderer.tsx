import React from 'react';
import { ListOrdered, Check, Copy } from 'lucide-react';
import type { StepsBlock } from './types';
import { useInteractiveBlockState } from './state';

export function StepsBlockRenderer({ block, blockId }: { block: StepsBlock; blockId: string }) {
  // Track completed steps indices
  const [completedIndices, setCompletedIndices] = useInteractiveBlockState<number[]>(blockId, []);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const toggleStep = (idx: number) => {
    if (!block.allowCompleteToggle) return;
    setCompletedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(idx);
      window.setTimeout(() => setCopiedIndex(null), 1800);
    }).catch(() => undefined);
  };

  return (
    <div
      className="interactive-steps my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-steps-block"
      role="region"
      aria-label={block.title || 'Step-by-Step Solution'}
    >
      <div className="mb-4 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
            <ListOrdered size={14} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            {block.title || 'Step-by-Step Guide'}
          </h4>
        </div>
        {block.allowCompleteToggle && (
          <span className="text-[11px] font-mono text-slate-400">
            {completedIndices.length} of {block.steps.length} completed
          </span>
        )}
      </div>

      <div className="space-y-3">
        {block.steps.map((step, idx) => {
          const stepNum = step.number ?? idx + 1;
          const isDone = completedIndices.includes(idx) || step.status === 'completed';

          return (
            <div
              key={idx}
              className={`rounded-lg border p-3.5 transition-all ${
                isDone
                  ? 'border-emerald-500/30 bg-emerald-950/15'
                  : 'border-white/10 bg-white/[.02]'
              }`}
              data-testid={`step-item-${idx}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={!block.allowCompleteToggle}
                  onClick={() => toggleStep(idx)}
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${
                    isDone
                      ? 'bg-emerald-400 text-slate-950'
                      : 'border border-white/20 bg-white/[.05] text-slate-300 hover:border-emerald-400/60'
                  }`}
                  aria-label={isDone ? `Step ${stepNum} completed` : `Step ${stepNum}`}
                >
                  {isDone ? <Check size={12} strokeWidth={3} /> : stepNum}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs sm:text-sm font-semibold ${
                        isDone ? 'text-emerald-200 line-through' : 'text-slate-100'
                      }`}
                    >
                      {step.title}
                    </h5>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                    {step.description}
                  </p>

                  {step.code && (
                    <div className="group relative mt-2.5 overflow-hidden rounded-md border border-white/10 bg-black/40">
                      <div className="flex items-center justify-between border-b border-white/[.06] bg-white/[.02] px-2.5 py-1 text-[10px] text-slate-400">
                        <span className="font-mono">{step.language || 'code'}</span>
                        <button
                          type="button"
                          onClick={() => copyCode(step.code!, idx)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                        >
                          {copiedIndex === idx ? (
                            <Check size={10} className="text-teal-300" />
                          ) : (
                            <Copy size={10} />
                          )}
                          <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="overflow-x-auto p-2.5 font-mono text-[11px] text-slate-200">
                        <code>{step.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
