import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '../../..');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const artifactsDir = path.resolve(workspaceRoot, 'generated-artifacts/ayatrisya-desktop');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;

let commitHash = 'unknown';
let commitDate = new Date().toISOString();
try {
  commitHash = execSync('git rev-parse HEAD', { cwd: workspaceRoot, encoding: 'utf8' }).trim();
  commitDate = execSync('git log -1 --format=%cI', { cwd: workspaceRoot, encoding: 'utf8' }).trim();
} catch (e) {
  console.warn('Could not retrieve git commit info:', e.message);
}

function computeSha256(filePath) {
  const fileBuffer = readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

const files = existsSync(artifactsDir) ? readdirSync(artifactsDir) : [];
const installers = [];
const shaLines = [];

for (const file of files) {
  if (file.endsWith('.exe') || file.endsWith('.AppImage') || file.endsWith('.dmg')) {
    const fullPath = path.join(artifactsDir, file);
    const stats = statSync(fullPath);
    const sha = computeSha256(fullPath);
    let platform = 'unknown';
    if (file.endsWith('.exe')) platform = 'win32-x64';
    if (file.endsWith('.AppImage')) platform = 'linux-x64';
    if (file.endsWith('.dmg')) platform = 'darwin-universal';

    installers.push({
      fileName: file,
      platform,
      sizeBytes: stats.size,
      sha256: sha,
      lastModified: stats.mtime.toISOString(),
      isCurrentVersion: file.includes(version),
    });

    shaLines.push(`${sha}  ${file}`);
  }
}

const manifest = {
  releaseVersion: `v${version}`,
  productName: pkg.desktopName || 'Ayatrisya',
  appId: pkg.build?.appId || 'com.ametesx.ayatrisya',
  sourceCommit: commitHash,
  sourceCommitDate: commitDate,
  buildDate: new Date().toISOString(),
  electronVersion: pkg.devDependencies?.electron || 'unknown',
  electronBuilderVersion: pkg.devDependencies?.['electron-builder'] || 'unknown',
  nodeVersion: process.version,
  buildPlatform: process.platform,
  buildArch: process.arch,
  installers,
};

const manifestPath = path.join(artifactsDir, 'build-manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Generated manifest: ${manifestPath}`);

const shaPath = path.join(artifactsDir, 'SHA256SUMS.txt');
writeFileSync(shaPath, shaLines.join('\n') + '\n', 'utf8');
console.log(`Updated: ${shaPath}`);

const releaseNotesPath = path.join(artifactsDir, `RELEASE_NOTES_v${version}.md`);
const releaseNotes = `# Ayatrisya Desktop v${version} — Production Release

**Release Version:** v${version}  
**Source Commit:** \`${commitHash}\`  
**Build Date:** ${new Date().toISOString()}  
**Target Repository:** https://github.com/ametesxtech-arch/Ayatrisya-Downloads  

## Highlights in v${version}
- **Document Intelligence Engine:** Full multi-format text & structural parsing for DOCX, XLSX, PDF, Markdown, CSV, and JSON.
- **PowerPoint Presentation Engine:** Full OpenXML PresentationML slide master and layout generation with professional themes and speaker notes.
- **Unified Markdown & KaTeX Engine:** KaTeX mathematical rendering with streaming delimiter protection and currency symbol shielding.
- **Selectable Inference Routing:** Direct Custom Remote routing with per-user API key isolation and auto-balancing.
- **WAR MODE Local Security System:** Offline local file inspection, loopback security boundary enforcement, and YARA-X scanning.
- **Responsive Mobile & Desktop Workspaces:** Comprehensive layout corrections across all viewports.

## Download Assets
${installers
  .filter((i) => i.isCurrentVersion)
  .map((i) => `- **${i.platform}:** \`${i.fileName}\` (${(i.sizeBytes / (1024 * 1024)).toFixed(1)} MB)\n  - SHA-256: \`${i.sha256}\``)
  .join('\n')}

## Security & Verification
- Verify the SHA-256 checksum before executing any binary installer.
- Unsigned binaries may trigger SmartScreen/Gatekeeper warnings; verify that the downloaded file matches the official SHA-256 digest in \`SHA256SUMS.txt\`.
`;

writeFileSync(releaseNotesPath, releaseNotes, 'utf8');
console.log(`Generated release notes: ${releaseNotesPath}`);

