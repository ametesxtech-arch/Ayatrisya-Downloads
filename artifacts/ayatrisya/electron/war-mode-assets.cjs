const crypto = require("node:crypto");
const { inflateRawSync } = require("node:zlib");

const YARA_X_VERSION = "1.22.0";
const YARA_X_WINDOWS_ZIP_SHA256 = "eac36a58699b94d3732a7fe1d8453fe89e0077bb18ac2c99b4c2ee102a431f2e";
const YARA_X_WINDOWS_EXE_SHA256 = "e2e431175174158fc74c8709896c6d4a6667592bbb65a8132dea624ba125d76f";
const YARA_X_LICENSE_SHA256 = "fdf05444c9178e662fa28810d94a1fa6ec32d7be798241c98094213317265880";
const SIGNATURE_REPOSITORY = "Neo23x0/signature-base";
const SIGNATURE_BASELINE_COMMIT = "3ce6640c26046da8e6d8094af3eaaee3ee84e648";
const SIGNATURE_LICENSE_SHA256 = "8a959b2413d0c83ca1b3ce9153076c649abf2e4bbfebbb493fb24c2074a1eb8a";
const SIGNATURE_LICENSE_META = "Detection Rule License 1.1 https://github.com/Neo23x0/signature-base/blob/master/LICENSE";
const SIGNATURE_BASELINE_RULES = 711;
const SIGNATURE_BASELINE_FILES = 752;
const SIGNATURE_BASELINE_LICENSE_EXCLUSIONS = 29;
const SIGNATURE_BASELINE_EXTERNAL_EXCLUSIONS = 13;
const SIGNATURE_BASELINE_OVERLAP = 1;
const SIGNATURE_BASELINE_SOURCE_BYTES = 5194627;

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_EXPANDED_BYTES = 100 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_RULE_FILE_BYTES = 4 * 1024 * 1024;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function gitBlobSha(buffer) {
  return crypto.createHash("sha1")
    .update(`blob ${buffer.length}\0`, "utf8")
    .update(buffer)
    .digest("hex");
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[n] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function validateZipName(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0")
  ) {
    throw new Error("The signature archive contains an unsafe path.");
  }
  const parts = name.split("/");
  if (parts.some((part) => part === ".." || part === ".")) {
    throw new Error("The signature archive contains an unsafe path.");
  }
}

function readZipDirectory(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.length > MAX_ARCHIVE_BYTES) {
    throw new Error("The downloaded archive has an invalid size.");
  }
  const lowerBound = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= lowerBound; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      const commentLength = buffer.readUInt16LE(offset + 20);
      if (offset + 22 + commentLength === buffer.length) {
        eocd = offset;
        break;
      }
    }
  }
  if (eocd < 0) throw new Error("The downloaded archive has no valid directory.");

  const disk = buffer.readUInt16LE(eocd + 4);
  const directoryDisk = buffer.readUInt16LE(eocd + 6);
  const diskEntries = buffer.readUInt16LE(eocd + 8);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (
    disk !== 0 ||
    directoryDisk !== 0 ||
    diskEntries !== totalEntries ||
    totalEntries > MAX_ARCHIVE_ENTRIES ||
    totalEntries === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    directoryOffset + directorySize > eocd
  ) {
    throw new Error("The archive uses an unsupported or unsafe ZIP layout.");
  }

  const entries = [];
  const seen = new Set();
  let offset = directoryOffset;
  let expandedBytes = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > directoryOffset + directorySize || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("The archive directory is malformed.");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const startDisk = buffer.readUInt16LE(offset + 34);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > directoryOffset + directorySize || startDisk !== 0) {
      throw new Error("The archive directory is malformed.");
    }
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    validateZipName(name);
    const lowerName = name.toLowerCase();
    if (seen.has(lowerName)) throw new Error("The archive contains duplicate paths.");
    seen.add(lowerName);
    if (flags & 0x0001) throw new Error("Encrypted signature archives are not supported.");
    if (method !== 0 && method !== 8) throw new Error("The archive uses an unsupported compression method.");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("ZIP64 signature archives are not supported.");
    }
    expandedBytes += uncompressedSize;
    if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
      throw new Error("The signature archive expands beyond the safety limit.");
    }
    entries.push({ name, flags, method, crc, compressedSize, uncompressedSize, localOffset });
    offset = end;
  }
  if (offset !== directoryOffset + directorySize) throw new Error("The archive directory length is inconsistent.");
  return entries;
}

function readZipEntryData(buffer, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error("The archive entry header is malformed.");
  }
  const flags = buffer.readUInt16LE(offset + 6);
  const method = buffer.readUInt16LE(offset + 8);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const nameEnd = offset + 30 + nameLength;
  const dataStart = nameEnd + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const localName = buffer.subarray(offset + 30, nameEnd).toString("utf8");
  if (
    localName !== entry.name ||
    method !== entry.method ||
    Boolean(flags & 0x0001) ||
    dataEnd > buffer.length ||
    entry.uncompressedSize > MAX_RULE_FILE_BYTES
  ) {
    throw new Error("The archive entry failed validation.");
  }
  const compressed = buffer.subarray(dataStart, dataEnd);
  let data;
  try {
    data = entry.method === 0
      ? Buffer.from(compressed)
      : inflateRawSync(compressed, { maxOutputLength: MAX_RULE_FILE_BYTES });
  } catch {
    throw new Error("The archive entry could not be decompressed safely.");
  }
  if (data.length !== entry.uncompressedSize || crc32(data) !== entry.crc) {
    throw new Error("The archive entry failed its checksum.");
  }
  return data;
}

function extractZipPaths(buffer, requestedPaths, { stripTopLevel = false } = {}) {
  if (!(requestedPaths instanceof Set)) throw new Error("An explicit archive allowlist is required.");
  const entries = readZipDirectory(buffer);
  const files = entries.filter((entry) => !entry.name.endsWith("/"));
  const roots = new Set(files.map((entry) => entry.name.split("/")[0]));
  if (stripTopLevel && roots.size !== 1) throw new Error("The repository archive has an unexpected root layout.");
  const root = stripTopLevel ? [...roots][0] : "";
  const byRelativePath = new Map();
  for (const entry of files) {
    const relativePath = stripTopLevel ? entry.name.slice(root.length + 1) : entry.name;
    if (!relativePath || (stripTopLevel && !entry.name.startsWith(`${root}/`))) {
      throw new Error("The repository archive has an unexpected root layout.");
    }
    if (requestedPaths.has(relativePath)) {
      byRelativePath.set(relativePath, readZipEntryData(buffer, entry));
    }
  }
  for (const requested of requestedPaths) {
    if (!byRelativePath.has(requested)) throw new Error(`The signature archive is missing ${requested}.`);
  }
  return byRelativePath;
}

function verifyGitHubCommit(commitInfo) {
  if (
    !commitInfo ||
    !/^[a-f0-9]{40}$/i.test(commitInfo.sha) ||
    !/^[a-f0-9]{40}$/i.test(commitInfo.treeSha) ||
    commitInfo.verified !== true ||
    commitInfo.verificationReason !== "valid" ||
    typeof commitInfo.date !== "string" ||
    Number.isNaN(Date.parse(commitInfo.date))
  ) {
    throw new Error("The official signature commit is not validly signed or has invalid metadata.");
  }
}

function curateSignatureArchive({ archiveBuffer, tree, commitInfo, requireBaseline = false }) {
  verifyGitHubCommit(commitInfo);
  if (
    !tree ||
    tree.sha !== commitInfo.treeSha ||
    tree.truncated !== false ||
    !Array.isArray(tree.tree) ||
    tree.tree.length > MAX_ARCHIVE_ENTRIES
  ) {
    throw new Error("The official signature source tree could not be verified.");
  }

  const treeByPath = new Map();
  for (const entry of tree.tree) {
    if (entry.type === "blob" && (entry.mode === "100644" || entry.mode === "100755")) {
      treeByPath.set(entry.path, entry);
    }
  }
  const allRuleFiles = [...treeByPath.keys()]
    .filter((name) => name.startsWith("yara/") && /\.(?:yar|yara)$/i.test(name))
    .sort();
  if (!allRuleFiles.length || allRuleFiles.length > 2000) {
    throw new Error("The official signature source contains an unexpected number of rule files.");
  }
  const requiredPaths = new Set([
    "LICENSE",
    "README.md",
    "yara/external-variable-rules.txt",
    ...allRuleFiles,
  ]);
  const archiveFiles = extractZipPaths(archiveBuffer, requiredPaths, { stripTopLevel: true });

  for (const sourcePath of requiredPaths) {
    const treeEntry = treeByPath.get(sourcePath);
    const content = archiveFiles.get(sourcePath);
    if (!treeEntry || gitBlobSha(content) !== treeEntry.sha) {
      throw new Error(`The official signature archive failed its Git object integrity check: ${sourcePath}.`);
    }
  }

  const licenseText = archiveFiles.get("LICENSE").toString("utf8");
  if (
    sha256(archiveFiles.get("LICENSE")) !== SIGNATURE_LICENSE_SHA256 ||
    !licenseText.includes("Detection Rule License (DRL) 1.1") ||
    !licenseText.includes("distribute, sublicense, and/or sell copies")
  ) {
    throw new Error("The signature license differs from the reviewed redistribution terms.");
  }
  const readme = archiveFiles.get("README.md").toString("utf8");
  if (
    !readme.includes("Detection Rule License (DRL) 1.1") ||
    !readme.includes("except the YARA rules that explicitly indicate a different license")
  ) {
    throw new Error("The official repository no longer confirms the reviewed signature licensing policy.");
  }

  const externalVariableFiles = new Set(
    archiveFiles.get("yara/external-variable-rules.txt")
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
  const selectedRules = new Map();
  const ruleMetadata = [];
  let licenseExclusions = 0;
  let externalExclusions = 0;
  let overlapExclusions = 0;
  let sourceBytes = 0;
  for (const sourcePath of allRuleFiles) {
    const content = archiveFiles.get(sourcePath);
    if (content.length > MAX_RULE_FILE_BYTES) throw new Error(`Rule file exceeds the size limit: ${sourcePath}.`);
    const text = content.toString("utf8");
    const licenses = [...text.matchAll(/\blicense\s*=\s*"([^"]+)"/gi)].map((match) => match[1]);
    const otherLicense = licenses.some((license) => license !== SIGNATURE_LICENSE_META);
    const externalVariable = externalVariableFiles.has(sourcePath.slice("yara/".length));
    if (otherLicense) licenseExclusions += 1;
    if (externalVariable) externalExclusions += 1;
    if (otherLicense && externalVariable) overlapExclusions += 1;
    if (otherLicense || externalVariable) continue;

    const relativePath = sourcePath.slice("yara/".length);
    selectedRules.set(relativePath, content);
    sourceBytes += content.length;
    ruleMetadata.push({ path: relativePath, sha256: sha256(content), bytes: content.length });
  }

  if (!selectedRules.size) throw new Error("No license-cleared, compatible YARA rules were found.");
  if (requireBaseline && (
    commitInfo.sha !== SIGNATURE_BASELINE_COMMIT ||
    allRuleFiles.length !== SIGNATURE_BASELINE_FILES ||
    selectedRules.size !== SIGNATURE_BASELINE_RULES ||
    licenseExclusions !== SIGNATURE_BASELINE_LICENSE_EXCLUSIONS ||
    externalExclusions !== SIGNATURE_BASELINE_EXTERNAL_EXCLUSIONS ||
    overlapExclusions !== SIGNATURE_BASELINE_OVERLAP ||
    sourceBytes !== SIGNATURE_BASELINE_SOURCE_BYTES
  )) {
    throw new Error("The reviewed baseline signature snapshot changed unexpectedly.");
  }

  const manifest = {
    engine: "YARA-X",
    engineVersion: YARA_X_VERSION,
    engineLicense: "BSD-3-Clause",
    signatureSource: SIGNATURE_REPOSITORY,
    signatureCommit: commitInfo.sha,
    signatureCommitDate: new Date(commitInfo.date).toISOString(),
    signatureLicense: "Detection Rule License 1.1",
    ruleCount: selectedRules.size,
    sourceRuleFileCount: allRuleFiles.length,
    excludedLicenseFileCount: licenseExclusions,
    excludedExternalVariableFileCount: externalExclusions,
    overlappingExclusionFileCount: overlapExclusions,
    sourceBytes,
    rules: ruleMetadata,
  };
  return { manifest, rules: selectedRules, licenseText };
}

module.exports = {
  MAX_ARCHIVE_BYTES,
  SIGNATURE_BASELINE_COMMIT,
  SIGNATURE_LICENSE_META,
  SIGNATURE_REPOSITORY,
  YARA_X_LICENSE_SHA256,
  YARA_X_VERSION,
  YARA_X_WINDOWS_EXE_SHA256,
  YARA_X_WINDOWS_ZIP_SHA256,
  curateSignatureArchive,
  extractZipPaths,
  gitBlobSha,
  sha256,
};
