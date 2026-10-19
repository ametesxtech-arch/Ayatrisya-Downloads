import { Download } from 'lucide-react';
import { Button } from '@/components/Primitives';

const url = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined)?.trim();

export function DesktopButton({ className = '' }: { className?: string }) {
  if (url && url.startsWith('https://'))
    return <a href={url} rel="noopener noreferrer" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:bg-white/[.06] ${className}`}><Download size={15} /> Get Ayatrisya Desktop</a>;
  return <Button variant="outline" disabled className={className}><Download size={15} /> Get Ayatrisya Desktop <span className="text-[10px] uppercase tracking-wider text-slate-500">Coming soon</span></Button>;
}
