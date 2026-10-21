import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  SIGNATURE_BASELINE_COMMIT,
  SIGNATURE_REPOSITORY,
  YARA_X_LICENSE_SHA256,
  YARA_X_VERSION,
  YARA_X_WINDOWS_EXE_SHA256,
  YARA_X_WINDOWS_ZIP_SHA256,
  curateSignatureArchive,
  extractZipPaths,
  sha256,
} = require("../electron/war-mode-assets.cjs");

const ARTIFACT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ARTIFACT_ROOT, "war-mode-assets", "windows-x64");
const STAGING_DIR = `${OUTPUT_DIR}.staging-${process.pid}`;
const SIGNATURE_API = "https://api.github.com/repos/Neo23x0/signature-base";
const ALLOWED_HOSTS = new Set([
  "api.github.com",
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "raw.githubusercontent.com",
]);

async function readBoundedResponse(response, maxBytes, label) {
  if (!response.ok || !response.body) {
    throw new Error(`${label} request failed with HTTP ${response.status}.`);
  }
  const finalHost = new URL(response.url).hostname;
  if (!ALLOWED_HOSTS.has(finalHost)) throw new Error(`${label} redirected to an unapproved host.`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error(`${label} exceeded the download size limit.`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`${label} exceeded the download size limit.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function getBytes(url, maxBytes, label) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json, application/zip, text/plain",
      "User-Agent": "Ayatrisya-War-Mode-Asset-Builder",
    },
    signal: AbortSignal.timeout(120_000),
    redirect: "follow",
  });
  return readBoundedResponse(response, maxBytes, label);
}

async function getJson(url, maxBytes, label) {
  const body = await getBytes(url, maxBytes, label);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

async function getSignatureSnapshot(commitSha, requireBaseline) {
  const commit = await getJson(`${SIGNATURE_API}/commits/${commitSha}`, 512 * 1024, "Signature commit");
  const commitInfo = {
    sha: commit.sha,
    treeSha: commit.commit?.tree?.sha,
    verified: commit.commit?.verification?.verified,
    verificationReason: commit.commit?.verification?.reason,
    date: commit.commit?.committer?.date,
  };
  const tree = await getJson(`${SIGNATURE_API}/git/trees/${commitInfo.treeSha}?recursive=1`, 8 * 1024 * 1024, "Signature tree");
  const archive = await getBytes(
    `https://github.com/${SIGNATURE_REPOSITORY}/archive/${commitSha}.zip`,
    50 * 1024 * 1024,
    "Signature source archive",
  );
  return curateSignatureArchive({
    archiveBuffer: archive,
    tree,
    commitInfo,
    requireBaseline,
  });
}

async function prepare() {
  await rm(STAGING_DIR, { recursive: true, force: true });
  await mkdir(path.join(STAGING_DIR, "rules"), { recursive: true });

  const engineZip = await getBytes(
    `https://github.com/VirusTotal/yara-x/releases/download/v${YARA_X_VERSION}/yara-x-v${YARA_X_VERSION}-x86_64-pc-windows-msvc.zip`,
    20 * 1024 * 1024,
    "YARA-X Windows release",
  );
  if (sha256(engineZip) !== YARA_X_WINDOWS_ZIP_SHA256) {
    throw new Error("The YARA-X Windows release archive failed its pinned SHA-256 check.");
  }
  const engineFiles = extractZipPaths(engineZip, new Set(["yr.exe"]), { maxEntryBytes: 40 * 1024 * 1024 });
  const engine = engineFiles.get("yr.exe");
  if (sha256(engine) !== YARA_X_WINDOWS_EXE_SHA256) {
    throw new Error("The YARA-X Windows executable failed its pinned SHA-256 check.");
  }
  await writeFile(path.join(STAGING_DIR, "yr.exe"), engine, { mode: 0o755 });

  const license = await getBytes(
    `https://raw.githubusercontent.com/VirusTotal/yara-x/v${YARA_X_VERSION}/LICENSE`,
    128 * 1024,
    "YARA-X license",
  );
  if (sha256(license) !== YARA_X_LICENSE_SHA256) {
    throw new Error("The YARA-X license file differs from the reviewed BSD-3-Clause license.");
  }
  await writeFile(path.join(STAGING_DIR, "LICENSE-YARA-X.txt"), license);

  const snapshot = await getSignatureSnapshot(SIGNATURE_BASELINE_COMMIT, true);
  for (const [relativePath, content] of snapshot.rules) {
    const parts = relativePath.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) {
      throw new Error("The signature source contains an unsafe rule path.");
    }
    const outputPath = path.join(STAGING_DIR, "rules", ...parts);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
  }
  await writeFile(path.join(STAGING_DIR, "LICENSE-DRL-1.1.txt"), snapshot.licenseText);

  const manifest = {
    ...snapshot.manifest,
    engineExecutable: "yr.exe",
    engineExecutableSha256: YARA_X_WINDOWS_EXE_SHA256,
    engineArchiveSha256: YARA_X_WINDOWS_ZIP_SHA256,
    engineLicenseSha256: YARA_X_LICENSE_SHA256,
  };
  await writeFile(path.join(STAGING_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    path.join(STAGING_DIR, "NOTICE.txt"),
    [
      "Ayatrisya WAR MODE bundles YARA-X and a curated YARA rule set.",
      "",
      `Engine: YARA-X ${YARA_X_VERSION} (BSD-3-Clause).`,
      "Engine source: https://github.com/VirusTotal/yara-x",
      "Engine release: https://github.com/VirusTotal/yara-x/releases/tag/v1.22.0",
      "",
      `Rules: ${snapshot.manifest.ruleCount} declarations in ${snapshot.manifest.ruleFileCount} selected files from ${SIGNATURE_REPOSITORY}.`,
      `Reviewed source commit: ${snapshot.manifest.signatureCommit}`,
      "Rules license: Detection Rule License (DRL) 1.1. The complete license is in LICENSE-DRL-1.1.txt.",
      "Rule-level author, source, and license metadata is preserved in each bundled rule.",
      "Rule-based scanning is not a replacement for Microsoft Defender or a complete antivirus product.",
      "",
      "All bundled engine and rule files are verified against pinned hashes or the verified Git commit tree.",
    ].join("\n") + "\n",
  );

  return manifest;
}

async function main() {
  const manifest = await prepare();
  const backupDir = `${OUTPUT_DIR}.previous-${process.pid}`;
  let hadPrevious = false;
  try {
    await rm(backupDir, { recursive: true, force: true });
    try {
      await rename(OUTPUT_DIR, backupDir);
      hadPrevious = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(STAGING_DIR, OUTPUT_DIR);
    if (hadPrevious) await rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (hadPrevious) {
      await rm(OUTPUT_DIR, { recursive: true, force: true });
      await rename(backupDir, OUTPUT_DIR);
    }
    throw error;
  }
  const manifestDigest = createHash("sha256")
    .update(await readFile(path.join(OUTPUT_DIR, "manifest.json")))
    .digest("hex");
  console.log(
    `Prepared YARA-X ${manifest.engineVersion} and ${manifest.ruleCount} rules in ${manifest.ruleFileCount} licensed files ` +
    `(${manifest.signatureCommit.slice(0, 12)}); manifest SHA-256 ${manifestDigest}.`,
  );
}

main().catch(async (error) => {
  await rm(STAGING_DIR, { recursive: true, force: true });
  console.error(`WAR MODE asset preparation failed: ${error.message}`);
  process.exitCode = 1;
});
