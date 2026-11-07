import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';
import { usePrefs } from '@/hooks/use-prefs';

export type EmblemMode = 'static' | 'intro' | 'loading' | 'subtle';

const markUrl = `${import.meta.env.BASE_URL}brand/ayatrisya-mark.svg`;

/** Shared Ayatrisya mark used by loading, empty-state, and brand surfaces. */
export function Emblem({ size = 40, mode = 'static', title }: { size?: number; mode?: EmblemMode; title?: string }) {
  return (
    <img
      src={markUrl}
      width={size}
      height={size}
      className={cx('brand-mark', `brand-mark-${mode}`)}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
}

export function Mark({ small = false }: { small?: boolean }) {
  return <Emblem size={small ? 30 : 40} />;
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={cx('display font-extrabold tracking-[-.04em] truncate select-none', className)}>ayatrisya</span>;
}

/** Compact brand: never plays the full intro. Optional quiet idle pulse when enabled in settings. */
export function Brand({ compact = false, markOnly = false }: { compact?: boolean; markOnly?: boolean }) {
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
      {!markOnly && <Wordmark className={compact ? 'text-[15px]' : 'text-[17px]'} />}
    </div>
  );
}
