import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GraduationCap,
  Sparkles,
  SlidersHorizontal,
  Bookmark,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import type { AssessmentBlockData, AssessmentQuestion, AssessmentState } from './assessment-types';
import { QuestionRenderer } from './QuestionRenderer';
import { QuestionNavigator } from './QuestionNavigator';
import { AssessmentTimer } from './AssessmentTimer';
import { AssessmentProgress } from './AssessmentProgress';
import { AssessmentPalette } from './AssessmentPalette';
import { AssessmentResults } from './AssessmentResults';

export interface AssessmentContainerProps {
  block: AssessmentBlockData;
  blockId?: string;
  onAssessmentEvent?: (event: { type: string; payload: any }) => void;
}

export function AssessmentContainer({
  block,
  blockId,
  onAssessmentEvent,
}: AssessmentContainerProps) {
  const assessmentId = block.id || blockId || `assessment-${block.title.toLowerCase().replace(/[^\w-]/g, '_')}`;
  const storageKey = `ayatrisya_assessment_${assessmentId}`;

  // Validate questions
  const validQuestions = useMemo(() => {
    return (block.questions || []).filter((q) => {
      if (!q || !q.question) return false;
      if (q.type === 'match_following') return (q.matchPairs && q.matchPairs.length >= 2) || true;
      if (q.type === 'assertion_reason') return true;
      // Other types must have at least 2 options or valid correct answer
      return (q.options && q.options.length >= 2) || Boolean(q.correctAnswer);
    });
  }, [block.questions]);

  const totalQuestions = validQuestions.length;
  const initialTimeLimit = (block.timeLimitMinutes || Math.max(5, totalQuestions * 2)) * 60;

  // Initialize state with persistent storage recovery
  const [state, setState] = useState<AssessmentState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            mode: parsed.mode || block.mode || 'practice',
            currentQuestionIndex: Math.min(parsed.currentQuestionIndex || 0, Math.max(0, totalQuestions - 1)),
            answers: parsed.answers || {},
            markedForReview: parsed.markedForReview || {},
            submitted: Boolean(parsed.submitted),
            timeRemainingSeconds: parsed.timeRemainingSeconds ?? initialTimeLimit,
            totalTimeSpentSeconds: parsed.totalTimeSpentSeconds || 0,
            isTimerRunning: parsed.isTimerRunning ?? true,
            showPalette: false,
            reviewFilter: parsed.reviewFilter || 'all',
            startTime: parsed.startTime || Date.now(),
          };
        }
      }
    } catch {}

    return {
      mode: block.mode || 'practice',
      currentQuestionIndex: 0,
      answers: {},
      markedForReview: {},
      submitted: false,
      timeRemainingSeconds: initialTimeLimit,
      totalTimeSpentSeconds: 0,
      isTimerRunning: true,
      showPalette: false,
      reviewFilter: 'all',
      startTime: Date.now(),
    };
  });

  // Autosave to localStorage on state changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);

  // Practice mode immediate feedback preference
  const [instantFeedback, setInstantFeedback] = useState(state.mode === 'practice');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Filtered questions in review mode
  const activeQuestions = useMemo(() => {
    if (!state.submitted || state.reviewFilter === 'all') {
      return validQuestions;
    }
    if (state.reviewFilter === 'mistakes') {
      return validQuestions.filter((q) => {
        const userAns = state.answers[q.id];
        if (Array.isArray(q.correctAnswer)) {
          const uArr = Array.isArray(userAns) ? userAns.map(String) : [];
          const cArr = q.correctAnswer.map(String);
          return uArr.length !== cArr.length || !uArr.every((id) => cArr.includes(id));
        }
        return String(userAns || '').toLowerCase() !== String(q.correctAnswer || '').toLowerCase();
      });
    }
    if (state.reviewFilter === 'marked') {
      return validQuestions.filter((q) => state.markedForReview[q.id]);
    }
    return validQuestions;
  }, [validQuestions, state.submitted, state.reviewFilter, state.answers, state.markedForReview]);

  const effectiveTotal = activeQuestions.length;
  const safeIndex = Math.min(Math.max(state.currentQuestionIndex, 0), Math.max(0, effectiveTotal - 1));
  const currentQuestion = activeQuestions[safeIndex] || validQuestions[0];

  // Answer handler
  const handleAnswer = (answerValue: any) => {
    if (state.submitted && state.mode === 'exam') return;

    setState((prev) => {
      const nextAnswers = { ...prev.answers, [currentQuestion.id]: answerValue };
      return { ...prev, answers: nextAnswers };
    });

    onAssessmentEvent?.({
      type: 'assessment_answer',
      payload: {
        assessmentId,
        questionId: currentQuestion.id,
        answer: answerValue,
      },
    });
  };

  // Timer Tick
  const handleTimerTick = () => {
    setState((prev) => {
      if (prev.submitted) return prev;
      return {
        ...prev,
        timeRemainingSeconds: Math.max(0, prev.timeRemainingSeconds - 1),
        totalTimeSpentSeconds: prev.totalTimeSpentSeconds + 1,
      };
    });
  };

  // Submission handler
  const handleSubmitAssessment = () => {
    setState((prev) => ({
      ...prev,
      submitted: true,
      isTimerRunning: false,
      showPalette: false,
    }));
    setShowSubmitConfirm(false);

    onAssessmentEvent?.({
      type: 'assessment_submitted',
      payload: {
        assessmentId,
        answers: state.answers,
        totalQuestions,
        timeSpentSeconds: state.totalTimeSpentSeconds,
      },
    });
  };

  // Retake handler
  const handleRetake = () => {
    setState({
      mode: state.mode,
      currentQuestionIndex: 0,
      answers: {},
      markedForReview: {},
      submitted: false,
      timeRemainingSeconds: initialTimeLimit,
      totalTimeSpentSeconds: 0,
      isTimerRunning: true,
      showPalette: false,
      reviewFilter: 'all',
      startTime: Date.now(),
    });
  };

  if (totalQuestions === 0) {
    return (
      <div className="my-4 rounded-xl border border-white/10 bg-[#12141c] p-6 text-center text-sm text-slate-400">
        Assessment data contains no valid questions.
      </div>
    );
  }

  // Answered & Marked counts
  const answeredCount = Object.keys(state.answers).filter(
    (k) => state.answers[k] !== undefined && state.answers[k] !== '' && (!Array.isArray(state.answers[k]) || state.answers[k].length > 0)
  ).length;
  const markedCount = Object.values(state.markedForReview).filter(Boolean).length;
  const unansweredCount = totalQuestions - answeredCount;

  const showQuestionFeedback = state.submitted || (state.mode === 'practice' && instantFeedback && state.answers[currentQuestion?.id] !== undefined);

  return (
    <div
      className="interactive-quiz my-5 overflow-hidden rounded-2xl border border-violet-500/25 bg-[#0e1017] shadow-2xl backdrop-blur-md"
      data-testid="interactive-assessment-container"
    >
      {/* Assessment Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] bg-white/[.02] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
            <GraduationCap size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm sm:text-base font-semibold text-white tracking-tight">
                {block.title}
              </h3>
              <span className="rounded bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-violet-300 border border-violet-500/20 uppercase">
                {state.mode} mode
              </span>
            </div>
            {block.description && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{block.description}</p>
            )}
          </div>
        </div>

        {/* Right Header Stats & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Mode Switcher (Before Submission) */}
          {!state.submitted && (
            <div className="flex items-center rounded-lg border border-white/10 bg-black/30 p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setState((p) => ({ ...p, mode: 'practice' }));
                  setInstantFeedback(true);
                }}
                className={`rounded px-2 py-1 transition ${
                  state.mode === 'practice'
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Practice
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((p) => ({ ...p, mode: 'exam' }));
                  setInstantFeedback(false);
                }}
                className={`rounded px-2 py-1 transition ${
                  state.mode === 'exam'
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Exam
              </button>
            </div>
          )}

          {/* Timer */}
          <AssessmentTimer
            timeRemainingSeconds={state.timeRemainingSeconds}
            totalTimeSpentSeconds={state.totalTimeSpentSeconds}
            isExamMode={state.mode === 'exam'}
            isRunning={state.isTimerRunning && !state.submitted}
            onTick={handleTimerTick}
            onTimeExpire={handleSubmitAssessment}
            onTogglePause={() => setState((p) => ({ ...p, isTimerRunning: !p.isTimerRunning }))}
          />
        </div>
      </div>

      {/* Progress Bar Header */}
      <div className="px-4 py-2 bg-black/20 border-b border-white/[.04] sm:px-6">
        <AssessmentProgress
          totalQuestions={totalQuestions}
          answeredCount={answeredCount}
          markedReviewCount={markedCount}
          currentIndex={safeIndex}
        />
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Assessment Palette Overlay */}
        {state.showPalette && (
          <AssessmentPalette
            questions={validQuestions}
            currentIndex={safeIndex}
            answers={state.answers}
            markedForReview={state.markedForReview}
            onSelectQuestion={(idx) => setState((p) => ({ ...p, currentQuestionIndex: idx }))}
            onClose={() => setState((p) => ({ ...p, showPalette: false }))}
          />
        )}

        {/* Results Screen (When Submitted) */}
        {state.submitted && (
          <AssessmentResults
            questions={validQuestions}
            answers={state.answers}
            passingScore={block.passingScore}
            totalTimeSpentSeconds={state.totalTimeSpentSeconds}
            reviewFilter={state.reviewFilter}
            onFilterChange={(f) => setState((p) => ({ ...p, reviewFilter: f, currentQuestionIndex: 0 }))}
            onRetake={handleRetake}
          />
        )}

        {/* Practice Mode Instant Feedback Toggle */}
        {!state.submitted && state.mode === 'practice' && (
          <div className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.02] px-3.5 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Sparkles size={13} className="text-amber-400" />
              <span>Instant Feedback & Explanations</span>
            </span>
            <button
              type="button"
              onClick={() => setInstantFeedback(!instantFeedback)}
              className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold transition ${
                instantFeedback ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
              }`}
            >
              {instantFeedback ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        )}

        {/* Current Question */}
        {currentQuestion && (
          <QuestionRenderer
            question={currentQuestion}
            selectedAnswer={state.answers[currentQuestion.id]}
            onAnswer={handleAnswer}
            disabled={state.submitted && state.mode === 'exam'}
            showFeedback={showQuestionFeedback}
          />
        )}

        {/* Navigation Bar */}
        <QuestionNavigator
          currentIndex={safeIndex}
          totalQuestions={effectiveTotal}
          isMarkedForReview={Boolean(state.markedForReview[currentQuestion?.id])}
          showPalette={state.showPalette}
          onPrev={() => setState((p) => ({ ...p, currentQuestionIndex: Math.max(0, p.currentQuestionIndex - 1) }))}
          onNext={() => setState((p) => ({ ...p, currentQuestionIndex: Math.min(effectiveTotal - 1, p.currentQuestionIndex + 1) }))}
          onToggleMarkReview={() => {
            if (!currentQuestion) return;
            setState((p) => ({
              ...p,
              markedForReview: {
                ...p.markedForReview,
                [currentQuestion.id]: !p.markedForReview[currentQuestion.id],
              },
            }));
          }}
          onTogglePalette={() => setState((p) => ({ ...p, showPalette: !p.showPalette }))}
          onSubmit={() => setShowSubmitConfirm(true)}
          isSubmitted={state.submitted}
        />
      </div>

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#141620] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                <FileCheck size={20} />
              </div>
              <div>
                <h4 className="font-heading font-bold text-white text-base">Submit Assessment?</h4>
                <p className="text-xs text-slate-400">Review your status before submitting.</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-black/30 p-3 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Total Questions:</span>
                <span className="font-bold text-white">{totalQuestions}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Attempted:</span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Unanswered:</span>
                  <span className="font-bold">{unansweredCount}</span>
                </div>
              )}
              {markedCount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Marked for Review:</span>
                  <span className="font-bold">{markedCount}</span>
                </div>
              )}
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-300 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>You have {unansweredCount} unanswered questions. They will be marked as incorrect.</span>
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                Keep Working
              </button>
              <button
                type="button"
                onClick={handleSubmitAssessment}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/40 transition"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
