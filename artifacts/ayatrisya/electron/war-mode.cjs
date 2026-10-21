const path = require("node:path");

function encodePowerShell(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function buildStatusScript() {
  return String.raw`$ErrorActionPreference = 'Stop'
try {
  $status = Get-MpComputerStatus -ErrorAction Stop
  $paths = @()
  if ($env:ProgramData) { $paths += (Join-Path $env:ProgramData 'Microsoft\Windows Defender\Platform\*\MpCmdRun.exe') }
  if ($env:ProgramFiles) { $paths += (Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe') }
  $mpCmd = Get-ChildItem -Path $paths -File -ErrorAction SilentlyContinue |
    Sort-Object -Property FullName -Descending |
    Select-Object -First 1
  $signatureUpdatedAt = ''
  if ($status.AntivirusSignatureLastUpdated) {
    $signatureUpdatedAt = $status.AntivirusSignatureLastUpdated.ToUniversalTime().ToString('o')
  }
  $scanCommandPath = ''
  if ($mpCmd) { $scanCommandPath = [string]$mpCmd.FullName }
  [ordered]@{
    ok = $true
    antivirusEnabled = [bool]$status.AntivirusEnabled
    serviceEnabled = [bool]$status.AMServiceEnabled
    realTimeProtectionEnabled = [bool]$status.RealTimeProtectionEnabled
    signatureVersion = [string]$status.AntivirusSignatureVersion
    signatureUpdatedAt = $signatureUpdatedAt
    scanCommandPath = $scanCommandPath
  } | ConvertTo-Json -Compress
} catch {
  [ordered]@{ ok = $false; errorCode = 'STATUS_UNAVAILABLE' } | ConvertTo-Json -Compress
  exit 1
}`;
}

function buildPowerShellArgs(script) {
  return ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodePowerShell(script)];
}

function buildScanArgs(targetPath) {
  if (typeof targetPath !== "string" || !path.win32.isAbsolute(targetPath) || targetPath.startsWith("\\\\")) {
    throw new Error("Choose a local Windows folder to scan.");
  }
  return ["-Scan", "-ScanType", "3", "-File", targetPath];
}

function parseStatusOutput(stdout) {
  let value;
  try {
    value = JSON.parse(stdout.trim());
  } catch {
    return {
      state: "ERROR",
      canScan: false,
      engine: "Microsoft Defender",
      signatureVersion: null,
      signatureUpdatedAt: null,
      realTimeProtectionEnabled: false,
      scanCommandPath: null,
      message: "Windows Defender returned an unreadable status. War Mode is not ready.",
    };
  }

  if (!value || value.ok !== true) {
    return {
      state: "ERROR",
      canScan: false,
      engine: "Microsoft Defender",
      signatureVersion: null,
      signatureUpdatedAt: null,
      realTimeProtectionEnabled: false,
      scanCommandPath: null,
      message: "Windows Defender status could not be read. War Mode is not ready.",
    };
  }

  const signatureVersion = typeof value.signatureVersion === "string" && value.signatureVersion
    ? value.signatureVersion
    : null;
  const signatureUpdatedAt = typeof value.signatureUpdatedAt === "string" && value.signatureUpdatedAt
    ? value.signatureUpdatedAt
    : null;
  const scanCommandPath = typeof value.scanCommandPath === "string" &&
    path.win32.isAbsolute(value.scanCommandPath) &&
    !value.scanCommandPath.startsWith("\\\\")
    ? value.scanCommandPath
    : null;
  const serviceReady = value.antivirusEnabled === true &&
    value.serviceEnabled === true &&
    scanCommandPath !== null &&
    signatureVersion !== null;

  if (!serviceReady) {
    return {
      state: "ATTENTION_REQUIRED",
      canScan: false,
      engine: "Microsoft Defender",
      signatureVersion,
      signatureUpdatedAt,
      realTimeProtectionEnabled: value.realTimeProtectionEnabled === true,
      scanCommandPath,
      message: "The local Defender scan engine or its signatures are unavailable. War Mode will not start a scan.",
    };
  }

  const realTimeProtectionEnabled = value.realTimeProtectionEnabled === true;
  return {
    state: "READY",
    canScan: true,
    engine: "Microsoft Defender",
    signatureVersion,
    signatureUpdatedAt,
    realTimeProtectionEnabled,
    scanCommandPath,
    message: realTimeProtectionEnabled
      ? "Windows Defender and local signatures are available for an on-demand scan."
      : "On-demand scanning is available, but Windows real-time protection is off. Ayatrisya will not change that setting.",
  };
}

module.exports = {
  buildScanArgs,
  buildPowerShellArgs,
  buildStatusScript,
  parseStatusOutput,
};
