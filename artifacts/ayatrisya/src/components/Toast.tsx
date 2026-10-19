import { useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { dismissNotice, useNotice } from '@/lib/notify';

export function NoticeHost() {
  const n = useNotice();
  useEffect(() => {
    if (!n) return;
    const id = window.setTimeout(dismissNotice, n.action ? 8000 : 5000);
    return () => window.clearTimeout(id);
  }, [n]);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4">
      {n && (
        <div className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-lg border border-white/10 bg-[#20232c] px-4 py-3 text-xs text-slate-200 shadow-2xl">
          <Info size={15} className="shrink-0 text-blue-300" />
          <span>{n.message}</span>
          {n.action && <button onClick={async () => { const a = n.action!; dismissNotice(); await a.run(); }} className="font-semibold text-violet-200 underline">{n.action.label}</button>}
          <button onClick={dismissNotice} aria-label="Dismiss notification"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

/** Legacy API kept for pages outside the workspace shell. */
export function Toast({ message, close }: { message: string; close: () => void }) {
  useEffect(() => { const id = window.setTimeout(close, 4000); return () => window.clearTimeout(id); }, [close]);
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-[90] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-[#20232c] px-4 py-3 text-xs text-slate-200 shadow-2xl">
      <Info size={15} className="text-blue-300" />{message}
      <button onClick={close} aria-label="Dismiss notification"><X size={14} /></button>
    </div>
  );
}
