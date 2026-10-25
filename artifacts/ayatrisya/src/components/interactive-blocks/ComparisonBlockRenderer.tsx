import React from 'react';
import { Columns3, Trophy, Check, X } from 'lucide-react';
import type { ComparisonBlock } from './types';

export function ComparisonBlockRenderer({ block }: { block: ComparisonBlock }) {
  const formatVal = (val: string | boolean | number | undefined) => {
    if (val === true) return <Check size={14} className="text-teal-400 inline" />;
    if (val === false) return <X size={14} className="text-rose-400 inline" />;
    if (val === undefined || val === null) return <span className="text-slate-500">—</span>;
    return String(val);
  };

  return (
    <div
      className="interactive-comparison my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-comparison-block"
      role="region"
      aria-label={block.title || 'Comparison'}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-purple-500/15 text-purple-300">
          <Columns3 size={13} />
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-300">
          {block.title || 'Comparison Matrix'}
        </h4>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[.04]">
              <th className="p-3 font-semibold text-slate-300">Criterion</th>
              {block.entities.map((ent) => (
                <th key={ent} className="p-3 font-semibold text-white">
                  {ent}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.06]">
            {block.criteria.map((c, i) => (
              <tr key={i} className="hover:bg-white/[.02] transition-colors">
                <td className="p-3 font-medium text-slate-200">
                  {c.criterion}
                  {c.notes && <p className="mt-0.5 text-[10px] text-slate-400">{c.notes}</p>}
                </td>
                {block.entities.map((ent) => {
                  const val = c.values[ent];
                  const isWinner = c.winner && c.winner.toLowerCase() === ent.toLowerCase();
                  return (
                    <td
                      key={ent}
                      className={`p-3 text-slate-300 ${
                        isWinner ? 'bg-teal-500/[.06] font-medium text-teal-200' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {formatVal(val)}
                        {isWinner && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-teal-500/20 px-1 py-0.2 text-[9px] font-semibold text-teal-300"
                            title="Recommended / Best in criterion"
                          >
                            <Trophy size={9} />
                            Best
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
