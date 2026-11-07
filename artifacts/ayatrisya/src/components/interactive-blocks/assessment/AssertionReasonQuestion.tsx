import React from 'react';
import { Check, X, ShieldAlert } from 'lucide-react';
import type { AssessmentQuestion, AssessmentOption } from './assessment-types';

interface AssertionReasonProps {
  question: AssessmentQuestion;
  selectedAnswer?: string;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

const DEFAULT_AR_OPTIONS: AssessmentOption[] = [
  {
    id: 'a',
    label: 'Both Assertion (A) and Reason (R) are true, and Reason (R) is the correct explanation of Assertion (A).',
  },
  {
    id: 'b',
    label: 'Both Assertion (A) and Reason (R) are true, but Reason (R) is NOT the correct explanation of Assertion (A).',
  },
  {
    id: 'c',
    label: 'Assertion (A) is true, but Reason (R) is false.',
  },
  {
    id: 'd',
    label: 'Assertion (A) is false, but Reason (R) is true.',
  },
];

export function AssertionReasonQuestion({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  showFeedback = false,
}: AssertionReasonProps) {
  const options = question.options && question.options.length >= 2 ? question.options : DEFAULT_AR_OPTIONS;
  const correct = String(question.correctAnswer || '').toLowerCase();

  return (
    <div className="space-y-4">
      {/* Assertion & Reason Card */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[.03] p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <span className="shrink-0 rounded bg-violet-500/20 px-2 py-0.5 font-mono text-xs font-bold text-violet-300">
            Assertion (A)
          </span>
          <p className="text-sm text-slate-200 leading-relaxed font-sans">
            {question.assertion || question.question}
          </p>
        </div>

        {question.reason && (
          <div className="flex items-start gap-2.5 pt-2 border-t border-white/[.06]">
            <span className="shrink-0 rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
              Reason (R)
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {question.reason}
            </p>
          </div>
        )}
      </div>

      {/* Options list */}
      <div className="space-y-2.5" role="radiogroup" aria-label="Assertion and Reason Options">
        {options.map((opt) => {
          const isSelected = selectedAnswer === opt.id;
          const isCorrect = opt.id.toLowerCase() === correct;

          let borderCls = 'border-white/10 hover:border-violet-400/40 bg-white/[.02] hover:bg-white/[.04] text-slate-200';
          let badgeCls = 'border-white/20 bg-white/5 text-slate-300';

          if (showFeedback) {
            if (isCorrect) {
              borderCls = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200';
              badgeCls = 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300';
            } else if (isSelected && !isCorrect) {
              borderCls = 'border-rose-500/50 bg-rose-500/10 text-rose-200';
              badgeCls = 'border-rose-500/40 bg-rose-500/20 text-rose-300';
            }
          } else if (isSelected) {
            borderCls = 'border-violet-500/60 bg-violet-500/15 text-white ring-1 ring-violet-500/40';
            badgeCls = 'border-violet-400 bg-violet-500 text-white font-bold';
          }

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(opt.id)}
              className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${borderCls} ${
                disabled ? 'cursor-default' : 'cursor-pointer active:scale-[0.995]'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold uppercase transition-colors ${badgeCls}`}
              >
                {showFeedback && isCorrect ? (
                  <Check size={14} className="stroke-[2.5]" />
                ) : showFeedback && isSelected && !isCorrect ? (
                  <X size={14} className="stroke-[2.5]" />
                ) : (
                  opt.id
                )}
              </span>
              <div className="flex-1 pt-0.5 leading-relaxed font-sans">{opt.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
