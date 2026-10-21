const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  SIGNATURE_BASELINE_COMMIT,
  SIGNATURE_LICENSE_SHA256,
  SIGNATURE_REPOSITORY,
  WINDOWS_BASELINE_MANIFEST_SHA256,
  YARA_X_LICENSE_SHA256,
  YARA_X_VERSION,
  YARA_X_WINDOWS_EXE_SHA256,
  curateSignatureArchive,
  sha256,
} = require("./war-mode-assets.cjs");

const MAX_FILES = 10_000;
const MAX_DIRECTORY_DEPTH = 80;
const MAX_DIRECTORY_ENTRIES = 100_000;
const MAX_REVIEWABLE_FINDINGS = 500;
const MAX_FILE_BYTES = 1024 * 1024 * 1024;
const MAX_SCAN_DURATION_MS = 2 * 60 * 60 * 1000;
const PER_FILE_TIMEOUT_MS = 60_000;
const MAX_PROCESS_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_RULES_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_QUARANTINE_ITEMS = 1000;
const ALLOWED_GITHUB_HOSTS = new Set([
  "api.github.com",
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
]);

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function errorCode(error) {
  return error && typeof error === "object" ? error.code : null;
}

function isAccessError(error) {
  return ["EACCES", "EPERM"].includes(errorCode(error));
}

function encodeFileUrl(url) {
  return encodeURIComponent(url).replace(/%2F/gi, "%2F");
}

function safeRelativePath(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
    ? relative
    : "";
}

async function readBoundedResponse(response, maxBytes, label) {
  if (!response.ok || !response.body) throw new Error(`${label} returned HTTP ${response.status}.`);
  let host;
  try {
    host = new URL(response.url).hostname;
  } catch {
    throw new Error(`${label} returned an invalid URL.`);
  }
  if (!ALLOWED_GITHUB_HOSTS.has(host)) throw new Error(`${label} redirected to an unapproved host.`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error(`${label} exceeded the download limit.`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`${label} exceeded the download limit.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function fetchJson(fetchImpl, url, label) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Ayatrisya-War-Mode" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  const body = await readBoundedResponse(response, MAX_JSON_BYTES, label);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

async function fetchSignatureSnapshot(fetchImpl = fetch, commitSha = "master", requireBaseline = false) {
  const base = `https://api.github.com/repos/${SIGNATURE_REPOSITORY}`;
  const commit = await fetchJson(fetchImpl, `${base}/commits/${encodeFileUrl(commitSha)}`, "Signature commit");
  const commitInfo = {
    sha: commit.sha,
    treeSha: commit.commit?.tree?.sha,
    verified: commit.commit?.verification?.verified,
    verificationReason: commit.commit?.verification?.reason,
    date: commit.commit?.committer?.date,
  };
  const tree = await fetchJson(
    fetchImpl,
    `${base}/git/trees/${commitInfo.treeSha}?recursive=1`,
    "Signature source tree",
  );
  const archiveResponse = await fetchImpl(
    `https://github.com/${SIGNATURE_REPOSITORY}/archive/${commitInfo.sha}.zip`,
    {
      headers: { Accept: "application/zip", "User-Agent": "Ayatrisya-War-Mode" },
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
    },
  );
  const archive = await readBoundedResponse(archiveResponse, MAX_RULES_ZIP_BYTES, "Signature source archive");
  return curateSignatureArchive({ archiveBuffer: archive, tree, commitInfo, requireBaseline });
}

function atomicJsonWrite(filePath, value) {
  return (async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tempPath, filePath);
  })();
}

function createWarModeYaraService({
  platform = process.platform,
  resourcesDir,
  userDataDir,
  runProcess,
  protectedPaths = [],
  userIdentity = null,
  icaclsPath = "icacls.exe",
  now = () => new Date(),
}) {
  if (!resourcesDir || !userDataDir || typeof runProcess !== "function") {
    throw new Error("WAR MODE scanner configuration is incomplete.");
  }

  const enginePath = path.join(resourcesDir, "yr.exe");
  const rulesRoot = path.join(resourcesDir, "rules");
  const dataRoot = path.join(userDataDir, "war-mode");
  const baselineCommit = SIGNATURE_BASELINE_COMMIT;
  const baselineSetDir = path.join(dataRoot, "rulesets", baselineCommit);
  const pointerPath = path.join(dataRoot, "current-ruleset.json");
  const indexPath = path.join(dataRoot, "quarantine-index.json");
  const auditPath = path.join(dataRoot, "yara-audit.jsonl");
  const updateProposals = new Map();
  const detections = new Map();
  let initialization = null;
  let activeSet = null;
  let activeScan = null;
  let latestStatus = {
    state: platform === "win32" ? "STARTING" : "OFFLINE",
    canScan: false,
    engine: platform === "win32" ? `YARA-X ${YARA_X_VERSION} (rule-based)` : null,
    signatureVersion: null,
    ruleCount: null,
    ruleFileCount: null,
    signatureUpdatedAt: null,
    message: platform === "win32"
      ? "Loading the bundled scanner and verified offline rules."
      : "The bundled YARA-X scanner is available only in Ayatrisya Desktop on Windows.",
  };

  async function hashFile(filePath, maxBytes = MAX_FILE_BYTES) {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > maxBytes) throw new Error("A scanner asset has an unexpected size.");
    const hash = crypto.createHash("sha256");
    await new Promise((resolve, reject) => {
      const stream = require("node:fs").createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.once("error", reject);
      stream.once("end", resolve);
    });
    return hash.digest("hex");
  }

  async function verifyRulesDirectory(root, manifest) {
    if (!Array.isArray(manifest.rules) || manifest.rules.length !== manifest.ruleFileCount) {
      throw new Error("The rule manifest is incomplete.");
    }
    const expected = new Set();
    for (const entry of manifest.rules) {
      if (
        !entry ||
        typeof entry.path !== "string" ||
        entry.path.startsWith("/") ||
        entry.path.includes("\\") ||
        entry.path.split("/").some((part) => !part || part === "." || part === "..") ||
        !/^[a-f0-9]{64}$/i.test(entry.sha256) ||
        !Number.isSafeInteger(entry.bytes) ||
        entry.bytes < 1 ||
        entry.bytes > 4 * 1024 * 1024
      ) {
        throw new Error("The rule manifest contains an invalid file entry.");
      }
      const filePath = path.resolve(root, ...entry.path.split("/"));
      if (!isWithin(root, filePath)) throw new Error("A rule path escapes the bundled rule directory.");
      expected.add(filePath);
      const stat = await fs.lstat(filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.bytes) {
        throw new Error(`A bundled rule is missing or has changed: ${entry.path}.`);
      }
      if (await hashFile(filePath, 4 * 1024 * 1024) !== entry.sha256) {
        throw new Error(`A bundled rule failed its SHA-256 check: ${entry.path}.`);
      }
    }
    const discovered = new Set();
    const stack = [root];
    while (stack.length) {
      const directory = stack.pop();
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error("The rule folder contains a symbolic link.");
        if (entry.isDirectory()) stack.push(filePath);
        else if (entry.isFile()) discovered.add(filePath);
        else throw new Error("The rule folder contains an unsupported file type.");
        if (discovered.size + stack.length > 3000) throw new Error("The rule folder exceeds the file safety limit.");
      }
    }
    if (discovered.size !== expected.size || [...discovered].some((filePath) => !expected.has(filePath))) {
      throw new Error("The rule folder contains files outside the reviewed manifest.");
    }
  }

  async function compileRules(sourceDirectory, outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.${crypto.randomUUID()}.tmp`;
    const result = await runProcess(
      enginePath,
      ["compile", "--disable-warnings", "--path-as-namespace", "--output", temporaryPath, sourceDirectory],
      5 * 60 * 1000,
      MAX_PROCESS_OUTPUT_BYTES,
    );
    if (result.spawnError || result.timedOut || result.outputLimited || result.code !== 0) {
      await fs.rm(temporaryPath, { force: true }).catch(() => {});
      const detail = result.timedOut
        ? "Compilation exceeded its time limit."
        : result.spawnError
          ? "YARA-X could not be started."
          : `YARA-X could not compile the complete rule set${Number.isInteger(result.code) ? ` (exit ${result.code})` : ""}.`;
      throw new Error(detail);
    }
    const stat = await fs.stat(temporaryPath);
    if (!stat.isFile() || stat.size < 32 || stat.size > 128 * 1024 * 1024) {
      await fs.rm(temporaryPath, { force: true });
      throw new Error("YARA-X produced an invalid compiled rule set.");
    }
    await fs.rename(temporaryPath, outputPath);
    return { bytes: stat.size, sha256: await hashFile(outputPath, 128 * 1024 * 1024) };
  }

  async function loadRuleSet(setDir) {
    const manifest = JSON.parse(await fs.readFile(path.join(setDir, "manifest.json"), "utf8"));
    const compiledPath = path.join(setDir, "rules.yarc");
    const stat = await fs.stat(compiledPath);
    if (
      manifest.engineVersion !== YARA_X_VERSION ||
      !/^[a-f0-9]{40}$/i.test(manifest.signatureCommit) ||
      !Number.isSafeInteger(manifest.ruleCount) ||
      manifest.ruleCount < 1 ||
      !Number.isSafeInteger(manifest.ruleFileCount) ||
      manifest.ruleFileCount < 1 ||
      stat.size < 32 ||
      stat.size > 128 * 1024 * 1024 ||
      await hashFile(compiledPath, 128 * 1024 * 1024) !== manifest.compiledRulesSha256
    ) {
      throw new Error("The active compiled rule set failed validation.");
    }
    const license = await fs.readFile(path.join(setDir, "LICENSE-DRL-1.1.txt"));
    const engineLicense = await fs.readFile(path.join(setDir, "LICENSE-YARA-X.txt"));
    if (
      sha256(license) !== SIGNATURE_LICENSE_SHA256 ||
      sha256(engineLicense) !== YARA_X_LICENSE_SHA256
    ) {
      throw new Error("The active signature rules license failed validation.");
    }
    const sourceRules = path.join(setDir, "rules");
    await verifyRulesDirectory(sourceRules, manifest);
    return { directory: setDir, compiledPath, manifest };
  }

  async function initializeInternal() {
    if (platform !== "win32") {
      latestStatus = {
        ...latestStatus,
        state: "OFFLINE",
        canScan: false,
        message: "The bundled YARA-X scanner is available only in Ayatrisya Desktop on Windows.",
      };
      return latestStatus;
    }
    latestStatus = { ...latestStatus, state: "STARTING", canScan: false, message: "Verifying the bundled scanner and offline rule set." };
    try {
      const manifestPath = path.join(resourcesDir, "manifest.json");
      const manifestBytes = await fs.readFile(manifestPath);
      if (sha256(manifestBytes) !== WINDOWS_BASELINE_MANIFEST_SHA256) {
        throw new Error("The bundled WAR MODE manifest failed its integrity check.");
      }
      const manifest = JSON.parse(manifestBytes.toString("utf8"));
      if (
        manifest.engine !== "YARA-X" ||
        manifest.engineVersion !== YARA_X_VERSION ||
        manifest.signatureCommit !== baselineCommit ||
        manifest.signatureLicense !== "Detection Rule License 1.1" ||
        manifest.ruleCount !== 4886 ||
        manifest.ruleFileCount !== 711 ||
        manifest.engineExecutableSha256 !== YARA_X_WINDOWS_EXE_SHA256
      ) {
        throw new Error("The bundled WAR MODE manifest does not match the reviewed baseline.");
      }
      const engineStat = await fs.stat(enginePath);
      if (!engineStat.isFile() || engineStat.size !== 26_424_320 || await hashFile(enginePath) !== YARA_X_WINDOWS_EXE_SHA256) {
        throw new Error("The bundled YARA-X executable failed its integrity check.");
      }
      const yaraLicense = await fs.readFile(path.join(resourcesDir, "LICENSE-YARA-X.txt"));
      const signatureLicense = await fs.readFile(path.join(resourcesDir, "LICENSE-DRL-1.1.txt"));
      if (
        sha256(yaraLicense) !== YARA_X_LICENSE_SHA256 ||
        sha256(signatureLicense) !== SIGNATURE_LICENSE_SHA256 ||
        !(await fs.readFile(path.join(resourcesDir, "NOTICE.txt"), "utf8")).includes(SIGNATURE_REPOSITORY)
      ) {
        throw new Error("A bundled WAR MODE license notice failed validation.");
      }
      await verifyRulesDirectory(rulesRoot, manifest);
      await fs.mkdir(path.join(dataRoot, "rulesets"), { recursive: true });
      await fs.rm(path.join(dataRoot, "pending"), { recursive: true, force: true });

      let selectedSet = null;
      try {
        const pointer = JSON.parse(await fs.readFile(pointerPath, "utf8"));
        if (!/^[a-f0-9]{40}$/i.test(pointer.commit)) throw new Error("Invalid active ruleset pointer.");
        selectedSet = await loadRuleSet(path.join(dataRoot, "rulesets", pointer.commit));
      } catch (error) {
        if (error.code !== "ENOENT") selectedSet = null;
      }

      if (!selectedSet) {
        let baselineSet;
        try {
          baselineSet = await loadRuleSet(baselineSetDir);
        } catch {
          baselineSet = null;
        }
        if (!baselineSet) {
          const stagingDir = `${baselineSetDir}.staging-${crypto.randomUUID()}`;
          await fs.mkdir(path.join(stagingDir, "rules"), { recursive: true });
          for (const rule of manifest.rules) {
            const from = path.resolve(rulesRoot, ...rule.path.split("/"));
            const to = path.resolve(stagingDir, "rules", ...rule.path.split("/"));
            if (!isWithin(rulesRoot, from) || !isWithin(path.join(stagingDir, "rules"), to)) {
              throw new Error("A bundled rule path is outside its approved folder.");
            }
            await fs.mkdir(path.dirname(to), { recursive: true });
            await fs.copyFile(from, to);
          }
          await fs.copyFile(path.join(resourcesDir, "LICENSE-DRL-1.1.txt"), path.join(stagingDir, "LICENSE-DRL-1.1.txt"));
          await fs.copyFile(path.join(resourcesDir, "LICENSE-YARA-X.txt"), path.join(stagingDir, "LICENSE-YARA-X.txt"));
          const compiled = await compileRules(path.join(stagingDir, "rules"), path.join(stagingDir, "rules.yarc"));
          const baselineManifest = {
            ...manifest,
            compiledRulesSha256: compiled.sha256,
            compiledRulesBytes: compiled.bytes,
            lastSuccessfulUpdate: manifest.signatureCommitDate,
          };
          await fs.writeFile(path.join(stagingDir, "manifest.json"), `${JSON.stringify(baselineManifest, null, 2)}\n`);
          await fs.rm(baselineSetDir, { recursive: true, force: true });
          await fs.rename(stagingDir, baselineSetDir);
          baselineSet = await loadRuleSet(baselineSetDir);
        }
        selectedSet = baselineSet;
        await atomicJsonWrite(pointerPath, { commit: selectedSet.manifest.signatureCommit, activatedAt: manifest.signatureCommitDate });
      }

      activeSet = selectedSet;
      latestStatus = {
        state: "READY",
        canScan: true,
        engine: `YARA-X ${YARA_X_VERSION} · rule-based`,
        signatureVersion: selectedSet.manifest.signatureCommit,
        ruleCount: selectedSet.manifest.ruleCount,
        ruleFileCount: selectedSet.manifest.ruleFileCount,
        signatureUpdatedAt: selectedSet.manifest.lastSuccessfulUpdate || selectedSet.manifest.signatureCommitDate,
        message: "YARA-X and the verified local rule set are loaded. This is rule-based scanning, not a full antivirus replacement.",
      };
    } catch (error) {
      activeSet = null;
      latestStatus = {
        ...latestStatus,
        state: "ERROR",
        canScan: false,
        message: `YARA-X is not ready: ${error.message}`,
      };
    }
    return latestStatus;
  }

  function initialize() {
    if (activeSet && latestStatus.state === "READY") return Promise.resolve({ ...latestStatus });
    if (!initialization || latestStatus.state === "ERROR") initialization = initializeInternal();
    return initialization;
  }

  async function ensureReady() {
    const result = await initialize();
    if (!result.canScan || !activeSet) throw new Error(result.message);
    return activeSet;
  }

  async function appendAudit(record) {
    await fs.mkdir(dataRoot, { recursive: true });
    let old = [];
    try {
      const existing = JSON.parse(await fs.readFile(auditPath, "utf8"));
      if (!Array.isArray(existing)) throw new Error("Invalid local audit log.");
      old = existing.slice(-499);
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("The local YARA-X audit log is invalid; it was not changed.");
    }
    old.push(record);
    await atomicJsonWrite(auditPath, old);
  }

  async function getAuditLog() {
    try {
      const value = JSON.parse(await fs.readFile(auditPath, "utf8"));
      if (!Array.isArray(value)) throw new Error("Invalid local audit log.");
      return value.slice(-100).filter((item) =>
        item && typeof item.at === "string" && typeof item.action === "string",
      );
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw new Error("The local YARA-X audit log is invalid.");
    }
  }

  async function collectFiles(root) {
    const files = [];
    const errors = [];
    const stack = [{ directory: root, depth: 0 }];
    let entriesSeen = 0;
    let enumerationStopped = false;
    while (stack.length) {
      const current = stack.pop();
      if (current.depth > MAX_DIRECTORY_DEPTH) {
        errors.push({ kind: "skipped", path: current.directory, reason: "maximum directory depth reached" });
        continue;
      }
      let directory;
      try {
        directory = await fs.opendir(current.directory);
      } catch (error) {
        errors.push({ kind: isAccessError(error) ? "inaccessible" : "failed", path: current.directory, reason: errorCode(error) || "read failed" });
        continue;
      }
      for await (const entry of directory) {
        entriesSeen += 1;
        if (entriesSeen > MAX_DIRECTORY_ENTRIES) {
          errors.push({
            kind: "failed",
            path: current.directory,
            reason: `100,000-entry traversal limit reached; remaining directory contents were not enumerated`,
          });
          enumerationStopped = true;
          break;
        }
        const fullPath = path.join(current.directory, entry.name);
        if (entry.name.toLowerCase() === ".ayatrisya-quarantine") {
          errors.push({ kind: "skipped", path: fullPath, reason: "Ayatrisya quarantine folder" });
          continue;
        }
        if (entry.isSymbolicLink()) {
          errors.push({ kind: "skipped", path: fullPath, reason: "symbolic link or junction" });
          continue;
        }
        if (entry.isDirectory()) {
          if (stack.length + files.length >= MAX_FILES) {
            errors.push({ kind: "skipped", path: fullPath, reason: "scan file-count limit reached" });
            continue;
          }
          stack.push({ directory: fullPath, depth: current.depth + 1 });
        } else if (entry.isFile()) {
          if (files.length >= MAX_FILES) {
            errors.push({ kind: "skipped", path: fullPath, reason: "scan file-count limit reached" });
          } else {
            files.push(fullPath);
          }
        } else {
          errors.push({ kind: "skipped", path: fullPath, reason: "not a regular file" });
        }
      }
      if (enumerationStopped) {
        for (const pending of stack) {
          errors.push({ kind: "skipped", path: pending.directory, reason: "not enumerated after the global entry limit" });
        }
        break;
      }
    }
    return { files, errors, enumerationStopped };
  }

  async function scanFolder(rootPath, { scanId, onProgress = () => {} } = {}) {
    const ruleset = await ensureReady();
    if (activeScan) throw new Error("A local YARA-X scan is already running.");
    if (typeof rootPath !== "string" || rootPath.length > 32_000 || !path.isAbsolute(rootPath)) {
      throw new Error("Choose a valid local folder before scanning.");
    }
    if (platform === "win32" && rootPath.startsWith("\\\\")) {
      throw new Error("Network shares cannot be scanned by this local-only feature.");
    }
    const root = await fs.realpath(rootPath);
    if (!(await fs.stat(root)).isDirectory()) throw new Error("Choose a local folder to scan.");
    const controller = new AbortController();
    const id = scanId || crypto.randomUUID();
    activeScan = { id, controller };
    const startedAt = now().toISOString();
    const counts = { scanned: 0, detected: 0, skipped: 0, inaccessible: 0, failed: 0 };
    const findings = [];
    const details = [];
    let detailsTruncated = false;
    let findingsTruncated = false;
    const addDetail = (item) => {
      if (details.length < 250) details.push(item);
      else detailsTruncated = true;
    };
    let cancelled = false;
    let limitReached = false;
    let limitReason = "two-hour scan time limit reached";
    const deadline = Date.now() + MAX_SCAN_DURATION_MS;
    try {
      try {
        onProgress({
          scanId: id,
          completed: 0,
          total: 0,
          currentPath: "Preparing the local file list…",
          counts: { ...counts },
        });
      } catch {}
      const listing = await collectFiles(root);
      for (const error of listing.errors) {
        counts[error.kind] += 1;
        addDetail({ path: safeRelativePath(root, error.path), kind: error.kind, reason: error.reason });
      }
      if (controller.signal.aborted) {
        cancelled = true;
        counts.skipped += listing.files.length;
        addDetail({ path: "", kind: "skipped", reason: "scan cancelled before file scanning began" });
      }
      for (let index = 0; index < listing.files.length && !cancelled; index += 1) {
        const fullPath = listing.files[index];
        if (controller.signal.aborted) {
          cancelled = true;
          const remaining = listing.files.length - index;
          counts.skipped += remaining;
          addDetail({ path: safeRelativePath(root, fullPath), kind: "skipped", reason: "scan cancelled before this file" });
          break;
        }
        if (Date.now() > deadline) {
          limitReached = true;
          limitReason = "The two-hour scan time limit was reached.";
          const remaining = listing.files.length - index;
          counts.skipped += remaining;
          addDetail({ path: safeRelativePath(root, fullPath), kind: "skipped", reason: "two-hour scan time limit reached" });
          break;
        }
        let realFile;
        let stat;
        try {
          const fileStat = await fs.lstat(fullPath);
          if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
            counts.skipped += 1;
            addDetail({ path: safeRelativePath(root, fullPath), kind: "skipped", reason: "not a regular file" });
            continue;
          }
          realFile = await fs.realpath(fullPath);
          if (!isWithin(root, realFile)) {
            counts.skipped += 1;
            addDetail({ path: safeRelativePath(root, fullPath), kind: "skipped", reason: "resolved path leaves selected folder" });
            continue;
          }
          stat = await fs.stat(realFile);
          if (stat.size > MAX_FILE_BYTES) {
            counts.skipped += 1;
            addDetail({ path: safeRelativePath(root, fullPath), kind: "skipped", reason: "file exceeds the 1 GiB safety limit" });
            continue;
          }
          await fs.access(realFile, require("node:fs").constants.R_OK);
        } catch (error) {
          const kind = isAccessError(error) ? "inaccessible" : errorCode(error) === "ENOENT" ? "skipped" : "failed";
          counts[kind] += 1;
          addDetail({ path: safeRelativePath(root, fullPath), kind, reason: errorCode(error) || "file preflight failed" });
          continue;
        }

        const result = await runProcess(
          enginePath,
          [
            "scan", "--compiled-rules", "--disable-warnings", "--output-format=json", "--print-meta",
            "--cpu-limit", "50", ruleset.compiledPath, realFile,
          ],
          PER_FILE_TIMEOUT_MS,
          MAX_PROCESS_OUTPUT_BYTES,
          controller.signal,
        );
        if (result.cancelled || controller.signal.aborted) {
          cancelled = true;
          const remaining = listing.files.length - index;
          counts.skipped += remaining;
          addDetail({ path: safeRelativePath(root, fullPath), kind: "skipped", reason: "scan cancelled" });
          break;
        }
        if (result.spawnError || result.timedOut || result.outputLimited || result.code !== 0) {
          counts.failed += 1;
          addDetail({
            path: safeRelativePath(root, fullPath),
            kind: "failed",
            reason: result.timedOut ? "per-file scan timed out" : result.outputLimited ? "scanner output limit reached" : result.spawnError ? "scanner could not start" : `scanner exit ${result.code}`,
          });
        } else {
          let afterScan;
          try {
            afterScan = await fs.stat(realFile);
          } catch (error) {
            const kind = isAccessError(error) ? "inaccessible" : "failed";
            counts[kind] += 1;
            addDetail({ path: safeRelativePath(root, fullPath), kind, reason: errorCode(error) || "file changed during scan" });
            continue;
          }
          if (
            afterScan.size !== stat.size ||
            afterScan.mtimeMs !== stat.mtimeMs ||
            afterScan.ctimeMs !== stat.ctimeMs ||
            afterScan.ino !== stat.ino
          ) {
            counts.failed += 1;
            addDetail({ path: safeRelativePath(root, fullPath), kind: "failed", reason: "file changed during scan" });
            continue;
          }
          let output;
          try {
            output = JSON.parse(result.stdout);
            if (!output || !Array.isArray(output.matches)) throw new Error("missing matches array");
          } catch {
            counts.failed += 1;
            addDetail({ path: safeRelativePath(root, fullPath), kind: "failed", reason: "scanner returned invalid JSON" });
            continue;
          }
          counts.scanned += 1;
          if (output.matches.length) {
            counts.detected += 1;
            const matchMetadata = output.matches
              .filter((match) => match && typeof match.rule === "string")
              .slice(0, 100)
              .map((match) => {
                const meta = match.meta && typeof match.meta === "object" ? match.meta : {};
                const authors = Array.isArray(meta.author)
                  ? meta.author.filter((value) => typeof value === "string").slice(0, 20)
                  : typeof meta.author === "string" && meta.author.trim()
                    ? [meta.author.trim()]
                    : [];
                return {
                  rule: match.rule,
                  authors,
                  source: typeof meta.source === "string"
                    ? meta.source
                    : typeof meta.reference === "string"
                      ? meta.reference
                      : null,
                };
              });
            const rules = [...new Set(matchMetadata.map((match) => match.rule))];
            const relativePath = safeRelativePath(root, realFile);
            if (findings.length < MAX_REVIEWABLE_FINDINGS) {
              const finding = {
                id: crypto.randomUUID(),
                scanId: id,
                path: realFile,
                relativePath,
                rules,
                attribution: matchMetadata,
                detectedAt: now().toISOString(),
                reviewRequired: true,
                fileIdentity: {
                  size: stat.size,
                  mtimeMs: stat.mtimeMs,
                  ctimeMs: stat.ctimeMs,
                  ino: stat.ino,
                },
              };
              findings.push(finding);
              detections.set(finding.id, finding);
            } else {
              findingsTruncated = true;
            }
            addDetail({ path: relativePath, kind: "detected", rules, attribution: matchMetadata });
            if (findings.length >= MAX_REVIEWABLE_FINDINGS && index < listing.files.length - 1) {
              limitReached = true;
              limitReason = "The 500-reviewable-match limit was reached.";
              const remaining = listing.files.length - index - 1;
              counts.skipped += remaining;
              addDetail({
                path: "",
                kind: "skipped",
                reason: "reviewable match limit reached; remaining files were not scanned",
              });
              break;
            }
          }
        }
        if (index === 0 || index % 10 === 0 || index === listing.files.length - 1) {
          try {
            onProgress({
              scanId: id,
              completed: index + 1,
              total: listing.files.length,
              currentPath: safeRelativePath(root, fullPath),
              counts: { ...counts },
            });
          } catch {}
        }
      }
      const finishedAt = now().toISOString();
      const result = {
        scanId: id,
        folderName: path.basename(root) || root,
        startedAt,
        finishedAt,
        cancelled,
        limitReached,
        complete: !cancelled && !limitReached && counts.failed === 0 && counts.inaccessible === 0 && counts.skipped === 0,
        counts,
        findings,
        findingsTruncated,
        details,
        detailsTruncated,
        rulesetVersion: ruleset.manifest.signatureCommit,
        ruleCount: ruleset.manifest.ruleCount,
        ruleFileCount: ruleset.manifest.ruleFileCount,
        message: cancelled
          ? "Scan cancelled. Unprocessed files are counted as skipped."
          : limitReached
            ? `${limitReason} Unprocessed files are counted as skipped.`
            : counts.failed || counts.inaccessible || counts.skipped
              ? "The scan completed with files that were skipped, inaccessible, or failed. They are not reported as clean."
              : findings.length
                ? "Rule matches need review. No files were changed."
                : "All accessible files were scanned with the installed rule set; this is not a guarantee that files are safe.",
      };
      await appendAudit({
        at: finishedAt,
        action: "scan",
        scanId: id,
        folderName: result.folderName,
        counts,
        findings: findings.map((finding) => ({
          path: finding.relativePath,
          attribution: finding.attribution,
        })),
        complete: result.complete,
        cancelled,
        rulesetVersion: ruleset.manifest.signatureCommit,
      });
      return result;
    } finally {
      if (activeScan?.id === id) activeScan = null;
    }
  }

  function cancelScan(scanId) {
    if (!activeScan || activeScan.id !== scanId) return false;
    activeScan.controller.abort();
    return true;
  }

  function getFinding(detectionId) {
    const finding = detections.get(detectionId);
    if (!finding) return null;
    return {
      id: finding.id,
      relativePath: finding.relativePath,
      rules: [...finding.rules],
      attribution: finding.attribution.map((match) => ({
        rule: match.rule,
        authors: [...match.authors],
        source: match.source,
      })),
      reviewRequired: true,
    };
  }

  async function getQuarantineIndex() {
    try {
      const value = JSON.parse(await fs.readFile(indexPath, "utf8"));
      if (!Array.isArray(value) || value.length > MAX_QUARANTINE_ITEMS) throw new Error("Invalid quarantine index.");
      for (const item of value) {
        if (
          !item ||
          typeof item.id !== "string" ||
          !/^[a-f0-9-]{36}$/i.test(item.id) ||
          typeof item.originalPath !== "string" ||
          !path.isAbsolute(item.originalPath) ||
          typeof item.quarantinePath !== "string" ||
          path.resolve(item.quarantinePath) !== path.resolve(
            path.join(path.dirname(item.originalPath), ".ayatrisya-quarantine", `${item.id}.quarantined`),
          ) ||
          !["moving", "quarantined", "restored", "failed"].includes(item.status)
        ) {
          throw new Error("Invalid quarantine index.");
        }
      }
      return value;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw new Error("The local quarantine index could not be read safely.");
    }
  }

  function isProtected(targetPath) {
    const normalized = path.resolve(targetPath);
    return protectedPaths.some((entry) => {
      if (typeof entry !== "string" || !entry) return false;
      return isWithin(path.resolve(entry), normalized);
    });
  }

  async function quarantineDetection(detectionId) {
    if (activeScan) throw new Error("Wait for the current scan to finish before quarantining a file.");
    if (typeof detectionId !== "string" || !detections.has(detectionId)) {
      throw new Error("That scan result is no longer available for review.");
    }
    const finding = detections.get(detectionId);
    const originalPath = path.resolve(finding.path);
    if (isProtected(originalPath)) {
      throw new Error("Ayatrisya will not quarantine Windows, application, or scanner files.");
    }
    const stat = await fs.lstat(originalPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("The detected file changed; scan it again before review.");
    if (
      stat.size !== finding.fileIdentity.size ||
      stat.mtimeMs !== finding.fileIdentity.mtimeMs ||
      stat.ctimeMs !== finding.fileIdentity.ctimeMs ||
      stat.ino !== finding.fileIdentity.ino
    ) {
      throw new Error("The detected file changed after scanning. Scan it again before quarantining.");
    }
    const parent = await fs.realpath(path.dirname(originalPath));
    const realOriginal = await fs.realpath(originalPath);
    if (!isWithin(parent, realOriginal) || isProtected(realOriginal)) {
      throw new Error("The file path is protected or changed.");
    }
    const quarantineDir = path.join(parent, ".ayatrisya-quarantine");
    await fs.mkdir(quarantineDir, { recursive: true, mode: 0o700 });
    const quarantineStat = await fs.lstat(quarantineDir);
    if (!quarantineStat.isDirectory() || quarantineStat.isSymbolicLink()) {
      throw new Error("The quarantine folder is not a safe local directory.");
    }
    if (platform === "win32") {
      const identity = typeof userIdentity === "string" && /^[A-Za-z0-9_.-]+(?:\\[A-Za-z0-9_$.-]+)?$/.test(userIdentity)
        ? userIdentity
        : "";
      if (!identity) throw new Error("Ayatrisya could not verify the current Windows account for secure quarantine.");
      const acl = await runProcess(
        icaclsPath,
        [quarantineDir, "/inheritance:r", "/grant:r", `${identity}:(OI)(CI)F`],
        15_000,
        16 * 1024,
      );
      if (acl.spawnError || acl.timedOut || acl.code !== 0) {
        throw new Error("Ayatrisya could not restrict access to the quarantine folder.");
      }
    }
    if (activeScan) throw new Error("Wait for the current scan to finish before quarantining a file.");
    const quarantinePath = path.join(quarantineDir, `${detectionId}.quarantined`);
    const record = {
      id: detectionId,
      originalPath,
      quarantinePath,
      originalMetadata: {
        size: stat.size,
        mode: stat.mode,
        mtimeMs: stat.mtimeMs,
        atimeMs: stat.atimeMs,
        birthtimeMs: stat.birthtimeMs,
      },
      rules: finding.rules,
      attribution: finding.attribution,
      scanId: finding.scanId,
      quarantinedAt: now().toISOString(),
      status: "moving",
    };
    const records = await getQuarantineIndex();
    if (records.length >= MAX_QUARANTINE_ITEMS) throw new Error("The quarantine index is full; restore reviewed files before adding more.");
    records.push(record);
    await atomicJsonWrite(indexPath, records);
    let moved = false;
    try {
      if (activeScan) throw new Error("Wait for the current scan to finish before quarantining a file.");
      await fs.rename(originalPath, quarantinePath);
      moved = true;
      record.status = "quarantined";
      await atomicJsonWrite(indexPath, records);
    } catch (error) {
      if (error.code === "EXDEV") {
        record.status = "failed";
        record.failure = "The file could not be moved safely on this volume.";
        await atomicJsonWrite(indexPath, records);
        throw new Error("Ayatrisya could not quarantine this file safely on the same volume.");
      }
      if (moved) {
        try {
          await fs.rename(quarantinePath, originalPath);
        } catch {
          record.status = "quarantined";
          record.recoveryRequired = true;
          await atomicJsonWrite(indexPath, records).catch(() => {});
          throw new Error("The file was moved but Ayatrisya could not finish its quarantine record. It remains recoverable in the local quarantine folder.");
        }
      }
      const indexAfter = records.filter((item) => item.id !== detectionId);
      await atomicJsonWrite(indexPath, indexAfter).catch(() => {});
      throw error;
    }
    detections.delete(detectionId);
    await appendAudit({
      at: record.quarantinedAt,
      action: "quarantined",
      id: record.id,
      originalPath,
      rules: finding.rules,
      attribution: finding.attribution,
    });
    return { id: record.id, originalName: path.basename(originalPath), quarantinedAt: record.quarantinedAt };
  }

  async function listQuarantine() {
    const records = await getQuarantineIndex();
    const result = [];
    for (const item of records) {
      if (item.status !== "quarantined" || typeof item.id !== "string" || typeof item.originalPath !== "string") continue;
      try {
        const stat = await fs.lstat(item.quarantinePath);
        if (stat.isFile() && !stat.isSymbolicLink()) {
          result.push({
            id: item.id,
            name: path.basename(item.originalPath),
            originalPath: item.originalPath,
            quarantinedAt: item.quarantinedAt,
            rules: Array.isArray(item.rules) ? item.rules : [],
            attribution: Array.isArray(item.attribution) ? item.attribution : [],
          });
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw new Error("Ayatrisya could not verify a quarantined file.");
      }
    }
    return result.slice(-MAX_QUARANTINE_ITEMS);
  }

  async function restoreQuarantined(id) {
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Choose a valid quarantine item.");
    const records = await getQuarantineIndex();
    const record = records.find((item) => item.id === id && item.status === "quarantined");
    if (!record) throw new Error("That quarantined file is no longer available.");
    if (isProtected(record.originalPath)) throw new Error("Ayatrisya will not restore into a protected system or application folder.");
    const parent = path.dirname(record.originalPath);
    const realParent = await fs.realpath(parent);
    const target = path.resolve(realParent, path.basename(record.originalPath));
    if (target !== path.resolve(record.originalPath)) throw new Error("The original folder path has changed.");
    try {
      await fs.lstat(target);
      throw new Error("A file already exists at the original location. Move it before restoring; Ayatrisya will not overwrite it.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const quarantined = await fs.lstat(record.quarantinePath);
    if (!quarantined.isFile() || quarantined.isSymbolicLink()) throw new Error("The quarantined file is not a safe regular file.");
    if (activeScan) throw new Error("Wait for the current scan to finish before restoring a file.");
    await fs.rename(record.quarantinePath, target);
    record.status = "restored";
    record.restoredAt = now().toISOString();
    await atomicJsonWrite(indexPath, records);
    await appendAudit({
      at: record.restoredAt,
      action: "restored",
      id,
      originalPath: target,
      rules: record.rules,
      attribution: record.attribution,
    });
    return { id, name: path.basename(target), restoredAt: record.restoredAt };
  }

  async function prepareRulesUpdate(fetchImpl = fetch) {
    if (activeScan) throw new Error("Wait for the current scan to finish before updating rules.");
    const current = await ensureReady();
    if (activeScan) throw new Error("Wait for the current scan to finish before updating rules.");
    if (updateProposals.size) throw new Error("A rule update is already waiting for review.");
    let snapshot;
    try {
      snapshot = await fetchSignatureSnapshot(fetchImpl, "master", false);
    } catch (error) {
      await appendAudit({
        at: now().toISOString(),
        action: "rules-update-failed",
        fromVersion: current.manifest.signatureCommit,
        reason: error.message,
      });
      throw error;
    }
    if (snapshot.manifest.signatureCommit === current.manifest.signatureCommit) {
      return { available: false, message: "The installed rules are already at the latest verified commit." };
    }
    if (activeScan) throw new Error("Wait for the current scan to finish before updating rules.");
    const currentByPath = new Map(current.manifest.rules.map((item) => [item.path, item.sha256]));
    const nextByPath = new Map(snapshot.manifest.rules.map((item) => [item.path, item.sha256]));
    const added = [...nextByPath.keys()].filter((file) => !currentByPath.has(file)).length;
    const removed = [...currentByPath.keys()].filter((file) => !nextByPath.has(file)).length;
    const changed = [...nextByPath].filter(([file, digest]) => currentByPath.has(file) && currentByPath.get(file) !== digest).length;
    const proposalId = crypto.randomUUID();
    const stageDir = path.join(dataRoot, "pending", proposalId);
    await fs.mkdir(path.join(stageDir, "rules"), { recursive: true });
    try {
      for (const [relativePath, content] of snapshot.rules) {
        const parts = relativePath.split("/");
        if (parts.some((part) => !part || part === "." || part === "..")) throw new Error("Unsafe rule path in update.");
        const target = path.resolve(stageDir, "rules", ...parts);
        if (!isWithin(path.join(stageDir, "rules"), target)) throw new Error("Rule update path escapes its staging directory.");
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
      }
      await fs.writeFile(path.join(stageDir, "LICENSE-DRL-1.1.txt"), snapshot.licenseText);
      await fs.copyFile(path.join(resourcesDir, "LICENSE-YARA-X.txt"), path.join(stageDir, "LICENSE-YARA-X.txt"));
      const compiled = await compileRules(path.join(stageDir, "rules"), path.join(stageDir, "rules.yarc"));
      const manifest = {
        ...snapshot.manifest,
        compiledRulesSha256: compiled.sha256,
        compiledRulesBytes: compiled.bytes,
        lastSuccessfulUpdate: now().toISOString(),
      };
      await fs.writeFile(path.join(stageDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      await verifyRulesDirectory(path.join(stageDir, "rules"), manifest);
      if (activeScan) throw new Error("Wait for the current scan to finish before updating rules.");
      const preview = {
        available: true,
        proposalId,
        fromVersion: current.manifest.signatureCommit,
        toVersion: manifest.signatureCommit,
        fromRuleCount: current.manifest.ruleCount,
        toRuleCount: manifest.ruleCount,
        fromRuleFileCount: current.manifest.ruleFileCount,
        toRuleFileCount: manifest.ruleFileCount,
        added,
        removed,
        changed,
        commitDate: manifest.signatureCommitDate,
      };
      updateProposals.set(proposalId, { stageDir, manifest, fromVersion: current.manifest.signatureCommit, preview });
      return preview;
    } catch (error) {
      await fs.rm(stageDir, { recursive: true, force: true });
      await appendAudit({
        at: now().toISOString(),
        action: "rules-update-failed",
        fromVersion: current.manifest.signatureCommit,
        reason: error.message,
      });
      throw error;
    }
  }

  function getRulesUpdateProposal(proposalId) {
    return updateProposals.get(proposalId)?.preview ?? null;
  }

  async function discardRulesUpdate(proposalId) {
    const proposal = updateProposals.get(proposalId);
    if (!proposal) return false;
    updateProposals.delete(proposalId);
    await fs.rm(proposal.stageDir, { recursive: true, force: true });
    return true;
  }

  async function activateRulesUpdate(proposalId) {
    if (activeScan) throw new Error("Wait for the current scan to finish before applying a rule update.");
    const proposal = updateProposals.get(proposalId);
    if (!proposal) throw new Error("That verified rule update is no longer pending.");
    if (activeSet?.manifest.signatureCommit !== proposal.fromVersion) {
      await discardRulesUpdate(proposalId);
      throw new Error("The active rules changed while this update was waiting for review. Check for updates again.");
    }
    const commit = proposal.manifest.signatureCommit;
    const destination = path.join(dataRoot, "rulesets", commit);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
      await fs.rename(proposal.stageDir, destination);
    } catch (error) {
      if (error.code !== "EEXIST" && error.code !== "ENOTEMPTY") throw error;
      await fs.rm(proposal.stageDir, { recursive: true, force: true });
    }
    const candidate = await loadRuleSet(destination);
    const activatedAt = now().toISOString();
    candidate.manifest.lastSuccessfulUpdate = activatedAt;
    await fs.writeFile(path.join(destination, "manifest.json"), `${JSON.stringify(candidate.manifest, null, 2)}\n`);
    await atomicJsonWrite(pointerPath, { commit, activatedAt });
    activeSet = candidate;
    latestStatus = {
      ...latestStatus,
      state: "READY",
      canScan: true,
      signatureVersion: commit,
      ruleCount: candidate.manifest.ruleCount,
      ruleFileCount: candidate.manifest.ruleFileCount,
      signatureUpdatedAt: candidate.manifest.lastSuccessfulUpdate,
      message: "The verified rule update is active. Scanning remains local and rule-based.",
    };
    updateProposals.delete(proposalId);
    await appendAudit({
      at: now().toISOString(),
      action: "rules-updated",
      fromVersion: proposal.fromVersion,
      toVersion: commit,
      ruleCount: candidate.manifest.ruleCount,
      ruleFileCount: candidate.manifest.ruleFileCount,
    });
    return getStatus();
  }

  function getStatus() {
    return { ...latestStatus };
  }

  return {
    activateRulesUpdate,
    cancelScan,
    discardRulesUpdate,
    getAuditLog,
    getFinding,
    getRulesUpdateProposal,
    getStatus,
    initialize,
    listQuarantine,
    prepareRulesUpdate,
    quarantineDetection,
    restoreQuarantined,
    scanFolder,
  };
}

module.exports = { createWarModeYaraService };
