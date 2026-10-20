import { Download } from 'lucide-react';
import { Link } from 'wouter';

const url = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined)?.trim();
const downloadUrl = url?.startsWith('https://') ? url : undefined;

export function DesktopButton({ className = '' }: { className?: string }) {
  const classes = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${className}`;

  if (downloadUrl) {
    return <a href={downloadUrl} aria-label="Get Ayatrisya Desktop" rel="noopener noreferrer" className={classes}><Download size={15} /> Get Ayatrisya Desktop</a>;
  }

  return <Link href="/desktop" aria-label="Get Ayatrisya Desktop" className={classes}><Download size={15} /> Get Ayatrisya Desktop</Link>;
}
