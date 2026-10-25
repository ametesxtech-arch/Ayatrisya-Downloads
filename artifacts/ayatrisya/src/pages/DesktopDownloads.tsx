import {
  ArrowLeft,
  ChevronDown,
  Download,
  HardDriveDownload,
  ShieldAlert,
} from "lucide-react";
import { Link } from "wouter";
import { PublicSiteFooter, PublicSiteHeader } from "@/components/PublicSite";
import { Button } from "@/components/Primitives";
import { detectDevicePlatform } from "@/pwa/device";
import { usePwa } from "@/pwa/PwaProvider";
import { MotionText } from "@/components/MotionText";
import {
  DEFAULT_PUBLISHED_RELEASES,
  formatInstallerSize,
  OFFICIAL_RELEASE_TAG_URL,
  resolveDesktopRelease,
  secureHttpsUrl,
} from "@/data/desktop-releases";

const env = import.meta.env as unknown as {
  VITE_DESKTOP_DOWNLOAD_URL?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_URL?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_VERSION?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_SIZE_BYTES?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_SHA256?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_NOTES_URL?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_VERIFICATION_REPORT_URL?: string;
  VITE_DESKTOP_DOWNLOAD_LINUX_VERIFICATION_SUMMARY?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_URL?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_VERSION?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_SIZE_BYTES?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_SHA256?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_NOTES_URL?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_VERIFICATION_REPORT_URL?: string;
  VITE_DESKTOP_DOWNLOAD_WINDOWS_VERIFICATION_SUMMARY?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_URL?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_VERSION?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_SIZE_BYTES?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_SHA256?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_NOTES_URL?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_VERIFICATION_REPORT_URL?: string;
  VITE_DESKTOP_DOWNLOAD_MAC_VERIFICATION_SUMMARY?: string;
};

const getVal = (val?: string, fallback?: string) => (val && val.trim() ? val.trim() : fallback);

const releasePageUrl =
  secureHttpsUrl(env.VITE_DESKTOP_DOWNLOAD_URL) ?? OFFICIAL_RELEASE_TAG_URL;
const platforms = [
  {
    name: "Linux",
    id: "linux",
    target: "Linux x64 · AppImage",
    release: resolveDesktopRelease({
      downloadUrl: getVal(
        env.VITE_DESKTOP_DOWNLOAD_LINUX_URL,
        DEFAULT_PUBLISHED_RELEASES.linux.downloadUrl,
      ),
      expectedExtension: ".appimage",
      version: getVal(
        env.VITE_DESKTOP_DOWNLOAD_LINUX_VERSION,
        DEFAULT_PUBLISHED_RELEASES.linux.version,
      ),
      sizeBytes: getVal(
        env.VITE_DESKTOP_DOWNLOAD_LINUX_SIZE_BYTES,
        DEFAULT_PUBLISHED_RELEASES.linux.sizeBytes,
      ),
      sha256: getVal(
        env.VITE_DESKTOP_DOWNLOAD_LINUX_SHA256,
        DEFAULT_PUBLISHED_RELEASES.linux.sha256,
      ),
      releaseNotesUrl: getVal(
        env.VITE_DESKTOP_DOWNLOAD_LINUX_NOTES_URL,
        releasePageUrl,
      ),
      verificationReportUrl:
        env.VITE_DESKTOP_DOWNLOAD_LINUX_VERIFICATION_REPORT_URL,
      verificationSummary:
        env.VITE_DESKTOP_DOWNLOAD_LINUX_VERIFICATION_SUMMARY,
    }),
  },
  {
    name: "Windows",
    id: "windows",
    target: "Windows x64 · NSIS installer (.exe)",
    release: resolveDesktopRelease({
      downloadUrl: getVal(
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_URL,
        DEFAULT_PUBLISHED_RELEASES.windows.downloadUrl,
      ),
      expectedExtension: ".exe",
      version: getVal(
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_VERSION,
        DEFAULT_PUBLISHED_RELEASES.windows.version,
      ),
      sizeBytes: getVal(
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_SIZE_BYTES,
        DEFAULT_PUBLISHED_RELEASES.windows.sizeBytes,
      ),
      sha256: getVal(
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_SHA256,
        DEFAULT_PUBLISHED_RELEASES.windows.sha256,
      ),
      releaseNotesUrl: getVal(
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_NOTES_URL,
        releasePageUrl,
      ),
      verificationReportUrl:
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_VERIFICATION_REPORT_URL,
      verificationSummary:
        env.VITE_DESKTOP_DOWNLOAD_WINDOWS_VERIFICATION_SUMMARY,
    }),
  },
  {
    name: "macOS",
    id: "macos",
    target: "macOS universal · DMG",
    release: resolveDesktopRelease({
      downloadUrl: getVal(
        env.VITE_DESKTOP_DOWNLOAD_MAC_URL,
        DEFAULT_PUBLISHED_RELEASES.macos.downloadUrl,
      ),
      expectedExtension: ".dmg",
      version: getVal(
        env.VITE_DESKTOP_DOWNLOAD_MAC_VERSION,
        DEFAULT_PUBLISHED_RELEASES.macos.version,
      ),
      sizeBytes: getVal(
        env.VITE_DESKTOP_DOWNLOAD_MAC_SIZE_BYTES,
        DEFAULT_PUBLISHED_RELEASES.macos.sizeBytes,
      ),
      sha256: getVal(
        env.VITE_DESKTOP_DOWNLOAD_MAC_SHA256,
        DEFAULT_PUBLISHED_RELEASES.macos.sha256,
      ),
      releaseNotesUrl: getVal(
        env.VITE_DESKTOP_DOWNLOAD_MAC_NOTES_URL,
        releasePageUrl,
      ),
      verificationReportUrl:
        env.VITE_DESKTOP_DOWNLOAD_MAC_VERIFICATION_REPORT_URL,
      verificationSummary:
        env.VITE_DESKTOP_DOWNLOAD_MAC_VERIFICATION_SUMMARY,
    }),
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
      <main className="px-4 py-7 sm:px-8 sm:py-12">
       <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none"
        >
          <ArrowLeft size={15} />
          Back to Ayatrisya
        </Link>

        <section className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-white/[.09] bg-[#13151b] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,.8)] sm:mt-12 sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-violet-400/[.06] blur-3xl" />
          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <HardDriveDownload size={22} />
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[.2em] text-violet-200">
              Ayatrisya Desktop <span className="px-1 text-violet-200/40">/</span> Installation center
            </p>
            <h1 className="display mt-2 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">
              <MotionText>Get Ayatrisya Desktop</MotionText>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
              Choose a build for your computer. Ayatrisya Desktop can open folders you choose and run commands only after you approve them. The website stays browser-only unless you explicitly pair it with the desktop app on this same computer.
            </p>

            {releasePageUrl ? (
              <a
                href={releasePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none"
              >
                <Download size={16} aria-hidden="true" />
                Browse releases
              </a>
            ) : platforms.every(
                (platform) => platform.release.status === "not-available",
              ) ? (
              <p
                role="status"
                className="mt-7 flex items-start gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[.045] p-4 text-sm leading-6 text-amber-100/90"
              >
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-200/70" aria-hidden="true" />
                Public release and installer links are not configured yet. Local development builds are not public releases.
              </p>
            ) : (
              <p
                role="status"
                className="mt-7 flex items-start gap-3 rounded-xl border border-emerald-200/15 bg-emerald-200/[.04] p-4 text-sm leading-6 text-emerald-100/90"
              >
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-200/70" aria-hidden="true" />
                Platform downloads are listed below with their version, file size, SHA-256 checksum, release notes, and verification status.
              </p>
            )}
          </div>
        </section>

        <section
          className="mt-5 rounded-2xl border border-white/[.08] bg-[#111319] p-5 sm:mt-6 sm:p-7"
          aria-labelledby="platform-status"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-slate-500">Build targets</p>
              <h2 id="platform-status" className="mt-1 text-base font-semibold text-slate-100">
                <MotionText>Installer availability</MotionText>
              </h2>
            </div>
            <p className="text-xs text-slate-500">One installer link per platform</p>
          </div>
          <ul className="mt-4 divide-y divide-white/[.06]">
            {platforms.map((platform) => (
              <li
                key={platform.name}
                className="flex flex-col gap-4 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between motion-reduce:transition-none"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-slate-100">{platform.name}</span>
                    <span className="text-xs text-slate-500">{platform.target}</span>
                    {recommendedPlatform === platform.id && (
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/[.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100" data-testid={`status-recommended-${platform.id}`}>
                        For this device
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-2 inline-flex items-center gap-2 text-xs leading-5 ${
                      platform.release.status === "verified"
                        ? "text-emerald-200/90"
                        : platform.release.status === "available-unverified"
                          ? "text-amber-200/90"
                          : "text-slate-500"
                    }`}
                    role="status"
                    data-testid={`platform-status-${platform.id}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        platform.release.status === "verified"
                          ? "bg-emerald-300/80"
                          : platform.release.status === "available-unverified"
                            ? "bg-amber-300/80"
                            : "bg-slate-600"
                      }`}
                      aria-hidden="true"
                    />
                    {platform.release.status === "verified"
                      ? "Verified"
                      : platform.release.status === "available-unverified"
                        ? "Available — unverified"
                        : "Not available yet"}
                  </p>
                  {platform.release.status === "not-available" ? (
                    <p
                      className="mt-1 max-w-2xl text-xs leading-5 text-slate-500"
                      data-testid={`release-unavailable-reason-${platform.id}`}
                    >
                      {platform.release.reason}
                    </p>
                  ) : (
                    <div
                      className="mt-3 grid gap-x-6 gap-y-2 rounded-xl border border-white/[.06] bg-white/[.02] p-3 text-xs sm:grid-cols-2"
                      data-testid={`release-metadata-${platform.id}`}
                    >
                      <p><span className="text-slate-500">Version</span><span className="ml-2 text-slate-200">{platform.release.version}</span></p>
                      <p><span className="text-slate-500">File size</span><span className="ml-2 text-slate-200">{formatInstallerSize(platform.release.sizeBytes!)}</span></p>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500">SHA-256</span>
                        <code className="ml-2 break-all font-mono text-[10px] text-slate-300">{platform.release.sha256}</code>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2">
                        {platform.release.releaseNotesUrl && (
                          <a
                            href={platform.release.releaseNotesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-200 underline decoration-violet-300/30 underline-offset-4 hover:text-violet-100"
                          >
                            Release notes
                          </a>
                        )}
                        {platform.release.status === "verified" &&
                          platform.release.verificationReportUrl && (
                            <a
                              href={platform.release.verificationReportUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-200 underline decoration-emerald-300/30 underline-offset-4 hover:text-emerald-100"
                            >
                              Test report
                            </a>
                          )}
                      </div>
                      {platform.release.status === "verified" &&
                        platform.release.verificationSummary && (
                          <p className="leading-5 text-slate-400 sm:col-span-2">
                            {platform.release.verificationSummary}
                          </p>
                        )}
                    </div>
                  )}
                </div>
                {platform.release.downloadUrl ? (
                  <a
                    href={platform.release.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-violet-300/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-100 transition-colors hover:border-violet-200/40 hover:bg-violet-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none sm:w-auto sm:self-auto"
                    data-testid={`download-action-${platform.id}`}
                  >
                    <Download size={14} aria-hidden="true" />
                    Download installer
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex min-h-10 w-full shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/[.07] bg-white/[.025] px-3 text-xs font-semibold text-slate-600 sm:w-auto"
                    data-testid={`download-action-${platform.id}`}
                  >
                    <Download size={14} aria-hidden="true" />
                    Not available yet
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[.06] pt-4 text-xs leading-5 text-slate-500">
            Downloads remain disabled until a platform-specific direct HTTPS installer URL and release metadata are configured. “Verified” is shown only with a linked test report and summary; it still depends on that published evidence.
          </p>
        </section>

        <details
          className="group mt-5 overflow-hidden rounded-2xl border border-amber-200/10 bg-[#111319] transition-colors open:border-amber-200/20 sm:mt-6 motion-reduce:transition-none"
          data-testid="security-guide"
        >
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300 sm:px-7 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/10 bg-amber-200/[.05] text-amber-100/80">
                <ShieldAlert size={17} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-200">Installing Ayatrisya when security warnings appear</span>
                <span className="mt-1 block text-xs text-slate-500">A cautious checklist for desktop installers</span>
              </span>
            </span>
            <ChevronDown size={17} aria-hidden="true" className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="border-t border-white/[.06] px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
            <p className="max-w-3xl text-xs leading-6 text-slate-400">
              If a Windows or macOS build is unsigned, the operating system may show a publisher or security warning. A warning is not a reason to bypass protections: stop if you cannot verify where the installer came from.
            </p>
            <ul className="mt-4 grid gap-3 text-xs leading-5 text-slate-400 sm:grid-cols-2">
              <li className="rounded-xl border border-white/[.06] bg-white/[.02] p-4">
                <span className="font-semibold text-slate-200">Use a trusted source.</span>{" "}
                Download only from Ayatrisya’s official HTTPS release page or another trusted official HTTPS source.
              </li>
              <li className="rounded-xl border border-white/[.06] bg-white/[.02] p-4">
                <span className="font-semibold text-slate-200">Compare the published hash.</span>{" "}
                If a matching SHA-256 checksum is published through an official source, compare it with your file. A matching checksum is not proof that software is safe.
              </li>
              <li className="rounded-xl border border-white/[.06] bg-white/[.02] p-4">
                <span className="font-semibold text-slate-200">Keep protections on.</span>{" "}
                Never disable Windows Defender, SmartScreen, or macOS Gatekeeper to install a build.
              </li>
              <li className="rounded-xl border border-white/[.06] bg-white/[.02] p-4">
                <span className="font-semibold text-slate-200">Linux AppImage.</span>{" "}
                If needed, allow the file to run as a program in your file manager’s permissions, or use <code className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">chmod +x</code> on the AppImage.
              </li>
            </ul>
          </div>
        </details>

        <section className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-300/[.025] p-5 sm:mt-6 sm:p-7" aria-labelledby="pwa-install-title" data-testid="pwa-install-section">
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
