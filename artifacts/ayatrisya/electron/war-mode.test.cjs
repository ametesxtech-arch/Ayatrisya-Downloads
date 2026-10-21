const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildScanArgs,
  buildPowerShellArgs,
  buildStatusScript,
  parseStatusOutput,
} = require("./war-mode.cjs");

test("War Mode health checks use a fixed PowerShell invocation with no network command", () => {
  const script = buildStatusScript();
  const args = buildPowerShellArgs(script);
  assert.deepEqual(args.slice(0, 3), ["-NoLogo", "-NoProfile", "-NonInteractive"]);
  assert.equal(args[3], "-EncodedCommand");
  assert.equal(Buffer.from(args[4], "base64").toString("utf16le"), script);
  assert.match(script, /Get-MpComputerStatus/);
  assert.doesNotMatch(script, /https?:|Invoke-WebRequest|Invoke-RestMethod/i);
});

test("scan path is passed as one argument and only local absolute Windows folders are accepted", () => {
  const target = "C:\\Users\\Mira\\My Projects\\demo";
  assert.deepEqual(buildScanArgs(target), ["-Scan", "-ScanType", "3", "-File", target]);
  assert.throws(() => buildScanArgs("relative\\folder"), /local Windows folder/);
  assert.throws(() => buildScanArgs("\\\\server\\share"), /local Windows folder/);
});

test("READY is reported only when Defender, the scan command, and signatures are available", () => {
  const ready = parseStatusOutput(JSON.stringify({
    ok: true,
    antivirusEnabled: true,
    serviceEnabled: true,
    realTimeProtectionEnabled: true,
    signatureVersion: "1.2.3.4",
    signatureUpdatedAt: "2026-10-20T11:00:00.000Z",
    scanCommandPath: "C:\\Program Files\\Windows Defender\\MpCmdRun.exe",
  }));
  assert.equal(ready.state, "READY");
  assert.equal(ready.canScan, true);
  assert.equal(ready.signatureVersion, "1.2.3.4");
  assert.equal(ready.scanCommandPath, "C:\\Program Files\\Windows Defender\\MpCmdRun.exe");

  const notReady = parseStatusOutput(JSON.stringify({
    ok: true,
    antivirusEnabled: false,
    serviceEnabled: false,
    realTimeProtectionEnabled: false,
    signatureVersion: "",
    signatureUpdatedAt: "",
    scanCommandPath: "C:\\Program Files\\Windows Defender\\MpCmdRun.exe",
  }));
  assert.equal(notReady.state, "ATTENTION_REQUIRED");
  assert.equal(notReady.canScan, false);
});

test("unreadable status and scan results fail closed", () => {
  assert.equal(parseStatusOutput("not json").state, "ERROR");
});
