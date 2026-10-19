import { useEffect } from 'react';
import { Info, X } from 'lucide-react';

export function Toast({
  message,
  close,
}: {
  message: string;
  close: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(close, 4000);
    return () => window.clearTimeout(id);
  }, [close]);
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-[#20232c] px-4 py-3 text-xs text-slate-200 shadow-2xl"
    >
      <Info size={15} className="text-blue-300" />
      {message}
      <button onClick={close} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  );
}
