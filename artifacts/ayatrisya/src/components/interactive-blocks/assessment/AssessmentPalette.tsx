import React from 'react';
import { Bookmark, CheckCircle2 } from 'lucide-react';
import type { AssessmentQuestion } from './assessment-types';

interface AssessmentPaletteProps {
  questions: AssessmentQuestion[];
  currentIndex: number;
  answers: Record<string, any>;
  markedForReview: Record<string, boolean>;
  onSelectQuestion: (index: number) => void;
  onClose: () => void;
}

export function AssessmentPalette({
  questions,
  currentIndex,
  answers,
  markedForReview,
  onSelectQuestion,
  onClose,
}: AssessmentPaletteProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0e14] p-4 space-y-3 animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between border-b border-white/[.08] pb-2 text-xs">
        <span className="font-heading font-semibold text-white">Question Palette</span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white text-[11px]"
        >
          Close
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded bg-emerald-500" /> Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded bg-amber-500" /> Review
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded bg-white/20" /> Unanswered
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const isAnswered =
            answers[q.id] !== undefined &&
            answers[q.id] !== '' &&
            (!Array.isArray(answers[q.id]) || answers[q.id].length > 0);
          const isMarked = Boolean(markedForReview[q.id]);

          let btnCls = 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10';
          if (isMarked) {
            btnCls = 'border-amber-500/50 bg-amber-500/25 text-amber-200 font-bold';
          } else if (isAnswered) {
            btnCls = 'border-emerald-500/50 bg-emerald-500/25 text-emerald-200 font-bold';
          }

          if (isCurrent) {
            btnCls += ' ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0d0e14]';
          }

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                onSelectQuestion(idx);
                onClose();
              }}
              className={`flex h-8 items-center justify-center rounded-lg border font-mono text-xs transition active:scale-95 ${btnCls}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

