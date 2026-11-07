import React from 'react';
import { Bookmark, CheckCircle2 } from 'lucide-react';

interface AssessmentProgressProps {
  totalQuestions: number;
  answeredCount: number;
  markedReviewCount: number;
  currentIndex: number;
}

export function AssessmentProgress({
  totalQuestions,
  answeredCount,
  markedReviewCount,
  currentIndex,
}: AssessmentProgressProps) {
  const percent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="text-white font-medium">
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 size={11} /> {answeredCount} Answered
          </span>
          {markedReviewCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Bookmark size={11} /> {markedReviewCount} Marked
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-teal-400 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
