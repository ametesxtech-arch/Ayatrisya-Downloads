import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';
import { usePrefs } from '@/hooks/use-prefs';

export type EmblemMode = 'static' | 'intro' | 'loading' | 'subtle';

const points = [[-26, -20], [24, -26], [30, 14], [-22, 26], [0, -34], [-34, 4]];

/** Original Ayatrisya emblem: nested open arches around a luminous threshold. */
export function Emblem({ size = 40, mode = 'static', title }: { size?: number; mode?: EmblemMode; title?: string }) {
  const id = `eg-${mode}-${size}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cx('emb', `emb-${mode}`, mode === 'loading' && 'emb-loop')} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} fill="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#9d8cff" /><stop offset="1" stopColor="#5568f0" /></linearGradient>
        <radialGradient id={`${id}-glow`}><stop stopColor="#8b7cf6" stopOpacity=".55" /><stop offset="1" stopColor="#8b7cf6" stopOpacity="0" /></radialGradient>
      </defs>
      <circle className="emb-glow" cx="32" cy="32" r="30" fill={`url(#${id}-glow)`} />
      {mode === 'intro' && points.map(([x, y], i) => <circle key={i} className="emb-pt" cx="32" cy="32" r="1.4" fill="#cfc8ff" style={{ ['--x' as string]: `${x * 2.2}px`, ['--y' as string]: `${y * 2.2}px`, animationDelay: `${i * 60}ms` }} />)}
      <g stroke={`url(#${id})`} strokeLinecap="round" fill="none">
        <path className="emb-o1" d="M10 52V32C10 19.85 19.85 10 32 10s22 9.85 22 22v20" strokeWidth="2.8" />
        <path className="emb-o2" d="M19 52V32c0-7.18 5.82-13 13-13s13 5.82 13 13v20" strokeWidth="2.4" opacity=".88" />
        <path className="emb-ap" d="M27.5 45v-12a4.5 4.5 0 0 1 9 0v12" strokeWidth="2.4" opacity=".75" />
      </g>
      <path className="emb-threshold" d="M19 51.5h26" stroke={`url(#${id})`} strokeWidth="2.6" strokeLinecap="round" />
      <circle className="emb-core" cx="32" cy="33" r="3.1" fill="#e9e4ff" />
      <path className="emb-spark" d="M49 12c.45 2.45 1.2 3.2 3.65 3.65-2.45.45-3.2 1.2-3.65 3.65-.45-2.45-1.2-3.2-3.65-3.65C47.8 15.2 48.55 14.45 49 12Z" fill="#8ce7f0" />
    </svg>
  );
}

export function Mark({ small = false }: { small?: boolean }) {
  return <Emblem size={small ? 30 : 40} />;
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={cx('display font-extrabold tracking-[-.04em]', className)}>ayatrisya</span>;
}

/** Compact brand: never plays the full intro. Optional quiet idle pulse when enabled in settings. */
export function Brand({ compact = false }: { compact?: boolean }) {
  const { prefs } = usePrefs();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!prefs.logoIdle || prefs.animationIntensity === 'none' || prefs.reducedMotion) return;
    const t = window.setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 40000);
    return () => window.clearInterval(t);
  }, [prefs.logoIdle, prefs.animationIntensity, prefs.reducedMotion]);
  return (
    <div className="flex items-center gap-2.5">
      <span key={tick} className="grid size-8 place-items-center"><Emblem size={30} mode={tick ? 'subtle' : 'static'} /></span>
      <Wordmark className={compact ? 'text-[15px]' : 'text-[17px]'} />
    </div>
  );
}
