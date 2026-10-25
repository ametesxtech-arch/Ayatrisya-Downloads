import React from 'react';
import { Layers, RotateCw, ArrowLeft, ArrowRight, Check, Sparkles, HelpCircle } from 'lucide-react';
import type { FlashcardBlock } from './types';
import { useInteractiveBlockState } from './state';

interface FlashcardState {
  currentIndex: number;
  flipped: boolean;
  mastery: Record<number, 'easy' | 'good' | 'hard'>;
  showHint: boolean;
}

export function FlashcardBlockRenderer({ block, blockId }: { block: FlashcardBlock; blockId: string }) {
  const [state, setState, reset] = useInteractiveBlockState<FlashcardState>(blockId, {
    currentIndex: 0,
    flipped: false,
    mastery: {},
    showHint: false,
  });

  const total = block.cards.length;
  const currentIdx = Math.min(Math.max(state.currentIndex, 0), total - 1);
  const card = block.cards[currentIdx];

  const handleFlip = () => {
    setState((p) => ({ ...p, flipped: !p.flipped }));
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setState((p) => ({ ...p, currentIndex: currentIdx + 1, flipped: false, showHint: false }));
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setState((p) => ({ ...p, currentIndex: currentIdx - 1, flipped: false, showHint: false }));
    }
  };

  const handleMastery = (rating: 'easy' | 'good' | 'hard') => {
    setState((p) => ({
      ...p,
      mastery: { ...p.mastery, [currentIdx]: rating },
      currentIndex: currentIdx < total - 1 ? currentIdx + 1 : currentIdx,
      flipped: false,
      showHint: false,
    }));
  };

  const masteredCount = Object.values(state.mastery).filter((r) => r === 'easy').length;

  return (
    <div
      className="interactive-flashcard my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-flashcard-block"
      role="region"
      aria-label={block.title || 'Flashcards'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
            <Layers size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            {block.title || 'Flashcards Review'}
          </h4>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span>{masteredCount} Mastered</span>
          <span>·</span>
          <span>{currentIdx + 1} / {total}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full bg-amber-400 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card Body */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleFlip}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleFlip();
          }
        }}
        className={`group relative flex min-h-[160px] cursor-pointer flex-col justify-between rounded-xl border p-5 text-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          state.flipped
            ? 'border-amber-400/60 bg-amber-950/20 shadow-amber-950/20'
            : 'border-white/10 bg-white/[.03] hover:border-white/20'
        }`}
        data-testid="flashcard-card"
        aria-label={`Flashcard: ${state.flipped ? 'Back side' : 'Front side'}. Click or press space to flip.`}
      >
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="rounded bg-white/[.05] px-2 py-0.5 font-mono">
            {card.category || (state.flipped ? 'Answer' : 'Question')}
          </span>
          <span className="flex items-center gap-1 text-slate-400 group-hover:text-amber-300 transition-colors">
            <RotateCw size={11} />
            Click or Space to flip
          </span>
        </div>

        <div className="my-auto py-3">
          <p className="text-sm font-medium leading-relaxed text-slate-100 sm:text-base">
            {state.flipped ? card.back : card.front}
          </p>
        </div>

        {card.hint && !state.flipped && (
          <div className="text-[11px] text-slate-400">
            {state.showHint ? (
              <span className="text-amber-300">Hint: {card.hint}</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setState((p) => ({ ...p, showHint: true }));
                }}
                className="underline hover:text-slate-200"
              >
                Show hint
              </button>
            )}
          </div>
        )}
      </div>

      {/* Controls & Mastery Rating */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[.08]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={handlePrev}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            data-testid="flashcard-prev-button"
          >
            <ArrowLeft size={12} />
            Prev
          </button>
          <button
            type="button"
            disabled={currentIdx === total - 1}
            onClick={handleNext}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            data-testid="flashcard-next-button"
          >
            Next
            <ArrowRight size={12} />
          </button>
        </div>

        {state.flipped && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Rate:</span>
            <button
              type="button"
              onClick={() => handleMastery('hard')}
              className="rounded bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors"
            >
              Hard
            </button>
            <button
              type="button"
              onClick={() => handleMastery('good')}
              className="rounded bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              Good
            </button>
            <button
              type="button"
              onClick={() => handleMastery('easy')}
              className="rounded bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/25 transition-colors"
            >
              Easy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
