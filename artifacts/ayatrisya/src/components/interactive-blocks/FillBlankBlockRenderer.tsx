import React from 'react';
import { Edit3, Check, X, RotateCcw } from 'lucide-react';
import type { FillBlankBlock } from './types';
import { useInteractiveBlockState } from './state';

export function FillBlankBlockRenderer({ block, blockId = 'fill-blank' }: { block: FillBlankBlock; blockId?: string }) {
  interface FillState {
    values: Record<string, string>;
    submitted: boolean;
  }

  const [state, setState, reset] = useInteractiveBlockState<FillState>(blockId, {
    values: {},
    submitted: false,
  });

  const values = state?.values || {};

  const handleChange = (id: string, val: string) => {
    if (state?.submitted) return;
    setState((p) => ({ ...p, values: { ...(p?.values || {}), [id]: val } }));
  };

  const blankMap = new Map((block.blanks || []).map((b) => [b.id, b]));

  // Parse text segments around {{blank_id}}
  const rawText = block.textWithBlanks || '';
  const parts = rawText.split(/(\{\{[^}]+\}\})/g);

  let correctCount = 0;
  for (const b of block.blanks || []) {
    const userVal = (values[b.id] || '').trim().toLowerCase();
    const correctVal = b.answer.trim().toLowerCase();
    if (userVal === correctVal) correctCount++;
  }

  return (
    <div
      className="interactive-fill-blank my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-fill-blank-block"
      role="region"
      aria-label={block.title || 'Fill in the Blanks'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-teal-500/15 text-teal-300">
            <Edit3 size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-300">
            {block.title || 'Fill in the Blank'}
          </h4>
        </div>
      </div>

      <div className="my-3 text-sm leading-loose text-slate-200">
        {parts.map((part, idx) => {
          const match = part.match(/\{\{([^}]+)\}\}/);
          if (match) {
            const blankId = match[1].trim();
            const b = blankMap.get(blankId);
            const userVal = state.values[blankId] || '';
            const isCorrect = state.submitted && b && userVal.trim().toLowerCase() === b.answer.trim().toLowerCase();
            const isWrong = state.submitted && b && userVal.trim().toLowerCase() !== b.answer.trim().toLowerCase();

            return (
              <span key={idx} className="inline-flex items-center mx-1 align-baseline">
                <input
                  type="text"
                  disabled={state.submitted}
                  value={userVal}
                  onChange={(e) => handleChange(blankId, e.target.value)}
                  placeholder={b?.hint || '...'}
                  className={`h-7 min-w-[90px] max-w-[160px] rounded border px-2 py-0.5 text-xs font-medium focus:outline-none transition-colors ${
                    state.submitted
                      ? isCorrect
                        ? 'border-teal-400 bg-teal-950/30 text-teal-200'
                        : 'border-rose-400 bg-rose-950/30 text-rose-200'
                      : 'border-white/20 bg-white/[.04] text-white focus:border-teal-400'
                  }`}
                />
                {state.submitted && isWrong && b && (
                  <span className="ml-1 text-[11px] font-mono text-rose-300">({b.answer})</span>
                )}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[.08] pt-2.5">
        {!state.submitted ? (
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, submitted: true }))}
            className="rounded-lg bg-teal-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400"
          >
            Check Answers
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-teal-300">
              {correctCount} / {block.blanks.length} Correct
            </span>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[.08]"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
