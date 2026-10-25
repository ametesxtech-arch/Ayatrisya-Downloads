import React from 'react';
import { CheckSquare, Check } from 'lucide-react';
import type { ChecklistBlock } from './types';
import { useInteractiveBlockState } from './state';

export function ChecklistBlockRenderer({ block, blockId }: { block: ChecklistBlock; blockId: string }) {
  const initialChecked = block.items.filter((i) => i.checked).map((i) => i.id);
  const [checkedIds, setCheckedIds] = useInteractiveBlockState<string[]>(blockId, initialChecked);

  const toggle = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const total = block.items.length;
  const completed = checkedIds.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className="interactive-checklist my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-checklist-block"
      role="region"
      aria-label={block.title || 'Checklist'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
            <CheckSquare size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            {block.title || 'Checklist'}
          </h4>
        </div>
        <span className="font-mono text-xs text-slate-400">
          {completed} of {total} done ({progressPercent}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full bg-gradient-to-r from-indigo-400 to-teal-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {block.items.map((item) => {
          const isDone = checkedIds.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                isDone
                  ? 'border-indigo-500/30 bg-indigo-950/15'
                  : 'border-white/10 bg-white/[.02] hover:border-white/20 hover:bg-white/[.04]'
              }`}
              data-testid={`checklist-item-${item.id}`}
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => toggle(item.id)}
                className="sr-only"
              />
              <span
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  isDone
                    ? 'border-indigo-400 bg-indigo-400 text-black'
                    : 'border-white/30 text-transparent'
                }`}
              >
                {isDone && <Check size={11} strokeWidth={3} />}
              </span>
              <div className="flex-1">
                <span
                  className={`text-xs sm:text-sm leading-snug transition-colors ${
                    isDone ? 'text-slate-400 line-through' : 'text-slate-200'
                  }`}
                >
                  {item.label}
                </span>
                {item.category && (
                  <span className="ml-2 rounded bg-white/[.05] px-1.5 py-0.2 text-[10px] text-slate-400">
                    {item.category}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
