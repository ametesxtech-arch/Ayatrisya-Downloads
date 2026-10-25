import React from 'react';
import { ArrowUpDown, Check, X, RotateCcw, Link2, ArrowUp, ArrowDown } from 'lucide-react';
import type { MatchingBlock, SortingBlock } from './types';
import { useInteractiveBlockState } from './state';

export function MatchingBlockRenderer({ block, blockId }: { block: MatchingBlock; blockId: string }) {
  interface MatchingState {
    connections: Record<string, string>; // leftId -> rightId
    selectedLeft: string | null;
    submitted: boolean;
  }

  const [state, setState, reset] = useInteractiveBlockState<MatchingState>(blockId, {
    connections: {},
    selectedLeft: null,
    submitted: false,
  });

  const handleLeftClick = (id: string) => {
    if (state.submitted) return;
    setState((p) => ({ ...p, selectedLeft: p.selectedLeft === id ? null : id }));
  };

  const handleRightClick = (id: string) => {
    if (state.submitted || !state.selectedLeft) return;
    const next = { ...state.connections, [state.selectedLeft]: id };
    setState((p) => ({ ...p, connections: next, selectedLeft: null }));
  };

  const isMatched = (leftId: string, rightId: string) => state.connections[leftId] === rightId;

  // Evaluation
  let correctCount = 0;
  for (const pair of block.pairs) {
    if (state.connections[pair.id] === pair.id) {
      correctCount++;
    }
  }

  const allConnected = Object.keys(state.connections).length === block.pairs.length;

  return (
    <div
      className="interactive-matching my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-matching-block"
      role="region"
      aria-label={block.title || 'Matching Activity'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
            <Link2 size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            {block.title || 'Match Pairs'}
          </h4>
        </div>
        <span className="text-[11px] text-slate-400">Click a left item, then its match on the right</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 my-3">
        {/* Left Column */}
        <div className="space-y-2">
          {block.pairs.map((p) => {
            const isSelected = state.selectedLeft === p.id;
            const hasConnection = Boolean(state.connections[p.id]);
            const isCorrect = state.submitted && state.connections[p.id] === p.id;
            const isWrong = state.submitted && hasConnection && state.connections[p.id] !== p.id;

            return (
              <button
                key={p.id}
                type="button"
                disabled={state.submitted}
                onClick={() => handleLeftClick(p.id)}
                className={`w-full rounded-lg border p-2.5 text-left text-xs font-medium transition-all ${
                  state.submitted
                    ? isCorrect
                      ? 'border-teal-400 bg-teal-950/30 text-teal-200'
                      : isWrong
                        ? 'border-rose-400 bg-rose-950/30 text-rose-200'
                        : 'border-white/10 text-slate-400'
                    : isSelected
                      ? 'border-emerald-400 bg-emerald-500/15 text-white ring-1 ring-emerald-400'
                      : hasConnection
                        ? 'border-emerald-500/40 bg-white/[.04] text-slate-200'
                        : 'border-white/10 bg-white/[.02] text-slate-200 hover:border-white/20'
                }`}
              >
                {p.left}
              </button>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="space-y-2">
          {block.pairs.map((p) => {
            const isConnectedToCurrent = state.selectedLeft && state.connections[state.selectedLeft] === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={state.submitted || !state.selectedLeft}
                onClick={() => handleRightClick(p.id)}
                className={`w-full rounded-lg border p-2.5 text-left text-xs font-medium transition-all ${
                  state.submitted
                    ? 'border-white/10 text-slate-300'
                    : isConnectedToCurrent
                      ? 'border-emerald-400 bg-emerald-500/15 text-white'
                      : state.selectedLeft
                        ? 'border-white/20 bg-white/[.04] text-slate-200 hover:border-emerald-400'
                        : 'border-white/10 bg-white/[.02] text-slate-400'
                }`}
              >
                {p.right}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action / Result */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[.08] pt-2.5">
        {!state.submitted ? (
          <button
            type="button"
            disabled={!allConnected}
            onClick={() => setState((p) => ({ ...p, submitted: true }))}
            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Check Matches
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-emerald-300">
              {correctCount} / {block.pairs.length} Correct
            </span>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[.08]"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SortingBlockRenderer({ block, blockId }: { block: SortingBlock; blockId: string }) {
  interface SortingState {
    order: string[]; // itemIds
    submitted: boolean;
  }

  const initialOrder = block.items.map((i) => i.id);
  const [state, setState, reset] = useInteractiveBlockState<SortingState>(blockId, {
    order: initialOrder,
    submitted: false,
  });

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (state.submitted) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= state.order.length) return;
    const newOrder = [...state.order];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setState((p) => ({ ...p, order: newOrder }));
  };

  const itemMap = new Map(block.items.map((i) => [i.id, i]));

  // Evaluation
  let isAllCorrect = true;
  state.order.forEach((id, idx) => {
    const item = itemMap.get(id);
    if (item && item.correctIndex !== undefined && item.correctIndex !== idx) {
      isAllCorrect = false;
    }
  });

  return (
    <div
      className="interactive-sorting my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-sorting-block"
      role="region"
      aria-label={block.title || 'Sorting Activity'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
            <ArrowUpDown size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            {block.title || 'Order / Sort Sequence'}
          </h4>
        </div>
        <span className="text-[11px] text-slate-400">Arrange items in the correct order</span>
      </div>

      <div className="space-y-2 my-3">
        {state.order.map((id, idx) => {
          const item = itemMap.get(id);
          if (!item) return null;
          const isItemCorrect = state.submitted && item.correctIndex === idx;
          const isItemWrong = state.submitted && item.correctIndex !== undefined && item.correctIndex !== idx;

          return (
            <div
              key={id}
              className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${
                state.submitted
                  ? isItemCorrect
                    ? 'border-teal-500/40 bg-teal-950/20 text-teal-200'
                    : isItemWrong
                      ? 'border-rose-500/40 bg-rose-950/20 text-rose-200'
                      : 'border-white/10 bg-white/[.02] text-slate-300'
                  : 'border-white/10 bg-white/[.02] text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-slate-400 font-semibold">{idx + 1}.</span>
                <span className="text-xs sm:text-sm font-medium">{item.text}</span>
              </div>

              {!state.submitted && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, 'up')}
                    className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white disabled:opacity-20"
                    aria-label={`Move ${item.text} up`}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === state.order.length - 1}
                    onClick={() => moveItem(idx, 'down')}
                    className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white disabled:opacity-20"
                    aria-label={`Move ${item.text} down`}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[.08] pt-2.5">
        {!state.submitted ? (
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, submitted: true }))}
            className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
          >
            Check Order
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-xs font-bold ${
                isAllCorrect ? 'text-teal-300' : 'text-amber-300'
              }`}
            >
              {isAllCorrect ? 'All in correct order!' : 'Review incorrect positions.'}
            </span>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[.08]"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
