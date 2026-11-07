import React from 'react';
import { Lightbulb, CheckCircle2, Bookmark } from 'lucide-react';
import type { AssessmentQuestion } from './assessment-types';

export function AnswerExplanation({ question }: { question: AssessmentQuestion }) {
  if (!question.explanation && !question.topic) return null;

  const correctDisplay = Array.isArray(question.correctAnswer)
    ? question.correctAnswer.join(', ').toUpperCase()
    : typeof question.correctAnswer === 'object'
    ? 'Column matching verified'
    : String(question.correctAnswer).toUpperCase();

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[.04] p-4 text-xs leading-relaxed animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-amber-300">
          <Lightbulb size={14} className="text-amber-400" />
          <span>Explanation & Key Concept</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
          <CheckCircle2 size={13} />
          <span>Correct: {correctDisplay}</span>
        </div>
      </div>

      {question.explanation && (
        <p className="text-slate-300 leading-relaxed font-sans">{question.explanation}</p>
      )}

      {question.topic && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Bookmark size={11} className="text-violet-400" />
          <span>Topic:</span>
          <span className="font-medium text-slate-200">{question.topic}</span>
        </div>
      )}
    </div>
  );
}
