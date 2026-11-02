import { useState } from 'react';
import { Palette, ChevronDown, Check, Sliders, Sparkles } from 'lucide-react';
import { Button, inputCls } from '@/components/Primitives';
import type { ImageStyleId } from './types';
import { IMAGE_STYLE_PRESETS, getStylePreset } from './styles';

interface StyleSelectorProps {
  selectedStyleId?: ImageStyleId;
  customStyleModifier?: string;
  onSelectStyle: (styleId: ImageStyleId) => void;
  onChangeCustomModifier: (modifier: string) => void;
}

export function StyleSelector({
  selectedStyleId,
  customStyleModifier,
  onSelectStyle,
  onChangeCustomModifier,
}: StyleSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = getStylePreset(selectedStyleId);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-400">Artistic Style</label>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#15171e] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-violet-400/40 hover:bg-white/[.05] transition"
          data-testid="button-style-selector"
        >
          <Palette size={14} className="text-violet-400" />
          <span>{current.label}</span>
          <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300 font-normal">
            {current.badge}
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>

      {selectedStyleId === 'custom' && (
        <div className="mt-2">
          <input
            type="text"
            value={customStyleModifier || ''}
            onChange={(e) => onChangeCustomModifier(e.target.value)}
            placeholder="Describe your custom style (e.g. synthwave retro 80s neon, hyper-detailed airbrush)..."
            className={`${inputCls} text-xs`}
            data-testid="input-custom-style-modifier"
          />
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-xl border border-white/15 bg-[#15171e] p-3 shadow-2xl backdrop-blur-xl max-h-96 overflow-y-auto">
            <div className="mb-2 flex items-center justify-between pb-2 border-b border-white/[.07]">
              <span className="text-xs font-semibold text-slate-200">Select Image Style</span>
              <span className="text-[11px] text-slate-500">19 style presets</span>
            </div>

            <div className="space-y-1">
              {IMAGE_STYLE_PRESETS.map((preset) => {
                const isSelected = selectedStyleId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectStyle(preset.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-start gap-2.5 rounded-lg p-2 text-left text-xs transition ${
                      isSelected
                        ? 'border border-violet-500/40 bg-violet-500/15 text-slate-100'
                        : 'border border-transparent hover:bg-white/[.05] text-slate-300'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-violet-400">
                      {preset.id === 'custom' ? <Sliders size={14} /> : <Sparkles size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200">{preset.label}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.2 text-[9px] text-slate-400">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                    {isSelected && <Check size={14} className="text-violet-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
