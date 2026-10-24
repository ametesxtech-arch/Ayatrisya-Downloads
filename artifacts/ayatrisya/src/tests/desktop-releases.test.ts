import { describe, expect, it } from "vitest";
import {
  formatInstallerSize,
  resolveDesktopRelease,
} from "@/data/desktop-releases";

const validRelease = {
  downloadUrl: "https://downloads.example.test/Ayatrisya-1.2.3.exe",
  expectedExtension: ".exe",
  version: "1.2.3",
  sizeBytes: "111298546",
  sha256: "a".repeat(64),
  releaseNotesUrl: "https://downloads.example.test/releases/1.2.3",
};

describe("desktop installer release metadata", () => {
  it("keeps downloads unavailable when no public artifact URL exists", () => {
    const release = resolveDesktopRelease({
      expectedExtension: ".exe",
    });

    expect(release.status).toBe("not-available");
    expect(release.downloadUrl).toBeUndefined();
    expect(release.reason).toContain("No public installer URL");
  });

  it("rejects insecure URLs and URLs that do not point to the platform installer", () => {
    expect(
      resolveDesktopRelease({
        ...validRelease,
        downloadUrl: "http://downloads.example.test/Ayatrisya.exe",
      }).status,
    ).toBe("not-available");

    expect(
      resolveDesktopRelease({
        ...validRelease,
        downloadUrl: "https://downloads.example.test/releases/latest",
      }).status,
    ).toBe("not-available");
  });

  it("rejects credential-bearing and loopback/private installer URLs", () => {
    for (const downloadUrl of [
      "https://user:pass@downloads.example.test/Ayatrisya.exe",
      "https://127.0.0.1/Ayatrisya.exe",
      "https://localhost/Ayatrisya.exe",
      "https://[::1]/Ayatrisya.exe",
    ]) {
      expect(
        resolveDesktopRelease({
          ...validRelease,
          downloadUrl,
        }).status,
      ).toBe("not-available");
    }
  });

  it("does not enable a link until version, size, checksum, and release notes exist", () => {
    const release = resolveDesktopRelease({
      ...validRelease,
      sha256: "not-a-sha256",
      sizeBytes: "0",
      releaseNotesUrl: "http://downloads.example.test/notes",
    });

    expect(release.status).toBe("not-available");
    expect(release.downloadUrl).toBeUndefined();
    expect(release.reason).toContain("metadata is incomplete");
  });

  it("labels complete release metadata as available but unverified until test evidence is linked", () => {
    const release = resolveDesktopRelease(validRelease);

    expect(release.status).toBe("available-unverified");
    expect(release.downloadUrl).toBe(validRelease.downloadUrl);
    expect(release.version).toBe("1.2.3");
    expect(release.sizeBytes).toBe(111298546);
    expect(release.sha256).toBe("a".repeat(64));
  });

  it("shows verified only when a secure test report and summary are present", () => {
    const release = resolveDesktopRelease({
      ...validRelease,
      verificationReportUrl: "https://downloads.example.test/reports/windows",
      verificationSummary: "Installer install, launch, and uninstall passed.",
    });

    expect(release.status).toBe("verified");
    expect(release.verificationReportUrl).toBe(
      "https://downloads.example.test/reports/windows",
    );
  });

  it("formats installer size for human-readable metadata", () => {
    expect(formatInstallerSize(111298546)).toBe("106.1 MiB");
    expect(formatInstallerSize(0)).toBe("Size unavailable");
  });
});
