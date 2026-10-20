import { ArrowLeft, Download, HardDriveDownload } from 'lucide-react';
import { Link } from 'wouter';

const configuredDownload = (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined)?.trim();
const downloadUrl = configuredDownload?.startsWith('https://') ? configuredDownload : undefined;

const platforms = [
  {
    name: 'Linux',
    status: 'AppImage built for testing; public download not hosted',
  },
  {
    name: 'Windows',
    status: 'Installer build needs verification on Windows',
  },
  {
    name: 'macOS',
    status: 'DMG build needs verification on macOS',
  },
];

export function DesktopDownloadsPage() {
  return (
    <main className="min-h-[100dvh] bg-[#0d0e12] px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
          <ArrowLeft size={15} />
          Back to Ayatrisya
        </Link>

        <section className="mt-14 rounded-3xl border border-white/[.08] bg-[#13151b] p-6 sm:mt-20 sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
            <HardDriveDownload size={22} />
          </div>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.2em] text-violet-200">Ayatrisya Desktop</p>
          <h1 className="display mt-2 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">Get Ayatrisya Desktop</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            The desktop app can open folders you choose and run commands only after you approve them. The web app stays browser-only.
          </p>

          {downloadUrl ? (
            <a
              href={downloadUrl}
              rel="noopener noreferrer"
              className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <Download size={16} />
              Download Ayatrisya Desktop
            </a>
          ) : (
            <div role="status" className="mt-7 rounded-xl border border-amber-200/15 bg-amber-200/[.06] p-4 text-sm text-amber-100/90">
              Public installer downloads are not linked yet. This page will offer the installer when a public HTTPS release URL is configured.
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/[.08] bg-[#111319] p-5 sm:p-7" aria-labelledby="platform-status">
          <h2 id="platform-status" className="text-sm font-semibold text-slate-200">Installer status</h2>
          <ul className="mt-4 divide-y divide-white/[.06]">
            {platforms.map((platform) => (
              <li key={platform.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium">{platform.name}</span>
                <span className="text-xs leading-5 text-slate-400">{platform.status}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            A hosted download link is required for visitors to download an installer. Build instructions remain in the project documentation.
          </p>
        </section>

        <Link href="/" className="mt-6 inline-flex min-h-10 items-center text-sm text-slate-400 transition-colors hover:text-white">
          Return to the web app
        </Link>
      </div>
    </main>
  );
}
