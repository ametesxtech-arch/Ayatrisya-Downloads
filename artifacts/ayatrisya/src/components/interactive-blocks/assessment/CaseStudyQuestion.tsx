import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { AssessmentQuestion } from './assessment-types';
import { SingleChoiceQuestion } from './SingleChoiceQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';

interface CaseStudyProps {
  question: AssessmentQuestion;
  selectedAnswer: any;
  onSelect: (val: any) => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function CaseStudyQuestion({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  showFeedback = false,
}: CaseStudyProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-4">
      {/* Case Study Passage Card */}
      {question.casePassage && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/[.03] overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-teal-500/10 text-xs font-semibold text-teal-300 hover:bg-teal-500/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={14} />
              <span>{question.caseTitle || 'Case Study Scenario / Passage'}</span>
            </div>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div className="p-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans border-t border-teal-500/20 bg-black/20 max-h-56 overflow-y-auto">
              {question.casePassage}
            </div>
          )}
        </div>
      )}

      {/* Actual Question */}
      <div className="pt-1">
        {Array.isArray(question.correctAnswer) ? (
          <MultipleChoiceQuestion
            question={question}
            selectedAnswers={selectedAnswer || []}
            onToggle={(optId) => {
              const current = Array.isArray(selectedAnswer) ? selectedAnswer : [];
              const next = current.includes(optId)
                ? current.filter((id: string) => id !== optId)
                : [...current, optId];
              onSelect(next);
            }}
            disabled={disabled}
            showFeedback={showFeedback}
          />
        ) : (
          <SingleChoiceQuestion
            question={question}
            selectedAnswer={selectedAnswer}
            onSelect={onSelect}
            disabled={disabled}
            showFeedback={showFeedback}
          />
        )}
      </div>
    </div>
  );
}

