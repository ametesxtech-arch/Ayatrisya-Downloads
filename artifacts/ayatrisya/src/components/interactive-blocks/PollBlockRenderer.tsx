import React from 'react';
import { BarChart2, Check } from 'lucide-react';
import type { PollBlock } from './types';
import { useInteractiveBlockState } from './state';

interface PollState {
  selectedIds: string[];
  voted: boolean;
}

export function PollBlockRenderer({ block, blockId }: { block: PollBlock; blockId: string }) {
  const [state, setState] = useInteractiveBlockState<PollState>(blockId, {
    selectedIds: [],
    voted: false,
  });

  const isMulti = Boolean(block.allowMultiple);

  const handleSelect = (id: string) => {
    if (state.voted) return;
    if (isMulti) {
      const exists = state.selectedIds.includes(id);
      const next = exists ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id];
      setState((prev) => ({ ...prev, selectedIds: next }));
    } else {
      setState((prev) => ({ ...prev, selectedIds: [id] }));
    }
  };

  const handleVote = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.selectedIds.length === 0 || state.voted) return;
    setState((prev) => ({ ...prev, voted: true }));
  };

  // Calculate vote distributions
  const baseVotes = block.totalVotes ?? block.options.reduce((sum, o) => sum + (o.votes ?? 10), 0);
  const totalVotesCount = baseVotes + (state.voted ? state.selectedIds.length : 0);

  return (
    <div
      className="interactive-poll my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-poll-block"
      role="region"
      aria-label={block.title || 'Poll'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
            <BarChart2 size={13} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            {block.title || 'Community Poll'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {totalVotesCount} {totalVotesCount === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      <p className="mb-4 text-sm font-medium leading-relaxed text-slate-100 sm:text-base">
        {block.question}
      </p>

      <form onSubmit={handleVote} className="space-y-2.5">
        {block.options.map((opt) => {
          const isSelected = state.selectedIds.includes(opt.id);
          const rawVotes = (opt.votes ?? 10) + (state.voted && isSelected ? 1 : 0);
          const percent = totalVotesCount > 0 ? Math.round((rawVotes / totalVotesCount) * 100) : 0;

          return (
            <div key={opt.id} className="relative">
              <button
                type="button"
                disabled={state.voted}
                onClick={() => handleSelect(opt.id)}
                className={`relative z-10 flex w-full items-center justify-between overflow-hidden rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isSelected
                    ? 'border-sky-400/70 bg-sky-500/[.06]'
                    : 'border-white/10 bg-white/[.02] hover:border-white/20 hover:bg-white/[.04]'
                }`}
                data-testid={`poll-option-${opt.id}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center border font-mono text-[10px] font-bold ${
                      isMulti ? 'rounded' : 'rounded-full'
                    } ${
                      isSelected
                        ? 'border-sky-400 bg-sky-400 text-black'
                        : 'border-white/30 text-transparent'
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-slate-200">{opt.label}</span>
                </div>

                {state.voted && (
                  <span className="font-mono text-xs font-semibold text-sky-300">{percent}%</span>
                )}
              </button>

              {/* Animated Progress Fill after voting */}
              {state.voted && (
                <div
                  className="absolute inset-y-0 left-0 rounded-lg bg-sky-500/15 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}

        {!state.voted && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={state.selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-40 disabled:pointer-events-none"
              data-testid="poll-vote-button"
            >
              Cast Vote
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
