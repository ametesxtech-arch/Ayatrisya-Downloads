import { ArrowLeft, Download, HardDriveDownload } from "lucide-react";
import { Link } from "wouter";
import { PublicSiteFooter, PublicSiteHeader } from "@/components/PublicSite";
import { Button } from "@/components/Primitives";
import { detectDevicePlatform } from "@/pwa/device";
import { usePwa } from "@/pwa/PwaProvider";
import { MotionText } from "@/components/MotionText";

const env = import.meta.env as unknown as {
  VITE_DESKTOP_DOWNLOAD_URL?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_URL?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_URL?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_URL?: string;
};

function secureHttpsUrl(value?: string) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const releasePageUrl = secureHttpsUrl(env.VITE_DESKTOP_DOWNLOAD_URL);
const platforms = [
  {
    name: "Linux",
    status: "Linux x64 AppImage target configured; unsigned; installer launch not verified here",
    downloadUrl: secureHttpsUrl(env.VITE_DESKTOP_DOWNLOAD_LINUX_URL),
  },
  {
    name: "Windows",
    status: "Windows x64 NSIS target configured; unsigned; installation and startup not verified here",
    downloadUrl: secureHttpsUrl(env.VITE_DESKTOP_DOWNLOAD_WINDOWS_URL),
  },
  {
    name: "macOS",
    status: "macOS DMG target configured; build, signing, notarization, and launch not verified here",
    downloadUrl: secureHttpsUrl(env.VITE_DESKTOP_DOWNLOAD_MAC_URL),
  },
];

export function DesktopDownloadsPage() {
  const pwa = usePwa();
  const browserNavigator = navigator as Navigator & { userAgentData?: { platform?: string } };
  const device = detectDevicePlatform({
    userAgentDataPlatform: browserNavigator.userAgentData?.platform,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const recommendedPlatform = device === "ios" || device === "android" ? "pwa" : device;

  return (
    <div className="desktop-downloads min-h-[100dvh] bg-[#0d0e12] text-slate-100">
      <PublicSiteHeader />
      <main className="px-5 py-8 sm:px-8 sm:py-12">
       <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to Ayatrisya
        </Link>

        <section className="mt-14 rounded-3xl border border-white/[.08] bg-[#13151b] p-6 sm:mt-20 sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
            <HardDriveDownload size={22} />
          </div>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.2em] text-violet-200">
            Ayatrisya Desktop
          </p>
          <h1 className="display mt-2 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">
            <MotionText>Get Ayatrisya Desktop</MotionText>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            Ayatrisya Desktop can open folders you choose and run commands only
            after you approve them. The website remains browser-only unless you
            explicitly pair it with the desktop app on this same computer.
          </p>

          {releasePageUrl ? (
            <a
              href={releasePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <Download size={16} />
              Open Ayatrisya releases
            </a>
          ) : (
            <div
              role="status"
              className="mt-7 rounded-xl border border-amber-200/15 bg-amber-200/[.06] p-4 text-sm text-amber-100/90"
            >
              Public release and installer links are not configured yet.
            </div>
          )}
        </section>

        <section
          className="mt-6 rounded-2xl border border-white/[.08] bg-[#111319] p-5 sm:p-7"
          aria-labelledby="platform-status"
        >
          <h2
            id="platform-status"
            className="text-sm font-semibold text-slate-200"
          >
            <MotionText>Installer status</MotionText>
          </h2>
          <ul className="mt-4 divide-y divide-white/[.06]">
            {platforms.map((platform) => (
              <li
                key={platform.name}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{platform.name}</span>
                    {recommendedPlatform === platform.name.toLowerCase() && (
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/[.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100" data-testid={`status-recommended-${platform.name.toLowerCase()}`}>
                        Recommended for this device
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {platform.status}
                  </p>
                </div>
                {platform.downloadUrl ? (
                  <a
                    href={platform.downloadUrl}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-violet-300/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:self-auto"
                  >
                    <Download size={14} />
                    Download
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-slate-500">
                    Not available yet
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Each installer needs its own public HTTPS download URL. Build
            instructions are in the project documentation.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[.025] p-5 sm:p-7" aria-labelledby="pwa-install-title">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-200">Web app</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 id="pwa-install-title" className="display text-xl font-semibold"><MotionText>Install Ayatrisya in your browser</MotionText></h2>
            {recommendedPlatform === "pwa" && <span className="rounded-full border border-violet-300/20 bg-violet-300/[.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100" data-testid="status-recommended-pwa">Recommended for this device</span>}
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
            The installable web app uses this browser’s saved workspace. Offline mode currently shows a static notice; the full workspace, sign-in, AI, sync, and downloads require a connection. Local folders and terminal commands require Ayatrisya Desktop and explicit same-computer pairing.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {pwa.isInstalled ? (
              <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[.06] px-4 text-xs font-semibold text-emerald-100" role="status" data-testid="status-pwa-installed">
                Ayatrisya is installed
              </span>
            ) : pwa.canInstall ? (
              <Button onClick={() => void pwa.install()} data-testid="button-install-pwa">
                <Download size={15} />Install web app
              </Button>
            ) : import.meta.env.DEV ? (
              <span className="text-xs text-slate-500" role="status" data-testid="status-pwa-install">
                Install prompts are enabled in production builds, not the development server.
              </span>
            ) : device === "ios" ? (
              <span className="text-xs text-slate-400" role="status" data-testid="status-pwa-install">
                In Safari, tap Share, then choose “Add to Home Screen”.
              </span>
            ) : pwa.serviceWorkerState === "unsupported" ? (
              <span className="text-xs text-slate-500" role="status" data-testid="status-pwa-install">
                This browser does not support the required offline app features.
              </span>
            ) : pwa.serviceWorkerState === "error" ? (
              <span className="text-xs text-amber-200/80" role="status" data-testid="status-pwa-install">
                The app could not enable offline support in this browser.
              </span>
            ) : (
              <span className="text-xs text-slate-400" role="status" data-testid="status-pwa-install">
                Open your browser menu and choose “Install Ayatrisya” or “Add to Home Screen” when offered.
              </span>
            )}
          </div>
        </section>

        <Link
          href="/"
          className="mt-6 inline-flex min-h-10 items-center text-sm text-slate-400 transition-colors hover:text-white"
        >
          Return to the web app
        </Link>
       </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
