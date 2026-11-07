import React from 'react';
import type { AssessmentQuestion } from './assessment-types';
import { SingleChoiceQuestion } from './SingleChoiceQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { AssertionReasonQuestion } from './AssertionReasonQuestion';
import { MatchQuestion } from './MatchQuestion';
import { CaseStudyQuestion } from './CaseStudyQuestion';
import { AnswerExplanation } from './AnswerExplanation';

interface QuestionRendererProps {
  question: AssessmentQuestion;
  selectedAnswer: any;
  onAnswer: (val: any) => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function QuestionRenderer({
  question,
  selectedAnswer,
  onAnswer,
  disabled = false,
  showFeedback = false,
}: QuestionRendererProps) {
  return (
    <div className="space-y-4">
      {/* Question Header & Stem */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {question.isPyq && (
            <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              PYQ: {question.pyqSource || 'Previous Year'}
            </span>
          )}
          {question.topic && (
            <span className="rounded-md bg-white/[.06] px-2 py-0.5 font-mono text-[10px] text-slate-300">
              {question.topic}
            </span>
          )}
          {question.difficulty && (
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                question.difficulty === 'easy'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : question.difficulty === 'hard'
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {question.difficulty.toUpperCase()}
            </span>
          )}
        </div>

        {question.imageUrl && (
          <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            <img
              src={question.imageUrl}
              alt="Question Diagram"
              className="max-h-64 w-full object-contain p-2"
            />
          </div>
        )}

        <h4 className="text-sm sm:text-base font-medium text-white leading-relaxed font-reading">
          {question.question}
        </h4>
      </div>

      {/* Question Type Specific Body */}
      {(() => {
        switch (question.type) {
          case 'multiple_choice':
            return (
              <MultipleChoiceQuestion
                question={question}
                selectedAnswers={Array.isArray(selectedAnswer) ? selectedAnswer : []}
                onToggle={(optId) => {
                  const current = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                  const next = current.includes(optId)
                    ? current.filter((id) => id !== optId)
                    : [...current, optId];
                  onAnswer(next);
                }}
                disabled={disabled}
                showFeedback={showFeedback}
              />
            );

          case 'assertion_reason':
            return (
              <AssertionReasonQuestion
                question={question}
                selectedAnswer={selectedAnswer}
                onSelect={onAnswer}
                disabled={disabled}
                showFeedback={showFeedback}
              />
            );

          case 'match_following':
            return (
              <MatchQuestion
                question={question}
                selectedMatches={selectedAnswer || {}}
                onMatch={(leftId, rightId) => {
                  const current = selectedAnswer && typeof selectedAnswer === 'object' ? selectedAnswer : {};
                  onAnswer({ ...current, [leftId]: rightId });
                }}
                disabled={disabled}
                showFeedback={showFeedback}
              />
            );

          case 'case_based':
            return (
              <CaseStudyQuestion
                question={question}
                selectedAnswer={selectedAnswer}
                onSelect={onAnswer}
                disabled={disabled}
                showFeedback={showFeedback}
              />
            );

          case 'true_false':
          case 'single_choice':
          case 'image_based':
          default:
            return (
              <SingleChoiceQuestion
                question={question}
                selectedAnswer={selectedAnswer}
                onSelect={onAnswer}
                disabled={disabled}
                showFeedback={showFeedback}
              />
            );
        }
      })()}

      {/* Answer & Explanation (in practice mode or post-submission) */}
      {showFeedback && <AnswerExplanation question={question} />}
    </div>
  );
}
