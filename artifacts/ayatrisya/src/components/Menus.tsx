import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string; divider?: boolean };

export function FloatingMenu({ x, y, items, onClose, label = 'Actions' }: { x: number; y: number; items: MenuItem[]; onClose: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const btns = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    btns()[0]?.focus();
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      const b = btns(); const i = b.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); b[(i + 1) % b.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); b[(i - 1 + b.length) % b.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); b[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); b[b.length - 1]?.focus(); }
      else if (e.key === 'Tab') { e.preventDefault(); closeRef.current(); }
    }
    function down(e: PointerEvent) { if (!el.contains(e.target as Node)) closeRef.current(); }
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', down);
    window.addEventListener('blur', onClose);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', down); window.removeEventListener('blur', onClose); if (opener && document.contains(opener)) opener.focus(); };
  }, [onClose]);
  return createPortal(
    <div ref={ref} role="menu" aria-label={label} style={{ left: x, top: y }} className="fixed z-[70] min-w-[190px] rounded-xl border border-white/10 bg-[#1b1d25] p-1.5 shadow-2xl">
      {items.map((it, i) => it.divider ? <div key={i} role="separator" className="my-1 h-px bg-white/[.08]" /> : (
        <button key={i} type="button" role="menuitem" disabled={it.disabled} onClick={() => { try { it.onSelect(); } finally { onClose(); } }} className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-xs disabled:opacity-40 ${it.danger ? 'text-rose-300 hover:bg-rose-400/10' : 'text-slate-200 hover:bg-white/[.07]'}`}>
          {it.label}{it.hint && <span className="text-[10px] text-slate-500">{it.hint}</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function ActionMenu({ label, items, children, className = '', up = false }: { label: string; items: MenuItem[]; children?: ReactNode; className?: string; up?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return <>
    <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={!!pos} data-tip={label} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: Math.max(8, r.right - 200), y: up ? Math.max(8, r.top - items.length * 36 - 20) : r.bottom + 4 }); }} className={`grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[.07] hover:text-white ${className}`}>{children ?? <MoreHorizontal size={16} />}</button>
    {pos && <FloatingMenu x={pos.x} y={pos.y} items={items} label={label} onClose={() => setPos(null)} />}
  </>;
}

/** Hook for right-click / long-press style menus on rows. */
export function useContextMenu() {
  const [m, setM] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = (items: MenuItem[]) => (e: React.MouseEvent) => { e.preventDefault(); setM({ x: e.clientX, y: e.clientY, items }); };
  const node = m ? <FloatingMenu x={m.x} y={m.y} items={m.items} onClose={() => setM(null)} /> : null;
  return { open, node };
}
