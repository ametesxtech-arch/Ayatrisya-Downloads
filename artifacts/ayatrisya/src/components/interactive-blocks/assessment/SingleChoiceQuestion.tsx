import React from 'react';
import { Check, X } from 'lucide-react';
import type { AssessmentQuestion, AssessmentOption } from './assessment-types';

interface SingleChoiceProps {
  question: AssessmentQuestion;
  selectedAnswer?: string;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function SingleChoiceQuestion({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  showFeedback = false,
}: SingleChoiceProps) {
  const options = question.options || [];
  const correct = String(question.correctAnswer || '').toLowerCase();

  return (
    <div className="space-y-2.5" role="radiogroup" aria-label={question.question}>
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
  );
}

