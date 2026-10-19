import { type ReactNode } from 'react';
import { X, Info, Sparkles } from 'lucide-react';

export function Button({ children, onClick, variant = 'solid', className = '', type = 'button', disabled = false }: { children: ReactNode; onClick?: () => void; variant?: 'solid' | 'quiet' | 'outline'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${variant === 'solid' ? 'bg-violet-500 text-white hover:bg-violet-400 shadow-[0_6px_22px_rgba(117,98,222,.18)]' : variant === 'outline' ? 'border border-white/10 bg-white/[.025] text-slate-200 hover:border-white/20 hover:bg-white/[.06]' : 'text-slate-300 hover:bg-white/[.06]'} ${className}`}>{children}</button>;
}
export function IconButton({ children, label, onClick, className = '' }: { children: ReactNode; label: string; onClick?: () => void; className?: string }) {
  return <button aria-label={label} title={label} onClick={onClick} className={`grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[.07] hover:text-white ${className}`}>{children}</button>;
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
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div role="presentation" onMouseDown={(e) => { if(e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label={title} className="reveal w-full max-w-lg rounded-2xl border border-white/10 bg-[#171920] p-6 shadow-2xl"><header className="mb-5 flex items-center justify-between"><h2 className="display text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="rounded-md p-2 text-slate-400 hover:bg-white/10"><X size={17}/></button></header>{children}</section></div>;
}
export function EmptyPreview({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[.012] px-6 text-center"><div className="mb-3 grid size-11 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[.06] text-violet-200"><Sparkles size={19}/></div><h3 className="font-semibold text-slate-200">{title}</h3><p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{detail}</p></div>;
}
