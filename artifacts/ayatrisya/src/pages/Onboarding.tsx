import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Button, Notice, inputCls } from '@/components/Primitives';
import { Brand } from '@/components/Brand';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import type { ChatMode, ModelId, Preferences } from '@/storage/types';

const steps = ['Welcome', 'Appearance', 'Defaults', 'Privacy'];
export function Onboarding() {
  const [, setPath] = useLocation();
  const { prefs, save, loaded } = usePrefs();
  const { caps } = useCaps();
  const [step, setStep] = useState(0), [name, setName] = useState<string | null>(null), [theme, setTheme] = useState<Preferences['theme'] | null>(null), [mode, setMode] = useState<ChatMode | null>(null), [model, setModel] = useState<ModelId | null>(null), [busy, setBusy] = useState(false);
  const v = { name: name ?? prefs.displayName, theme: theme ?? prefs.theme, mode: mode ?? prefs.mode, model: model ?? prefs.model };
  async function finish(skip = false) {
    setBusy(true);
    const saved = await save(skip ? { onboardingComplete: true } : { displayName: v.name.trim(), theme: v.theme, mode: v.mode, model: v.model, onboardingComplete: true });
    if (saved) setPath('/workspace'); else setBusy(false);
  }
  const ready = (id: ModelId) => caps.find((c) => c.id === id)?.available;
  return <main className="app-noise min-h-[100dvh] bg-[#101116] px-5 py-7">
    <header className="mx-auto flex max-w-4xl items-center justify-between"><Link href="/" aria-label="Ayatrisya home"><Brand /></Link><button onClick={() => void finish(true)} disabled={busy || !loaded} className="text-xs text-slate-400 hover:text-white">Skip setup <ArrowRight className="ml-1 inline" size={13} /></button></header>
    <div className="mx-auto mt-10 max-w-[620px]">
      <ol className="mb-8 flex gap-2" aria-label="Progress">{steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-violet-400' : 'bg-white/10'}`}><span className="sr-only">{s}</span></li>)}</ol>
      <p className="mb-2 text-[11px] uppercase tracking-[.16em] text-violet-300">Step {step + 1} of {steps.length}</p>
      {step === 0 && <section><h1 className="display text-4xl font-semibold tracking-[-.05em]">A private place to think.</h1><p className="mt-3 text-sm leading-6 text-slate-400">What should we call you? This is optional and stays in this browser.</p>
        <label className="mt-6 block text-xs font-medium text-slate-300">Display name<input value={v.name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-2`} autoComplete="given-name" data-testid="input-name" /></label></section>}
      {step === 1 && <section><h1 className="display text-3xl font-semibold tracking-[-.05em]">Appearance and language</h1>
        <fieldset className="mt-6"><legend className="text-xs font-medium text-slate-300">Theme</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['Dark', 'Light', 'Follow system'] as const).map((t) => <label key={t} className={`cursor-pointer rounded-lg border p-3 text-sm ${v.theme === t ? 'border-violet-400/50 bg-violet-400/10' : 'border-white/10'}`}><input type="radio" name="theme" className="mr-2 accent-violet-500" checked={v.theme === t} onChange={() => { setTheme(t); void save({ theme: t }); }} />{t}</label>)}</div></fieldset>
        <p className="mt-4 text-xs text-slate-500">Interface language: English (the only one available).</p></section>}
      {step === 2 && <section><h1 className="display text-3xl font-semibold tracking-[-.05em]">Chat defaults</h1>
        <label className="mt-6 block text-xs font-medium text-slate-300">Chat mode<select value={v.mode} onChange={(e) => setMode(e.target.value as ChatMode)} className={`${inputCls} mt-2`}><option>Normal</option><option>Savage</option><option>Joke</option></select></label>
        <label className="mt-4 block text-xs font-medium text-slate-300">Preferred model<select value={v.model} onChange={(e) => setModel(e.target.value as ModelId)} className={`${inputCls} mt-2`}><option value="v1-fast">V1 Fast{ready('v1-fast') ? '' : ' (unavailable)'}</option><option value="v2-best">V2 Best Result{ready('v2-best') ? '' : ' (unavailable)'}</option></select></label>
        <div className="mt-4"><Notice>Storage: everything is saved locally in this browser. Google Drive backup is optional, manual, and available from Storage when configured.</Notice></div></section>}
      {step === 3 && <section><h1 className="display text-3xl font-semibold tracking-[-.05em]">How your data is handled</h1>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-400"><li>Conversations and project files are stored locally by default.</li><li>Browser storage has limits and can be cleared by you or the browser. Export backups.</li><li>If a model server is configured, text you send must reach that server to be processed. You are asked first.</li><li>Attachments are never sent to a model. Nothing is uploaded silently and private content is not used for training.</li></ul></section>}
      <div className="mt-10 flex justify-between">
        <Button variant="quiet" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < 3 ? <Button onClick={() => setStep(step + 1)}>Continue</Button> : <Button onClick={() => void finish()} disabled={busy || !loaded} data-testid="button-finish">{busy ? 'Saving…' : 'Open my workspace'}</Button>}
      </div>
    </div>
  </main>;
}
