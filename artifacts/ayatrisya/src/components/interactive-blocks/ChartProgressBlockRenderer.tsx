import React from 'react';
import { TrendingUp, Activity } from 'lucide-react';
import type { ChartBlock, ProgressBlock } from './types';

export function ProgressBlockRenderer({ block }: { block: ProgressBlock }) {
  return (
    <div
      className="interactive-progress my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-progress-block"
      role="region"
      aria-label={block.title || 'Progress Indicators'}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-300">
          <Activity size={13} />
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
          {block.title || 'Metrics & Progress'}
        </h4>
      </div>

      <div className="space-y-3.5">
        {block.items.map((item, idx) => {
          const max = item.max ?? 100;
          const percent = Math.min(Math.max(Math.round((item.value / max) * 100), 0), 100);
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">{item.label}</span>
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  {item.value} / {max} ({percent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[.06]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {item.details && <p className="text-[11px] text-slate-400">{item.details}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartBlockRenderer({ block }: { block: ChartBlock }) {
  const maxVal = Math.max(...block.data.map((d) => d.value), 1);

  return (
    <div
      className="interactive-chart my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-chart-block"
      role="region"
      aria-label={block.title || 'Chart'}
    >
      <div className="mb-4 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
            <TrendingUp size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            {block.title || 'Data Visualization'}
          </h4>
        </div>
        {block.metricLabel && (
          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">
              {block.metricLabel}
            </span>
            <span className="font-mono text-xs font-bold text-violet-300">
              {block.metricValue}
            </span>
          </div>
        )}
      </div>

      {/* Bar Chart Representation */}
      {block.chartType === 'bar' && (
        <div className="space-y-3 pt-1">
          {block.data.map((d, i) => {
            const pct = Math.round((d.value / maxVal) * 100);
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{d.label}</span>
                  <span className="font-mono text-xs font-semibold text-violet-300">{d.value}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-md bg-white/[.04]">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-teal-400 transition-all duration-500 rounded-md"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Metric / Stat Cards */}
      {block.chartType === 'metric' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {block.data.map((d, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/[.02] p-3 text-center">
              <span className="block text-xs text-slate-400 truncate">{d.label}</span>
              <span className="mt-1 block font-mono text-xl font-bold text-teal-300">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pie / Distribution Representation */}
      {(block.chartType === 'pie' || block.chartType === 'line') && (
        <div className="space-y-2">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/[.06]">
            {block.data.map((d, i) => {
              const total = block.data.reduce((acc, curr) => acc + curr.value, 0) || 1;
              const slicePct = (d.value / total) * 100;
              const colors = ['bg-teal-400', 'bg-violet-400', 'bg-sky-400', 'bg-amber-400', 'bg-rose-400'];
              return (
                <div
                  key={i}
                  className={`h-full ${colors[i % colors.length]}`}
                  style={{ width: `${slicePct}%` }}
                  title={`${d.label}: ${d.value} (${Math.round(slicePct)}%)`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {block.data.map((d, i) => {
              const colors = ['bg-teal-400', 'bg-violet-400', 'bg-sky-400', 'bg-amber-400', 'bg-rose-400'];
              return (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className={`size-2.5 rounded-full ${colors[i % colors.length]}`} />
                  <span>{d.label}:</span>
                  <span className="font-mono font-semibold text-white">{d.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
