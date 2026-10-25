import React from 'react';
import { GitFork, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { DecisionTreeBlock } from './types';
import { useInteractiveBlockState } from './state';

export function DecisionTreeBlockRenderer({
  block,
  blockId = 'decision-tree',
}: {
  block: DecisionTreeBlock;
  blockId?: string;
}) {
  interface TreeState {
    currentNodeId: string;
    path: Array<{ nodeId: string; choiceLabel: string }>;
    finalOutcome: string | null;
  }

  const rootId = block.rootNodeId || (Object.keys(block.nodes || {})[0] ?? '');
  const [state, setState, reset] = useInteractiveBlockState<TreeState>(blockId, {
    currentNodeId: rootId,
    path: [],
    finalOutcome: null,
  });

  const path = state?.path || [];
  const currentNode = (block.nodes || {})[state?.currentNodeId || rootId];

  const handleSelectOption = (option: { label: string; nextNodeId?: string; outcome?: string }) => {
    if (option.outcome) {
      setState((p) => ({
        ...p,
        path: [...p.path, { nodeId: p.currentNodeId, choiceLabel: option.label }],
        finalOutcome: option.outcome!,
      }));
    } else if (option.nextNodeId && block.nodes[option.nextNodeId]) {
      setState((p) => ({
        ...p,
        currentNodeId: option.nextNodeId!,
        path: [...p.path, { nodeId: p.currentNodeId, choiceLabel: option.label }],
      }));
    }
  };

  return (
    <div
      className="interactive-decision-tree my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-decision-tree-block"
      role="region"
      aria-label={block.title || 'Decision Tree'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
            <GitFork size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            {block.title || 'Interactive Decision Guide'}
          </h4>
        </div>
        {path.length > 0 && (
          <button
            type="button"
            onClick={() => reset()}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
          >
            <RotateCcw size={11} />
            Start Over
          </button>
        )}
      </div>

      {/* Path Breadcrumbs */}
      {path.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
          <span>Path:</span>
          {path.map((step, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="rounded bg-white/[.05] px-1.5 py-0.5 text-slate-300 font-medium">
                {step.choiceLabel}
              </span>
              {i < path.length - 1 && <ArrowRight size={10} className="text-slate-600" />}
            </span>
          ))}
        </div>
      )}

      {/* Outcome View */}
      {state.finalOutcome ? (
        <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-4 text-xs leading-relaxed text-slate-200">
          <div className="flex items-center gap-2 mb-2 font-semibold text-teal-300">
            <CheckCircle2 size={16} />
            <span>Recommended Solution / Outcome:</span>
          </div>
          <p className="text-sm font-medium text-white">{state.finalOutcome}</p>
        </div>
      ) : currentNode ? (
        /* Current Node Choices */
        <div className="space-y-3">
          <p className="text-sm font-medium leading-relaxed text-slate-100 sm:text-base">
            {currentNode.prompt || (currentNode as any).question}
          </p>
          <div className="space-y-2">
            {currentNode.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectOption(opt)}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[.02] p-3 text-left transition-colors hover:border-violet-400 hover:bg-violet-500/[.06]"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-200">{opt.label}</span>
                <ArrowRight size={13} className="text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Decision tree configuration ended.</p>
      )}
    </div>
  );
}
