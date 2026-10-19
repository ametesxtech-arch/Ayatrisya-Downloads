import { useEffect, useState } from 'react';

export type Notice = { id: number; message: string; action?: { label: string; run: () => void | Promise<void> } };
let current: Notice | null = null;
let n = 0;
const listeners = new Set<(x: Notice | null) => void>();
export function pushNotice(message: string, action?: Notice['action']) {
  current = { id: ++n, message, action };
  listeners.forEach((l) => l(current));
}
export function dismissNotice() { current = null; listeners.forEach((l) => l(null)); }
export function useNotice() {
  const [v, setV] = useState<Notice | null>(current);
  useEffect(() => { listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return v;
}
