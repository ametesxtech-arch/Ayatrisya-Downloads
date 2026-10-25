import React from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import type { AccordionBlock } from './types';
import { useInteractiveBlockState } from './state';

export function AccordionBlockRenderer({ block, blockId }: { block: AccordionBlock; blockId: string }) {
  // Default expanded items
  const initialExpanded = block.items
    .filter((item) => item.defaultExpanded)
    .map((item) => item.id);

  const [expandedIds, setExpandedIds] = useInteractiveBlockState<string[]>(blockId, initialExpanded);

  const toggle = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="interactive-accordion my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-accordion-block"
      role="region"
      aria-label={block.title || 'Expandable Explanations'}
    >
      {block.title && (
        <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
            <Layers size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            {block.title}
          </h4>
        </div>
      )}

      <div className="space-y-2">
        {block.items.map((item) => {
          const isOpen = expandedIds.includes(item.id);
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-white/10 bg-white/[.02] transition-colors hover:border-white/20"
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                data-testid={`accordion-header-${item.id}`}
              >
                <span className="text-xs sm:text-sm font-medium text-slate-200">{item.title}</span>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className="rounded bg-white/[.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      {item.badge}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-amber-300' : ''
                    }`}
                  />
                </div>
              </button>

              {isOpen && (
                <div
                  className="border-t border-white/[.06] bg-black/20 p-3.5 text-xs leading-relaxed text-slate-300"
                  data-testid={`accordion-content-${item.id}`}
                >
                  {item.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
