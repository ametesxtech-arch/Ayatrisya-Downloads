import React from 'react';
import { FormInput, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { FormWizardBlock } from './types';
import { useInteractiveBlockState } from './state';

export function FormWizardBlockRenderer({
  block,
  blockId,
}: {
  block: FormWizardBlock;
  blockId: string;
}) {
  interface WizardState {
    currentStep: number;
    values: Record<string, string | number | boolean>;
    submitted: boolean;
  }

  const initialVals: Record<string, string | number | boolean> = {};
  for (const step of block.steps) {
    for (const f of step.fields) {
      if (f.defaultValue !== undefined) initialVals[f.id] = f.defaultValue;
    }
  }

  const [state, setState, reset] = useInteractiveBlockState<WizardState>(blockId, {
    currentStep: 0,
    values: initialVals,
    submitted: false,
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const totalSteps = block.steps.length;
  const currentStep = block.steps[state.currentStep];

  const setVal = (id: string, val: string | number | boolean) => {
    setState((p) => ({ ...p, values: { ...p.values, [id]: val } }));
    if (fieldErrors[id]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleNext = () => {
    // Validate current step fields
    const errors: Record<string, string> = {};
    for (const f of currentStep.fields) {
      const val = state.values[f.id];
      if (f.required && (val === undefined || val === '' || val === null)) {
        errors[f.id] = 'This field is required';
      } else if (f.type === 'email' && val) {
        const emailStr = String(val).trim();
        // Standard email regex check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailStr)) {
          errors[f.id] = 'Please enter a valid email address';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    if (state.currentStep < totalSteps - 1) {
      setState((p) => ({ ...p, currentStep: p.currentStep + 1 }));
    } else {
      setState((p) => ({ ...p, submitted: true }));
    }
  };

  const handlePrev = () => {
    if (state.currentStep > 0) {
      setState((p) => ({ ...p, currentStep: p.currentStep - 1 }));
    }
  };

  return (
    <div
      className="interactive-form-wizard my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-form-wizard-block"
      role="region"
      aria-label={block.title || 'Form Wizard'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
            <FormInput size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-300">
            {block.title || 'Guided Form'}
          </h4>
        </div>
        {!state.submitted && (
          <span className="font-mono text-xs text-slate-400">
            Step {state.currentStep + 1} of {totalSteps}
          </span>
        )}
      </div>

      {state.submitted ? (
        <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-teal-300 mb-2">
            <CheckCircle2 size={16} />
            <span>{block.summaryMessage || 'Form Completed Successfully'}</span>
          </div>
          <div className="space-y-1 mt-3 border-t border-white/[.08] pt-2">
            {Object.entries(state.values).map(([k, v]) => (
              <div key={k} className="flex justify-between text-slate-300">
                <span className="text-slate-400">{k}:</span>
                <span className="font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h5 className="text-sm font-semibold text-white">{currentStep.title}</h5>
            {currentStep.description && (
              <p className="mt-0.5 text-xs text-slate-400">{currentStep.description}</p>
            )}
          </div>

          <div className="space-y-3">
            {currentStep.fields.map((f) => (
              <div key={f.id} className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  {f.label} {f.required && <span className="text-rose-400">*</span>}
                </label>
                {f.type === 'text' && (
                  <input
                    type="text"
                    value={String(state.values[f.id] || '')}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    placeholder={f.placeholder}
                    className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-3 text-xs text-slate-200 focus:border-blue-400 focus:outline-none"
                  />
                )}
                {f.type === 'email' && (
                  <input
                    type="email"
                    value={String(state.values[f.id] || '')}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    placeholder={f.placeholder || 'name@example.com'}
                    className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-3 text-xs text-slate-200 focus:border-blue-400 focus:outline-none"
                  />
                )}
                {fieldErrors[f.id] && (
                  <p className="text-[11px] text-rose-400">{fieldErrors[f.id]}</p>
                )}
                {f.type === 'number' && (
                  <input
                    type="number"
                    value={state.values[f.id] !== undefined ? Number(state.values[f.id]) : ''}
                    onChange={(e) => setVal(f.id, parseFloat(e.target.value) || 0)}
                    placeholder={f.placeholder}
                    className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-3 text-xs text-slate-200 focus:border-blue-400 focus:outline-none"
                  />
                )}
                {f.type === 'select' && f.options && (
                  <select
                    value={String(state.values[f.id] || f.options[0])}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    className="h-8 w-full rounded-md border border-white/10 bg-[#0d0e12] px-2.5 text-xs text-slate-200 focus:border-blue-400 focus:outline-none"
                  >
                    {f.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {f.type === 'checkbox' && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(state.values[f.id])}
                      onChange={(e) => setVal(f.id, e.target.checked)}
                      className="accent-blue-500 rounded"
                    />
                    <span className="text-xs text-slate-300">{f.placeholder || 'Confirm'}</span>
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/[.08] pt-3">
            <button
              type="button"
              disabled={state.currentStep === 0}
              onClick={handlePrev}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-30"
            >
              <ArrowLeft size={12} />
              Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-blue-400"
            >
              {state.currentStep === totalSteps - 1 ? (
                block.submitLabel || 'Submit'
              ) : (
                <>
                  Next
                  <ArrowRight size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
