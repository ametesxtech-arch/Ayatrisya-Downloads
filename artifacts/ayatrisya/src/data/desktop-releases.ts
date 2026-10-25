export type DesktopReleaseStatus =
  | "not-available"
  | "available-unverified"
  | "verified";

export interface DesktopRelease {
  status: DesktopReleaseStatus;
  reason?: string;
  downloadUrl?: string;
  version?: string;
  sizeBytes?: number;
  sha256?: string;
  releaseNotesUrl?: string;
  verificationReportUrl?: string;
  verificationSummary?: string;
}

export interface DesktopReleaseInput {
  downloadUrl?: string;
  expectedExtension: string;
  version?: string;
  sizeBytes?: string;
  sha256?: string;
  releaseNotesUrl?: string;
  verificationReportUrl?: string;
  verificationSummary?: string;
}

export const OFFICIAL_RELEASE_TAG_URL =
  "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/tag/v0.0.0";

export const DEFAULT_PUBLISHED_RELEASES = {
  windows: {
    downloadUrl:
      "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/download/v0.0.0/Ayatrisya.Setup.0.0.0.exe",
    expectedExtension: ".exe",
    version: "0.0.0",
    sizeBytes: "124837324",
    sha256: "bef8bd59c3f31c77fbf52fff996388830f0f88ab174a5b77354a07882c6f9698",
    releaseNotesUrl: OFFICIAL_RELEASE_TAG_URL,
  },
  linux: {
    downloadUrl:
      "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/download/v0.0.0/Ayatrisya-0.0.0.AppImage",
    expectedExtension: ".appimage",
    version: "0.0.0",
    sizeBytes: "128640085",
    sha256: "0b1ec99a93fa6dee7191df2db905301ac51bb6d359c3caab6544eefd05518ead",
    releaseNotesUrl: OFFICIAL_RELEASE_TAG_URL,
  },
  macos: {
    downloadUrl:
      "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/download/v0.0.0/Ayatrisya-0.0.0-universal.dmg",
    expectedExtension: ".dmg",
    version: "0.0.0",
    sizeBytes: "220588534",
    sha256: "aef55ab1adaa51ff2eccbb9383ac37455f1bc32cc6942b27cad735ff193a9f9c",
    releaseNotesUrl: OFFICIAL_RELEASE_TAG_URL,
  },
} as const;

export function secureHttpsUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      isLocalOrPrivateHost(url.hostname)
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [first, second] = ipv4.slice(1).map(Number);
    return (
      first > 255 ||
      second > 255 ||
      Number(ipv4[3]) > 255 ||
      Number(ipv4[4]) > 255 ||
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    );
  }

  const ipv6 = host.replace(/^\[|\]$/g, "");
  if (ipv6.includes(":")) {
    return (
      ipv6 === "::" ||
      ipv6 === "::1" ||
      /^f[cd]/.test(ipv6) ||
      /^fe[89ab]/.test(ipv6) ||
      /^ff/.test(ipv6) ||
      ipv6.startsWith("::ffff:")
    );
  }

  return false;
}

export function resolveDesktopRelease(
  input: DesktopReleaseInput,
): DesktopRelease {
  const sourceWasProvided = Boolean(input.downloadUrl?.trim());
  const downloadUrl = secureHttpsUrl(input.downloadUrl);
  const expectedExtension = input.expectedExtension.toLowerCase();

  if (!downloadUrl) {
    return {
      status: "not-available",
      reason: sourceWasProvided
        ? "The installer source must be a valid HTTPS URL."
        : "No public installer URL is configured. Workspace build files are not hosted downloads.",
    };
  }

  const url = new URL(downloadUrl);
  if (!url.pathname.toLowerCase().endsWith(expectedExtension)) {
    return {
      status: "not-available",
      reason: `The installer URL must point directly to a ${expectedExtension} file.`,
    };
  }

  const version = input.version?.trim();
  const rawSizeBytes = input.sizeBytes?.trim();
  const sizeBytes =
    rawSizeBytes && /^\d+$/.test(rawSizeBytes)
      ? Number(rawSizeBytes)
      : Number.NaN;
  const sha256 = input.sha256?.trim().toLowerCase();
  const releaseNotesUrl = secureHttpsUrl(input.releaseNotesUrl);
  const hasCompleteMetadata =
    Boolean(version) &&
    Number.isSafeInteger(sizeBytes) &&
    sizeBytes > 0 &&
    Boolean(sha256 && /^[a-f0-9]{64}$/.test(sha256)) &&
    Boolean(releaseNotesUrl);

  if (!hasCompleteMetadata) {
    return {
      status: "not-available",
      reason:
        "Release metadata is incomplete. A version, file size, SHA-256 checksum, and HTTPS release-notes link are required before downloads are enabled.",
    };
  }

  const verificationReportUrl = secureHttpsUrl(
    input.verificationReportUrl,
  );
  const verificationSummary = input.verificationSummary?.trim();
  const verified = Boolean(verificationReportUrl && verificationSummary);

  return {
    status: verified ? "verified" : "available-unverified",
    downloadUrl,
    version,
    sizeBytes,
    sha256,
    releaseNotesUrl,
    ...(verified ? { verificationReportUrl, verificationSummary } : {}),
  };
}

export function formatInstallerSize(sizeBytes: number): string {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return "Size unavailable";
  const mib = sizeBytes / (1024 * 1024);
  if (mib >= 1024) return `${(mib / 1024).toFixed(2)} GiB`;
  return `${mib.toFixed(1)} MiB`;
}
