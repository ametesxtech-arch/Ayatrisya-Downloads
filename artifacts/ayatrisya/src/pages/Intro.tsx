import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Emblem, Wordmark } from '@/components/Brand';
import { Button } from '@/components/Primitives';
import { usePrefs } from '@/hooks/use-prefs';
import { FractalGlass } from '@/components/fractal-glass';

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

  return (
    <main className="app-noise relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#101116] p-4 text-slate-100">
      <div className="relative w-full max-w-[820px] overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
        <FractalGlass
          src="/assets/fractal-glass/mountain.webp"
          alt="Snow-covered Himalayan mountains"
          animateEntrance={!prefs.reducedMotion}
          mode="default"
          stripes={26}
          distortion={24}
          refractionBias={-0.1}
          blur={20}
          grain={0.005}
          smoothness={7.3}
          textureScale={103}
          blackPoint={0}
          whitePoint={232}
          gamma={0.78}
          edgeWidth={0}
          coverage={0.55}
          coverageMode="stripes"
          side="left"
          direction="vertical"
          hoverEffect={true}
          hoverPreset="reveal-on-hover"
          recoveryDirection="same"
          hoverAnimation="procedural"
          hoverDuration={880}
          hoverRadius={120}
          hoverFeather={16}
          transitionBlend={0.5}
          duration={570}
          ease="power4.out"
          disabled={false}
          height={540}
          borderRadius={16}
          className="w-full object-cover"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#101116]/90 via-black/50 to-[#101116]/80 p-6 backdrop-blur-[2px]">
          <div className="relative text-center">
            <div className="mx-auto w-fit">
              <Emblem size={110} mode={prefs.reducedMotion || prefs.animationIntensity === 'none' ? 'static' : 'intro'} title="Ayatrisya emblem" />
            </div>
            <div className="wm-reveal mt-5 text-4xl font-extrabold tracking-tight text-white"><Wordmark /></div>
            <p className="wm-reveal mt-3 text-xs uppercase tracking-[.3em] text-slate-400">by Ametesx</p>
            <p className="mx-auto mt-3 max-w-xs text-sm text-slate-300">A private workspace for thoughtful work.</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button onClick={() => setPath(dest, { replace: true })} data-testid="button-skip-intro">Enter workspace</Button>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={prefs.skipIntro} onChange={(e) => { void save({ skipIntro: e.target.checked }); }} className="accent-violet-500" />
                Skip this intro next time
              </label>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
