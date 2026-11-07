import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, Info, Sparkles } from 'lucide-react';

export function Button({ children, onClick, variant = 'solid', className = '', type = 'button', disabled = false, autoFocus = false, ...rest }: { title?: string; 'data-testid'?: string; 'aria-label'?: string; autoFocus?: boolean; children: ReactNode; onClick?: () => void; variant?: 'solid' | 'quiet' | 'outline' | 'bubble'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button {...rest} type={type} disabled={disabled} autoFocus={autoFocus} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${variant === 'solid' ? 'bg-violet-500 text-white hover:bg-violet-400 shadow-[0_6px_22px_rgba(117,98,222,.18)]' : variant === 'outline' ? 'border border-white/10 bg-white/[.025] text-slate-200 hover:border-white/20 hover:bg-white/[.06]' : variant === 'bubble' ? 'bubble-control bubble-btn text-slate-200 hover:text-white' : 'text-slate-300 hover:bg-white/[.06]'} ${className}`}>{children}</button>;
}
export function IconButton({ children, label, onClick, className = '', ...rest }: { children: ReactNode; label: string; onClick?: () => void; className?: string; 'data-testid'?: string }) {
  return <button {...rest} aria-label={label} data-tip={label} onClick={onClick} className={`grid size-9 place-items-center rounded-lg text-slate-400 transition active:scale-95 hover:bg-white/[.07] hover:text-white ${className}`}>{children}</button>;
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/[.075] bg-[#15171e] ${className}`}>{children}</section>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-violet-300"><span className="h-px w-5 bg-violet-400/60"/>{children}</div>;
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-lg border border-blue-300/10 bg-blue-300/[.045] p-3.5 text-xs leading-relaxed text-slate-400"><Info size={15} className="mt-0.5 shrink-0 text-blue-300"/><div>{children}</div></div>;
}
const modalStack: symbol[] = [];
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const id = Symbol('modal');
    modalStack.push(id);
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const list = () => Array.from(el.querySelectorAll<HTMLElement>(sel));
    const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? list().find((x) => x.dataset.close === undefined) ?? list()[0];
    (target ?? el).focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function key(e: KeyboardEvent) {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const f = list();
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      modalStack.splice(modalStack.indexOf(id), 1);
      document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);
  return <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} className="safe-t fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`reveal max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#171920] p-5 shadow-2xl sm:p-6 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}><header className="mb-5 flex items-center justify-between gap-3"><h2 id={titleId} className="display text-lg font-bold">{title}</h2><button data-close="" onClick={onClose} aria-label="Close dialog" className="rounded-md p-2 text-slate-400 hover:bg-white/10"><X size={17}/></button></header>{children}</section></div>;
}
export function ConfirmDialog({ title, body, confirmLabel, danger = false, onConfirm, onClose }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return <Modal title={title} onClose={onClose}><div className="text-sm leading-6 text-slate-400">{body}</div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose} autoFocus>Cancel</Button><button disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }} className={`inline-flex min-h-10 items-center rounded-lg px-4 font-semibold text-white disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-500 hover:bg-violet-400'}`}>{busy ? 'Working…' : confirmLabel}</button></div></Modal>;
}
export const inputCls = 'h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm text-white placeholder:text-slate-500';
export const areaCls = 'w-full rounded-lg border border-white/10 bg-[#101116] p-3 text-sm leading-6 text-white placeholder:text-slate-500';
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-white/[.05] ${className}`} />;
}
export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-5 text-sm text-rose-200"><p>Could not read local storage: {message}</p><Button variant="outline" className="mt-3" onClick={retry}>Try again</Button></div>;
}
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 sm:gap-4 py-3 min-w-0">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-200 break-words">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-400 break-words">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-violet-500 cursor-pointer"
      />
    </label>
  );
}
export function EmptyPreview({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[.012] px-6 text-center"><div className="mb-3 grid size-11 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[.06] text-violet-200"><Sparkles size={19}/></div><h3 className="font-semibold text-slate-200">{title}</h3><p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{detail}</p></div>;
}
