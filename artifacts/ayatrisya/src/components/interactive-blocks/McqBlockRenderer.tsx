import React, { useState } from 'react';
import { Check, X, HelpCircle, RotateCcw, Award, AlertCircle } from 'lucide-react';
import type { McqBlock } from './types';
import { useInteractiveBlockState } from './state';

interface McqState {
  selectedIds: string[];
  submitted: boolean;
  showHint: boolean;
}

export function McqBlockRenderer({ block, blockId }: { block: McqBlock; blockId: string }) {
  const [state, setState, reset] = useInteractiveBlockState<McqState>(blockId, {
    selectedIds: [],
    submitted: false,
    showHint: false,
  });

  const isMulti = Boolean(block.multiSelect);
  const correctArray: string[] = (block.correctAnswer
    ? Array.isArray(block.correctAnswer)
      ? block.correctAnswer
      : [block.correctAnswer]
    : []).map((s) => s.toLowerCase());

  const handleSelect = (id: string) => {
    if (state.submitted) return;
    if (isMulti) {
      const exists = state.selectedIds.includes(id);
      const next = exists
        ? state.selectedIds.filter((item) => item !== id)
        : [...state.selectedIds, id];
      setState((prev) => ({ ...prev, selectedIds: next }));
    } else {
      setState((prev) => ({ ...prev, selectedIds: [id] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.selectedIds.length === 0 || state.submitted) return;
    setState((prev) => ({ ...prev, submitted: true }));
  };

  // Check correctness if correctAnswer was provided
  const hasAnswerKey = correctArray.length > 0;
  const isCorrect =
    hasAnswerKey &&
    state.selectedIds.length === correctArray.length &&
    state.selectedIds.every((id) => correctArray.includes(id.toLowerCase()));

  return (
    <div
      className="interactive-mcq my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-mcq-block"
      role="region"
      aria-label={block.title || 'Multiple Choice Question'}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-teal-500/15 text-teal-300 font-mono text-xs font-bold">
            ?
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
            {block.title || (isMulti ? 'Multiple-Answer Question' : 'Multiple Choice Question')}
          </span>
        </div>
        {isMulti && (
          <span className="rounded bg-white/[.06] px-2 py-0.5 text-[11px] text-slate-400">
            Select all that apply
          </span>
        )}
      </div>

      {/* Question */}
      <p className="mb-4 text-sm font-medium leading-relaxed text-slate-100 sm:text-base">
        {block.question}
      </p>

      {/* Options */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div role={isMulti ? 'group' : 'radiogroup'} aria-label={block.question} className="space-y-2">
          {block.options.map((opt) => {
            const isSelected = state.selectedIds.includes(opt.id);
            const isTargetCorrect = hasAnswerKey && state.submitted && correctArray.includes(opt.id.toLowerCase());
            const isWrongSelection = hasAnswerKey && state.submitted && isSelected && !correctArray.includes(opt.id.toLowerCase());

            let borderClass = 'border-white/10 hover:border-white/20 hover:bg-white/[.04]';
            let bgClass = 'bg-white/[.02]';
            let indicatorClass = 'border-white/30 text-transparent';

            if (state.submitted) {
              if (isTargetCorrect) {
                borderClass = 'border-teal-400/70 bg-teal-950/30';
                indicatorClass = 'border-teal-400 bg-teal-400 text-black';
              } else if (isWrongSelection) {
                borderClass = 'border-rose-400/60 bg-rose-950/30';
                indicatorClass = 'border-rose-400 bg-rose-400 text-white';
              } else {
                borderClass = 'border-white/5 opacity-60';
              }
            } else if (isSelected) {
              borderClass = 'border-teal-400/80 bg-teal-500/[.08]';
              indicatorClass = 'border-teal-400 bg-teal-400 text-black';
            }

            return (
              <button
                key={opt.id}
                type="button"
                role={isMulti ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                disabled={state.submitted}
                onClick={() => handleSelect(opt.id)}
                className={`group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${borderClass} ${bgClass}`}
                data-testid={`mcq-option-${opt.id}`}
              >
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border font-mono text-[10px] font-bold transition-colors ${
                    isMulti ? 'rounded' : 'rounded-full'
                  } ${indicatorClass}`}
                >
                  {state.submitted && isTargetCorrect ? (
                    <Check size={11} strokeWidth={3} />
                  ) : state.submitted && isWrongSelection ? (
                    <X size={11} strokeWidth={3} />
                  ) : isSelected ? (
                    <Check size={11} strokeWidth={3} />
                  ) : null}
                </span>

                <div className="flex-1">
                  <span className="text-xs sm:text-sm text-slate-200 leading-snug">{opt.label}</span>
                  {opt.hint && !state.submitted && (
                    <p className="mt-1 text-[11px] text-slate-400">{opt.hint}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            {!state.submitted ? (
              <button
                type="submit"
                disabled={state.selectedIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-40 disabled:pointer-events-none"
                data-testid="mcq-submit-button"
              >
                Submit Answer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white"
                data-testid="mcq-retry-button"
              >
                <RotateCcw size={12} />
                Try Again
              </button>
            )}

            {block.hint && !state.submitted && (
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, showHint: !p.showHint }))}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                aria-expanded={state.showHint}
              >
                <HelpCircle size={13} />
                {state.showHint ? 'Hide Hint' : 'Show Hint'}
              </button>
            )}
          </div>

          {state.submitted && hasAnswerKey && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
                isCorrect
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
              data-testid="mcq-feedback-badge"
            >
              {isCorrect ? <Award size={13} /> : <AlertCircle size={13} />}
              <span>{isCorrect ? 'Correct!' : 'Incorrect'}</span>
            </div>
          )}
        </div>
      </form>

      {/* Hint display */}
      {state.showHint && block.hint && !state.submitted && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[.05] p-3 text-xs text-amber-200/90">
          <span className="font-semibold text-amber-300">Hint:</span> {block.hint}
        </div>
      )}

      {/* Post-submission Explanation & Disclaimer */}
      {state.submitted && (
        <div className="mt-4 border-t border-white/[.08] pt-3.5 space-y-2">
          {block.explanation && (
            <div className="rounded-lg border border-white/10 bg-white/[.02] p-3 text-xs leading-relaxed text-slate-300">
              <span className="font-semibold text-teal-300">Explanation: </span>
              {block.explanation}
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            Note: Generated educational question verified against model answer key.
          </p>
        </div>
      )}
    </div>
  );
}
