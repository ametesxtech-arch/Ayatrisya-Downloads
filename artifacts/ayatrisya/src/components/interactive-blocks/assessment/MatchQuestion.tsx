import React from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import type { AssessmentQuestion, MatchPair } from './assessment-types';

interface MatchQuestionProps {
  question: AssessmentQuestion;
  selectedMatches?: Record<string, string>; // leftId -> rightId
  onMatch: (leftId: string, rightId: string) => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function MatchQuestion({
  question,
  selectedMatches = {},
  onMatch,
  disabled = false,
  showFeedback = false,
}: MatchQuestionProps) {
  const pairs: MatchPair[] = question.matchPairs || [];
  const correctMap: Record<string, string> = typeof question.correctAnswer === 'object' && !Array.isArray(question.correctAnswer)
    ? (question.correctAnswer as Record<string, string>)
    : {};

  // Extract unique left items and right items
  const leftItems = pairs.map((p, idx) => ({ id: p.id || `l-${idx}`, text: p.left }));
  const rightItems = pairs.map((p, idx) => ({ id: p.id || `r-${idx}`, text: p.right }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Match each item in Column A with its corresponding item in Column B:
      </p>

      <div className="space-y-3">
        {leftItems.map((leftItem, idx) => {
          const matchedRightId = selectedMatches[leftItem.id] || '';
          const isCorrect = correctMap[leftItem.id]
            ? correctMap[leftItem.id] === matchedRightId
            : matchedRightId === leftItem.id;

          let statusCls = 'border-white/10 bg-white/[.02]';
          if (showFeedback && matchedRightId) {
            statusCls = isCorrect
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-rose-500/50 bg-rose-500/10';
          }

          return (
            <div
              key={leftItem.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${statusCls}`}
            >
              <div className="flex items-center gap-2.5 sm:w-1/2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/5 font-mono text-xs font-semibold text-violet-300">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-slate-200">{leftItem.text}</span>
              </div>

              <div className="flex items-center gap-2 sm:w-1/2">
                <ArrowRight size={14} className="shrink-0 text-slate-500 hidden sm:block" />
                <select
                  disabled={disabled}
                  value={matchedRightId}
                  onChange={(e) => onMatch(leftItem.id, e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#14161f] px-3 py-2 text-xs text-slate-200 focus:border-violet-400 focus:outline-none"
                >
                  <option value="">Select match...</option>
                  {rightItems.map((rightItem, rIdx) => (
                    <option key={rightItem.id} value={rightItem.id}>
                      {String.fromCharCode(65 + rIdx)}. {rightItem.text}
                    </option>
                  ))}
                </select>
                {showFeedback && matchedRightId && (
                  <span className="shrink-0">
                    {isCorrect ? (
                      <Check size={16} className="text-emerald-400" />
                    ) : (
                      <X size={16} className="text-rose-400" />
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

