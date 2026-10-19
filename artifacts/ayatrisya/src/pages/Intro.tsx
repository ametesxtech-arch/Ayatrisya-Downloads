import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Emblem, Wordmark } from '@/components/Brand';
import { Button } from '@/components/Primitives';
import { usePrefs } from '@/hooks/use-prefs';

export function Intro() {
  const [, setPath] = useLocation();
  const { prefs, save, loaded } = usePrefs();
  const dest = prefs.onboardingComplete ? '/workspace' : '/onboarding';
  const destRef = useRef(dest);
  destRef.current = dest;
  useEffect(() => {
    if (!loaded) return;
    if (prefs.skipIntro) { setPath(destRef.current, { replace: true }); return; }
    const t = window.setTimeout(() => setPath(destRef.current, { replace: true }), prefs.reducedMotion ? 1200 : 3600);
    return () => window.clearTimeout(t);
  }, [loaded, prefs.skipIntro, prefs.reducedMotion, setPath]);
  return <main className="app-noise relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#101116] p-6">
    <div className="relative text-center">
      <div className="mx-auto w-fit"><Emblem size={140} mode={prefs.reducedMotion || prefs.animationIntensity === 'none' ? 'static' : 'intro'} title="Ayatrisya emblem" /></div>
      <div className="wm-reveal mt-6 text-4xl"><Wordmark /></div>
      <p className="wm-reveal mt-4 text-xs uppercase tracking-[.3em] text-slate-400">by Ametesx</p>
      <p className="mx-auto mt-4 max-w-xs text-sm text-slate-400">A private workspace for thoughtful work.</p>
      <div className="mt-10 flex flex-col items-center gap-4">
        <Button onClick={() => setPath(dest, { replace: true })} data-testid="button-skip-intro">Skip intro</Button>
        <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={prefs.skipIntro} onChange={(e) => { void save({ skipIntro: e.target.checked }); }} className="accent-violet-500" />Skip this intro next time</label>
      </div>
    </div>
  </main>;
}
