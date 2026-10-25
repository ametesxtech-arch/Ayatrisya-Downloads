import React from 'react';
import { Award, ArrowRight, ArrowLeft, RotateCcw, Check, X, HelpCircle, CheckCircle2 } from 'lucide-react';
import type { QuizBlock } from './types';
import { useInteractiveBlockState } from './state';

interface QuizState {
  currentQuestionIndex: number;
  answers: Record<string, string[]>; // questionId -> selectedOptionIds
  finished: boolean;
  showHints: Record<string, boolean>;
}

export function QuizBlockRenderer({ block, blockId }: { block: QuizBlock; blockId: string }) {
  const [state, setState, reset] = useInteractiveBlockState<QuizState>(blockId, {
    currentQuestionIndex: 0,
    answers: {},
    finished: false,
    showHints: {},
  });

  const totalQuestions = block.questions.length;
  const currentIndex = Math.min(Math.max(state.currentQuestionIndex, 0), totalQuestions - 1);
  const currentQ = block.questions[currentIndex];

  const currentSelected = state.answers[currentQ.id] || [];

  const handleSelectOption = (optId: string) => {
    if (state.finished) return;
    const isMulti = Boolean(currentQ.multiSelect);
    if (isMulti) {
      const exists = currentSelected.includes(optId);
      const next = exists ? currentSelected.filter((id) => id !== optId) : [...currentSelected, optId];
      setState((prev) => ({
        ...prev,
        answers: { ...prev.answers, [currentQ.id]: next },
      }));
    } else {
      setState((prev) => ({
        ...prev,
        answers: { ...prev.answers, [currentQ.id]: [optId] },
      }));
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setState((prev) => ({ ...prev, currentQuestionIndex: currentIndex + 1 }));
    } else {
      setState((prev) => ({ ...prev, finished: true }));
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setState((prev) => ({ ...prev, currentQuestionIndex: currentIndex - 1 }));
    }
  };

  // Score calculation
  let correctCount = 0;
  for (const q of block.questions) {
    const selected = (state.answers[q.id] || []).map((s) => s.toLowerCase());
    const correctArr = (Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]).map((s) => s.toLowerCase());
    const isQCorrect =
      selected.length === correctArr.length && selected.every((id) => correctArr.includes(id));
    if (isQCorrect) correctCount++;
  }

  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passingScore = block.passingScore ?? 70;
  const isPassed = scorePercent >= passingScore;

  return (
    <div
      className="interactive-quiz my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-6 shadow-xl backdrop-blur-sm"
      data-testid="interactive-quiz-block"
      role="region"
      aria-label={block.title}
    >
      {/* Quiz Header */}
      <div className="border-b border-white/[.08] pb-3 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300 font-mono text-xs font-bold">
                Q
              </span>
              <h3 className="text-sm font-semibold text-white tracking-tight">{block.title}</h3>
            </div>
            {block.description && (
              <p className="mt-1 text-xs text-slate-400">{block.description}</p>
            )}
          </div>
          {!state.finished && (
            <span className="font-mono text-xs font-medium text-slate-400">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {!state.finished && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-violet-400 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Finished Summary View */}
      {state.finished ? (
        <div className="space-y-4" data-testid="quiz-summary-view">
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4 text-center sm:p-5">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
              <Award size={24} />
            </div>
            <h4 className="text-base font-semibold text-white">Quiz Completed</h4>
            <p className="mt-1 font-mono text-2xl font-bold text-teal-300">
              {correctCount} / {totalQuestions}
              <span className="ml-2 text-sm font-medium text-slate-400">({scorePercent}%)</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isPassed ? 'Congratulations! You passed this quiz.' : `Target score: ${passingScore}%. Keep practicing!`}
            </p>
          </div>

          {/* Question Breakdown */}
          <div className="space-y-3 pt-2">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Review Answers</h5>
            {block.questions.map((q, idx) => {
              const selected = state.answers[q.id] || [];
              const correctArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
              const qCorrect =
                selected.length === correctArr.length && selected.every((id) => correctArr.includes(id));

              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-3 text-xs ${
                    qCorrect
                      ? 'border-teal-500/30 bg-teal-950/20 text-slate-200'
                      : 'border-rose-500/30 bg-rose-950/20 text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {qCorrect ? (
                        <Check size={14} className="text-teal-400" />
                      ) : (
                        <X size={14} className="text-rose-400" />
                      )}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-100">
                        {idx + 1}. {q.question}
                      </p>
                      {q.explanation && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                          <span className="font-semibold text-slate-300">Explanation: </span>
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[.08] hover:text-white"
              data-testid="quiz-retake-button"
            >
              <RotateCcw size={13} />
              Retake Quiz
            </button>
          </div>
        </div>
      ) : (
        /* Active Question Card */
        <div className="space-y-4">
          <p className="text-sm font-medium leading-relaxed text-slate-100 sm:text-base">
            {currentQ.question}
          </p>

          <div
            role={currentQ.multiSelect ? 'group' : 'radiogroup'}
            aria-label={currentQ.question}
            className="space-y-2"
          >
            {currentQ.options.map((opt) => {
              const isSelected = currentSelected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  role={currentQ.multiSelect ? 'checkbox' : 'radio'}
                  aria-checked={isSelected}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                    isSelected
                      ? 'border-teal-400/80 bg-teal-500/[.08]'
                      : 'border-white/10 bg-white/[.02] hover:border-white/20 hover:bg-white/[.04]'
                  }`}
                  data-testid={`quiz-option-${opt.id}`}
                >
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border font-mono text-[10px] font-bold ${
                      currentQ.multiSelect ? 'rounded' : 'rounded-full'
                    } ${
                      isSelected
                        ? 'border-teal-400 bg-teal-400 text-black'
                        : 'border-white/30 text-transparent'
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <div className="flex-1">
                    <span className="text-xs sm:text-sm text-slate-200 leading-snug">{opt.label}</span>
                    {opt.hint && <p className="mt-1 text-[11px] text-slate-400">{opt.hint}</p>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hint */}
          {currentQ.hint && (
            <div>
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    showHints: { ...prev.showHints, [currentQ.id]: !prev.showHints[currentQ.id] },
                  }))
                }
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
              >
                <HelpCircle size={12} />
                {state.showHints[currentQ.id] ? 'Hide Hint' : 'Need a hint?'}
              </button>
              {state.showHints[currentQ.id] && (
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[.05] p-2.5 text-xs text-amber-200/90">
                  <span className="font-semibold text-amber-300">Hint:</span> {currentQ.hint}
                </div>
              )}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[.08]">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[.08] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              data-testid="quiz-prev-button"
            >
              <ArrowLeft size={13} />
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-400"
              data-testid="quiz-next-button"
            >
              {currentIndex === totalQuestions - 1 ? (
                <>
                  <CheckCircle2 size={13} />
                  Finish Quiz
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
