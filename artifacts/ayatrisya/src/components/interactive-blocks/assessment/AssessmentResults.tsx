import React from 'react';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Clock,
  Filter,
  Eye,
} from 'lucide-react';
import type { AssessmentQuestion } from './assessment-types';
import { PerformanceAnalysis } from './PerformanceAnalysis';

interface AssessmentResultsProps {
  questions: AssessmentQuestion[];
  answers: Record<string, any>;
  passingScore?: number;
  totalTimeSpentSeconds: number;
  reviewFilter: 'all' | 'mistakes' | 'marked';
  onFilterChange: (f: 'all' | 'mistakes' | 'marked') => void;
  onRetake: () => void;
}

export function AssessmentResults({
  questions,
  answers,
  passingScore = 70,
  totalTimeSpentSeconds,
  reviewFilter,
  onFilterChange,
  onRetake,
}: AssessmentResultsProps) {
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  questions.forEach((q) => {
    const userAns = answers[q.id];
    if (userAns === undefined || userAns === '' || (Array.isArray(userAns) && userAns.length === 0)) {
      unattemptedCount += 1;
      return;
    }

    let isCorrect = false;
    if (Array.isArray(q.correctAnswer)) {
      const uArr = Array.isArray(userAns) ? userAns.map(String) : [];
      const cArr = q.correctAnswer.map(String);
      isCorrect = uArr.length === cArr.length && uArr.every((id) => cArr.includes(id));
    } else if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null) {
      const uMap = userAns || {};
      const cMap = q.correctAnswer as Record<string, string>;
      isCorrect = Object.keys(cMap).every((k) => cMap[k] === uMap[k]);
    } else {
      isCorrect = String(userAns || '').toLowerCase() === String(q.correctAnswer || '').toLowerCase();
    }

    if (isCorrect) correctCount += 1;
    else incorrectCount += 1;
  });

  const total = questions.length;
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const isPassed = scorePercent >= passingScore;

  const minutes = Math.floor(totalTimeSpentSeconds / 60);
  const seconds = totalTimeSpentSeconds % 60;
  const timeFormatted = `${minutes}m ${seconds}s`;

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.08] pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-12 items-center justify-center rounded-xl font-bold ${
              isPassed
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
            }`}
          >
            <Trophy size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-bold text-white">
                {isPassed ? 'Assessment Completed' : 'Assessment Completed'}
              </h3>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold font-mono ${
                  isPassed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {isPassed ? 'PASSED' : 'NEEDS PRACTICE'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Passing benchmark: {passingScore}% · Score: {scorePercent}%
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition"
        >
          <RotateCcw size={13} />
          <span>Retake Assessment</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3">
          <div className="font-heading text-xl font-bold text-violet-300">{scorePercent}%</div>
          <div className="text-[11px] text-slate-400 font-mono">Accuracy</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] p-3">
          <div className="font-heading text-xl font-bold text-emerald-400 flex items-center justify-center gap-1">
            <CheckCircle2 size={16} /> {correctCount}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Correct</div>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[.04] p-3">
          <div className="font-heading text-xl font-bold text-rose-400 flex items-center justify-center gap-1">
            <XCircle size={16} /> {incorrectCount}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Incorrect</div>
        </div>
        <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3">
          <div className="font-heading text-xl font-bold text-slate-300 flex items-center justify-center gap-1">
            <Clock size={15} /> {timeFormatted}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Time Spent</div>
        </div>
      </div>

      {/* Topic Mastery Breakdown */}
      <PerformanceAnalysis questions={questions} answers={answers} />

      {/* Filter / Review Options */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[.06]">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Filter size={12} />
          <span>Review Mode:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              reviewFilter === 'all'
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Questions ({total})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('mistakes')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              reviewFilter === 'mistakes'
                ? 'bg-rose-500 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Review Mistakes ({incorrectCount})
          </button>
        </div>
      </div>
    </div>
  );
}
