import React from 'react';
import { Sparkles } from 'lucide-react';

export function InteractiveBlockSkeleton({ label = 'Rendering interactive experience...' }: { label?: string }) {
  return (
    <div
      className="interactive-skeleton my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/80 p-4 sm:p-5 shadow-lg"
      role="status"
      aria-label="Loading interactive content"
      data-testid="interactive-block-skeleton"
    >
      <div className="flex items-center gap-2.5 border-b border-white/[.08] pb-3">
        <span className="flex size-5 items-center justify-center rounded-md bg-teal-500/15 text-teal-300 animate-pulse">
          <Sparkles size={12} />
        </span>
        <span className="text-xs font-medium text-slate-300 animate-pulse">{label}</span>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="h-4 w-3/4 rounded bg-white/[.06] animate-pulse" />
        <div className="h-10 w-full rounded-lg bg-white/[.03] animate-pulse" />
        <div className="h-10 w-full rounded-lg bg-white/[.03] animate-pulse" />
        <div className="h-8 w-28 rounded-lg bg-teal-500/15 animate-pulse" />
      </div>
    </div>
  );
}
