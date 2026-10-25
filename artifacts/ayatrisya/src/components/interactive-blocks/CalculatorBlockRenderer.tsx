import React from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import type { CalculatorBlock } from './types';
import { useInteractiveBlockState } from './state';

export function CalculatorBlockRenderer({
  block,
  blockId = 'calculator',
}: {
  block: CalculatorBlock;
  blockId?: string;
}) {
  const initialVals: Record<string, number> = {};
  for (const v of block.variables || []) {
    initialVals[v.id] = v.defaultValue;
  }

  const [vals, setVals, reset] = useInteractiveBlockState<Record<string, number>>(blockId, initialVals);

  // Safe computation
  const calculateResult = (): number => {
    const vars = vals;
    if (block.formulaType === 'sum') {
      return Object.values(vars).reduce((acc, curr) => acc + curr, 0);
    }
    if (block.formulaType === 'product') {
      return Object.values(vars).reduce((acc, curr) => acc * curr, 1);
    }
    if (block.formulaType === 'roi') {
      const gain = vars['gain'] ?? vars['revenue'] ?? Object.values(vars)[0] ?? 0;
      const cost = vars['cost'] ?? vars['investment'] ?? Object.values(vars)[1] ?? 1;
      return cost > 0 ? Math.round(((gain - cost) / cost) * 100 * 100) / 100 : 0;
    }
    if (block.formulaType === 'compound') {
      const principal = vars['principal'] ?? vars['amount'] ?? 1000;
      const rate = (vars['rate'] ?? vars['interest'] ?? 5) / 100;
      const years = vars['years'] ?? vars['time'] ?? 5;
      return Math.round(principal * Math.pow(1 + rate, years) * 100) / 100;
    }

    // Default product of all variables
    return Object.values(vars).reduce((acc, curr) => acc * curr, 1);
  };

  const result = calculateResult();

  return (
    <div
      className="interactive-calculator my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-calculator-block"
      role="region"
      aria-label={block.title}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
            <Calculator size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            {block.title}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {block.description && (
        <p className="mb-3 text-xs text-slate-400">{block.description}</p>
      )}

      {/* Variables Sliders & Inputs */}
      <div className="space-y-3.5 my-3">
        {block.variables.map((v) => {
          const val = vals[v.id] ?? v.defaultValue;
          const min = v.min ?? 0;
          const max = v.max ?? Math.max(val * 2, 100);
          const step = v.step ?? 1;

          return (
            <div key={v.id} className="rounded-lg border border-white/10 bg-white/[.02] p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">{v.label}</span>
                <span className="font-mono font-semibold text-emerald-300">
                  {val.toLocaleString()} {v.unit || ''}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) =>
                  setVals((p) => ({ ...p, [v.id]: parseFloat(e.target.value) || 0 }))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[10px] text-slate-500 mt-1">
                <span>{min}</span>
                <span>{max}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Calculation Result Display */}
      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">
          {block.resultLabel || 'Calculated Result'}
        </span>
        <span className="mt-1 font-mono text-2xl font-bold text-emerald-300 block">
          {result.toLocaleString()} {block.resultUnit || ''}
        </span>
        <span className="text-[10px] text-slate-500 mt-1 block font-mono">
          Formula: {block.formula}
        </span>
      </div>
    </div>
  );
}
