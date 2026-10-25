import React from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import type { InputControlsBlock } from './types';
import { useInteractiveBlockState } from './state';

export function InputControlsBlockRenderer({
  block,
  blockId,
}: {
  block: InputControlsBlock;
  blockId: string;
}) {
  const initialValues: Record<string, number | boolean | string> = {};
  for (const c of block.controls) {
    initialValues[c.id] = c.defaultValue;
  }

  const [values, setValues, reset] = useInteractiveBlockState<Record<string, number | boolean | string>>(
    blockId,
    initialValues
  );

  const updateValue = (id: string, val: number | boolean | string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  return (
    <div
      className="interactive-controls my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-controls-block"
      role="region"
      aria-label={block.title || 'Interactive Controls'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-300">
            <Sliders size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300">
            {block.title || 'Interactive Parameters'}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
          title="Reset to defaults"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {block.description && (
        <p className="mb-4 text-xs text-slate-400 leading-relaxed">{block.description}</p>
      )}

      <div className="space-y-4">
        {block.controls.map((ctrl) => {
          if (ctrl.type === 'slider') {
            const val = typeof values[ctrl.id] === 'number' ? (values[ctrl.id] as number) : ctrl.defaultValue;
            return (
              <div key={ctrl.id} className="rounded-lg border border-white/10 bg-white/[.02] p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label htmlFor={`${blockId}-${ctrl.id}`} className="font-medium text-slate-200">
                    {ctrl.label}
                  </label>
                  <span className="font-mono text-xs font-semibold text-rose-300">
                    {val} {ctrl.unit || ''}
                  </span>
                </div>
                <input
                  id={`${blockId}-${ctrl.id}`}
                  type="range"
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step || 1}
                  value={val}
                  onChange={(e) => updateValue(ctrl.id, parseFloat(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                  data-testid={`slider-${ctrl.id}`}
                />
                <div className="flex justify-between font-mono text-[10px] text-slate-500 mt-1">
                  <span>{ctrl.min}</span>
                  <span>{ctrl.max}</span>
                </div>
              </div>
            );
          }

          if (ctrl.type === 'toggle') {
            const val = Boolean(values[ctrl.id] ?? ctrl.defaultValue);
            return (
              <div
                key={ctrl.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[.02] p-3"
              >
                <span className="text-xs font-medium text-slate-200">{ctrl.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={val}
                  onClick={() => updateValue(ctrl.id, !val)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-400 ${
                    val ? 'bg-rose-500' : 'bg-white/20'
                  }`}
                  data-testid={`toggle-${ctrl.id}`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      val ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          }

          if (ctrl.type === 'select') {
            const val = String(values[ctrl.id] ?? ctrl.defaultValue);
            return (
              <div key={ctrl.id} className="rounded-lg border border-white/10 bg-white/[.02] p-3">
                <label
                  htmlFor={`${blockId}-${ctrl.id}`}
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  {ctrl.label}
                </label>
                <select
                  id={`${blockId}-${ctrl.id}`}
                  value={val}
                  onChange={(e) => updateValue(ctrl.id, e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-[#0d0e12] px-2.5 py-1.5 text-xs text-slate-200 focus:border-rose-400 focus:outline-none"
                  data-testid={`select-${ctrl.id}`}
                >
                  {ctrl.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Dynamic Summary Card */}
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[.02] p-3 text-xs leading-relaxed text-slate-300">
        <span className="font-semibold text-rose-300">Active Values: </span>
        {Object.entries(values)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(' · ')}
      </div>
    </div>
  );
}
