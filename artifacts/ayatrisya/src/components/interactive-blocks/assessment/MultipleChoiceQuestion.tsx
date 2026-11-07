import React from 'react';
import { Check, X } from 'lucide-react';
import type { AssessmentQuestion, AssessmentOption } from './assessment-types';

interface MultipleChoiceProps {
  question: AssessmentQuestion;
  selectedAnswers?: string[];
  onToggle: (optionId: string) => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function MultipleChoiceQuestion({
  question,
  selectedAnswers = [],
  onToggle,
  disabled = false,
  showFeedback = false,
}: MultipleChoiceProps) {
  const options = question.options || [];
  const correctArr = Array.isArray(question.correctAnswer)
    ? question.correctAnswer.map((s) => String(s).toLowerCase())
    : [String(question.correctAnswer || '').toLowerCase()];

  return (
    <div className="space-y-2.5" role="group" aria-label={question.question}>
      <p className="text-[11px] font-mono text-violet-400 mb-1">
        Select all that apply:
      </p>
      {options.map((opt) => {
        const isSelected = selectedAnswers.includes(opt.id);
        const isCorrect = correctArr.includes(opt.id.toLowerCase());

        let borderCls = 'border-white/10 hover:border-violet-400/40 bg-white/[.02] hover:bg-white/[.04] text-slate-200';
        let checkboxCls = 'border-white/20 bg-white/5 text-slate-300';

        if (showFeedback) {
          if (isCorrect) {
            borderCls = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200';
            checkboxCls = 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300';
          } else if (isSelected && !isCorrect) {
            borderCls = 'border-rose-500/50 bg-rose-500/10 text-rose-200';
            checkboxCls = 'border-rose-500/40 bg-rose-500/20 text-rose-300';
          }
        } else if (isSelected) {
          borderCls = 'border-violet-500/60 bg-violet-500/15 text-white ring-1 ring-violet-500/40';
          checkboxCls = 'border-violet-400 bg-violet-500 text-white font-bold';
        }

        return (
          <button
            key={opt.id}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onToggle(opt.id)}
            className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${borderCls} ${
              disabled ? 'cursor-default' : 'cursor-pointer active:scale-[0.995]'
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold uppercase transition-colors ${checkboxCls}`}
            >
              {isSelected ? <Check size={14} className="stroke-[2.5]" /> : opt.id}
            </span>
            <div className="flex-1 pt-0.5 leading-relaxed font-sans">{opt.label}</div>
          </button>
        );
      })}
    </div>
  );
}
