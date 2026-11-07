import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle,
  LayoutGrid,
  Send,
} from 'lucide-react';

interface QuestionNavigatorProps {
  currentIndex: number;
  totalQuestions: number;
  isMarkedForReview: boolean;
  showPalette: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleMarkReview: () => void;
  onTogglePalette: () => void;
  onSubmit: () => void;
  isSubmitted: boolean;
}

export function QuestionNavigator({
  currentIndex,
  totalQuestions,
  isMarkedForReview,
  showPalette,
  onPrev,
  onNext,
  onToggleMarkReview,
  onTogglePalette,
  onSubmit,
  isSubmitted,
}: QuestionNavigatorProps) {
  const isLast = currentIndex === totalQuestions - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-white/[.08]">
      {/* Left controls: Mark for Review & Question Palette */}
      <div className="flex items-center gap-2">
        {!isSubmitted && (
          <button
            type="button"
            onClick={onToggleMarkReview}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isMarkedForReview
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                : 'border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.07] hover:text-white'
            }`}
          >
            <Bookmark size={13} className={isMarkedForReview ? 'fill-amber-400 text-amber-400' : ''} />
            <span>{isMarkedForReview ? 'Marked' : 'Mark for Review'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onTogglePalette}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            showPalette
              ? 'border-violet-500/50 bg-violet-500/20 text-violet-200'
              : 'border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.07] hover:text-white'
          }`}
        >
          <LayoutGrid size={13} />
          <span>Palette</span>
        </button>
      </div>

      {/* Right controls: Prev, Next, Submit */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[.08] hover:text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          <ArrowLeft size={13} />
          <span>Previous</span>
        </button>

        {!isLast ? (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-1.5 text-xs font-medium text-white transition active:scale-95"
          >
            <span>Next</span>
            <ArrowRight size={13} />
          </button>
        ) : (
          !isSubmitted && (
            <button
              type="button"
              onClick={onSubmit}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-900/40 transition active:scale-95"
            >
              <Send size={13} />
              <span>Submit Assessment</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
