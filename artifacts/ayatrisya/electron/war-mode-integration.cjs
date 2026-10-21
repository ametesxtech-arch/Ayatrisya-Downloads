const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const EICAR_TEST_FILE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function checkedIcacls(args) {
  try {
    execFileSync("icacls.exe", args, {
      windowsHide: true,
      shell: false,
      stdio: "pipe",
      timeout: 20_000,
    });
  } catch (error) {
    throw new Error(`icacls.exe failed during the Windows permission test: ${error.message}`);
  }
}

async function sha256File(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function runWarModePackagedIntegration({ service, testRoot, userIdentity, userDataDir }) {
  const report = {
    startedAt: new Date().toISOString(),
    appPackaged: true,
    tests: [],
  };
  const record = (name, result) => report.tests.push({ name, ...result });
  const ensure = async (name, fn) => {
    try {
      const details = await fn();
      record(name, { passed: true, details });
    } catch (error) {
      record(name, { passed: false, error: error.message });
      error.warModeReport = report;
      throw error;
    }
  };
  await fs.mkdir(testRoot, { recursive: true });

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Network disabled for offline startup and scan test.");
  };
  try {
    const status = await service.initialize();
    await ensure("packaged offline startup loads YARA-X and baseline rules", async () => {
      assert.equal(status.state, "READY");
      assert.equal(status.canScan, true);
      assert.equal(status.ruleCount, 4886);
      assert.equal(status.ruleFileCount, 711);
      assert.equal(status.signatureVersion, "3ce6640c26046da8e6d8094af3eaaee3ee84e648");
      return {
        engine: status.engine,
        rules: status.ruleCount,
        ruleFiles: status.ruleFileCount,
        version: status.signatureVersion,
      };
    });

    const scanRoot = path.join(testRoot, "scan-fixtures");
    await fs.mkdir(scanRoot, { recursive: true });
    const eicarPath = path.join(scanRoot, "eicar.com");
    const benignPath = path.join(scanRoot, "benign.txt");
    await fs.writeFile(eicarPath, EICAR_TEST_FILE, "ascii");
    await fs.writeFile(benignPath, "Ayatrisya benign WAR MODE integration control.\n", "utf8");

    let progressEvents = 0;
    const scan = await service.scanFolder(scanRoot, {
      scanId: crypto.randomUUID(),
      onProgress: () => { progressEvents += 1; },
    });
    await ensure("packaged offline scan detects EICAR and clears benign control", async () => {
      assert.equal(scan.counts.scanned, 2);
      assert.equal(scan.counts.detected, 1);
      assert.equal(scan.counts.skipped, 0);
      assert.equal(scan.counts.inaccessible, 0);
      assert.equal(scan.counts.failed, 0);
      assert.equal(scan.complete, true);
      assert.equal(scan.findings.length, 1);
      assert.ok(scan.findings[0].rules.includes("SUSP_Just_EICAR"));
      assert.ok(scan.findings[0].attribution.some((match) => match.authors.includes("Florian Roth (Nextron Systems)")));
      assert.ok(progressEvents >= 1);
      return { counts: scan.counts, match: scan.findings[0].rules, attribution: scan.findings[0].attribution, progressEvents };
    });

    await ensure("quarantine preserves and restores the reviewed EICAR test file", async () => {
      const originalHash = await sha256File(eicarPath);
      const item = await service.quarantineDetection(scan.findings[0].id);
      assert.equal(await fs.stat(eicarPath).then(() => true, () => false), false);
      const items = await service.listQuarantine();
      assert.ok(items.some((entry) => entry.id === item.id));
      await service.restoreQuarantined(item.id);
      assert.equal(await sha256File(eicarPath), originalHash);
      assert.equal((await service.listQuarantine()).some((entry) => entry.id === item.id), false);
      return { originalHash, restored: true };
    });

    await ensure("scan cancellation reports unprocessed files as skipped", async () => {
      const cancelRoot = path.join(testRoot, "cancel-fixtures");
      await fs.mkdir(cancelRoot, { recursive: true });
      await Promise.all(Array.from({ length: 6 }, (_, index) =>
        fs.writeFile(path.join(cancelRoot, `benign-${index}.txt`), `cancel test ${index}`, "utf8"),
      ));
      let requested = false;
      const cancelled = await service.scanFolder(cancelRoot, {
        scanId: crypto.randomUUID(),
        onProgress: (value) => {
          if (!requested) {
            requested = true;
            service.cancelScan(value.scanId);
          }
        },
      });
      assert.equal(cancelled.cancelled, true);
      assert.ok(cancelled.counts.skipped > 0);
      return { cancelled: cancelled.cancelled, counts: cancelled.counts };
    });

    await ensure("failed signature update retains last known-good rules", async () => {
      const pointerPath = path.join(userDataDir, "war-mode", "current-ruleset.json");
      const before = await fs.readFile(pointerPath, "utf8");
      await assert.rejects(
        service.prepareRulesUpdate(async () => { throw new Error("simulated network outage"); }),
        /simulated network outage/,
      );
      const after = await fs.readFile(pointerPath, "utf8");
      assert.equal(after, before);
      const current = service.getStatus();
      assert.equal(current.canScan, true);
      assert.equal(current.signatureVersion, status.signatureVersion);
      return { retainedVersion: current.signatureVersion };
    });

    await ensure("Windows ACL denial is reported as inaccessible", async () => {
      const permissionRoot = path.join(testRoot, "permission-fixtures");
      await fs.mkdir(permissionRoot, { recursive: true });
      const deniedPath = path.join(permissionRoot, "denied.txt");
      await fs.writeFile(deniedPath, "Harmless permission test file.", "utf8");
      if (!/^[A-Za-z0-9_.-]+(?:\\[A-Za-z0-9_$.-]+)?$/.test(userIdentity || "")) {
        throw new Error("The Windows test account could not be validated.");
      }
      checkedIcacls([deniedPath, "/deny", `${userIdentity}:(R)`]);
      try {
        const denied = await service.scanFolder(permissionRoot, { scanId: crypto.randomUUID() });
        assert.equal(denied.counts.inaccessible, 1);
        assert.equal(denied.counts.scanned, 0);
        return { counts: denied.counts };
      } finally {
        checkedIcacls([deniedPath, "/remove:d", userIdentity]);
      }
    });
  } finally {
    global.fetch = originalFetch;
  }

  report.finishedAt = new Date().toISOString();
  report.passed = report.tests.every((test) => test.passed);
  return report;
}

module.exports = { runWarModePackagedIntegration };
