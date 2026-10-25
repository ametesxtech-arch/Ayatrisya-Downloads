import React from 'react';
import { Columns3, ArrowRight, ArrowLeft } from 'lucide-react';
import type { KanbanBlock, KanbanColumn } from './types';
import { useInteractiveBlockState } from './state';

export function KanbanBlockRenderer({ block, blockId = 'kanban' }: { block: KanbanBlock; blockId?: string }) {
  const [columns, setColumns] = useInteractiveBlockState<KanbanColumn[]>(blockId, block.columns || []);

  const moveCard = (fromColIdx: number, toColIdx: number, cardId: string) => {
    if (toColIdx < 0 || toColIdx >= columns.length) return;
    const card = columns[fromColIdx].cards.find((c) => c.id === cardId);
    if (!card) return;

    setColumns((prev) =>
      prev.map((col, idx) => {
        if (idx === fromColIdx) {
          return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        }
        if (idx === toColIdx) {
          return { ...col, cards: [...col.cards, card] };
        }
        return col;
      })
    );
  };

  return (
    <div
      className="interactive-kanban my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-kanban-block"
      role="region"
      aria-label={block.title || 'Kanban Task Board'}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-300">
          <Columns3 size={13} />
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
          {block.title || 'Kanban Board'}
        </h4>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 overflow-x-auto">
        {columns.map((col, cIdx) => (
          <div
            key={col.id}
            className="rounded-lg border border-white/10 bg-white/[.02] p-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-white/[.06] pb-2 mb-2">
                <span className="text-xs font-semibold text-slate-200">{col.title}</span>
                <span className="rounded bg-white/[.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {col.cards.length}
                </span>
              </div>

              <div className="space-y-2">
                {col.cards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-md border border-white/10 bg-black/40 p-2.5 text-xs transition-colors hover:border-white/20"
                  >
                    <div className="font-medium text-slate-100">{card.title}</div>
                    {card.description && (
                      <p className="mt-1 text-[11px] text-slate-400">{card.description}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-white/[.06]">
                      {card.tag ? (
                        <span className="rounded bg-white/[.06] px-1.5 py-0.2 text-[9px] text-slate-400">
                          {card.tag}
                        </span>
                      ) : <span />}
                      <div className="flex items-center gap-1">
                        {cIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveCard(cIdx, cIdx - 1, card.id)}
                            className="p-0.5 text-slate-400 hover:text-white"
                            title="Move left"
                          >
                            <ArrowLeft size={11} />
                          </button>
                        )}
                        {cIdx < columns.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveCard(cIdx, cIdx + 1, card.id)}
                            className="p-0.5 text-slate-400 hover:text-white"
                            title="Move right"
                          >
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
