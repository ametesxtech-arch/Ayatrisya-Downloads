import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLISHED_RELEASES,
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

  describe("published v0.0.0 GitHub release configuration", () => {
    it("validates Windows v0.0.0 installer metadata matching SHA256SUMS.txt", () => {
      const windows = resolveDesktopRelease(DEFAULT_PUBLISHED_RELEASES.windows);
      expect(windows.status).toBe("available-unverified");
      expect(windows.downloadUrl).toBe(
        "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/download/v0.0.0/Ayatrisya.Setup.0.0.0.exe",
      );
      expect(windows.version).toBe("0.0.0");
      expect(windows.sizeBytes).toBe(124837324);
      expect(windows.sha256).toBe(
        "bef8bd59c3f31c77fbf52fff996388830f0f88ab174a5b77354a07882c6f9698",
      );
      expect(windows.releaseNotesUrl).toBe(
        "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/tag/v0.0.0",
      );
      expect(formatInstallerSize(windows.sizeBytes!)).toBe("119.1 MiB");
    });

    it("validates Linux v0.0.0 AppImage metadata matching SHA256SUMS.txt", () => {
      const linux = resolveDesktopRelease(DEFAULT_PUBLISHED_RELEASES.linux);
      expect(linux.status).toBe("available-unverified");
      expect(linux.downloadUrl).toBe(
        "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/download/v0.0.0/Ayatrisya-0.0.0.AppImage",
      );
      expect(linux.version).toBe("0.0.0");
      expect(linux.sizeBytes).toBe(128640085);
      expect(linux.sha256).toBe(
        "0b1ec99a93fa6dee7191df2db905301ac51bb6d359c3caab6544eefd05518ead",
      );
      expect(linux.releaseNotesUrl).toBe(
        "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/tag/v0.0.0",
      );
      expect(formatInstallerSize(linux.sizeBytes!)).toBe("122.7 MiB");
    });

    it("validates macOS v0.0.0 DMG metadata matching SHA256SUMS.txt", () => {
      const macos = resolveDesktopRelease(DEFAULT_PUBLISHED_RELEASES.macos);
      expect(macos.status).toBe("available-unverified");
      expect(macos.downloadUrl).toBe(
        "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/download/v0.0.0/Ayatrisya-0.0.0-universal.dmg",
      );
      expect(macos.version).toBe("0.0.0");
      expect(macos.sizeBytes).toBe(220588534);
      expect(macos.sha256).toBe(
        "aef55ab1adaa51ff2eccbb9383ac37455f1bc32cc6942b27cad735ff193a9f9c",
      );
      expect(macos.releaseNotesUrl).toBe(
        "https://github.com/ametesxtech-arch/Ayatrisya-Downloads/releases/tag/v0.0.0",
      );
      expect(formatInstallerSize(macos.sizeBytes!)).toBe("210.4 MiB");
    });

    it("prevents cross-platform asset mix-ups and enforces distinct checksums", () => {
      const windows = resolveDesktopRelease(DEFAULT_PUBLISHED_RELEASES.windows);
      const linux = resolveDesktopRelease(DEFAULT_PUBLISHED_RELEASES.linux);
      const macos = resolveDesktopRelease(DEFAULT_PUBLISHED_RELEASES.macos);

      // Verify strict file extensions
      expect(windows.downloadUrl).toMatch(/\.exe$/);
      expect(linux.downloadUrl).toMatch(/\.appimage$/i);
      expect(macos.downloadUrl).toMatch(/\.dmg$/);

      // Verify that no platform accidentally shares an installer URL
      expect(windows.downloadUrl).not.toBe(linux.downloadUrl);
      expect(windows.downloadUrl).not.toBe(macos.downloadUrl);
      expect(linux.downloadUrl).not.toBe(macos.downloadUrl);

      // Verify that checksums are distinct 64-char hex strings
      expect(windows.sha256).not.toBe(linux.sha256);
      expect(windows.sha256).not.toBe(macos.sha256);
      expect(linux.sha256).not.toBe(macos.sha256);

      // Verify distinct byte sizes
      expect(windows.sizeBytes).not.toBe(linux.sizeBytes);
      expect(windows.sizeBytes).not.toBe(macos.sizeBytes);
    });
  });
});
