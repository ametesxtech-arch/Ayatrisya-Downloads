import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const targets = {
  linux: ['--linux', 'AppImage'],
  windows: ['--win', 'nsis'],
  mac: ['--mac', 'dmg', '--universal'],
};
if (!targets[target]) throw new Error('Choose a desktop build target: linux, windows, or mac.');
if (target === 'mac' && process.platform !== 'darwin') {
  throw new Error('macOS DMG builds must run on macOS. No macOS installer was produced.');
}
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const env = { ...process.env, PORT: process.env.PORT || '4187', BASE_PATH: '/', NODE_ENV: 'production' };
delete env.REPL_ID;

function run(args, label) {
  const result = spawnSync(pnpm, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
}

if (target === 'mac') run(['exec', 'node', 'scripts/prepare-mac-icon.mjs'], 'macOS icon preparation');
run(['exec', 'vite', 'build', '--config', 'vite.config.ts'], 'desktop web build');
run(['exec', 'electron-builder', ...targets[target], '--publish', 'never'], `${target} installer build`);
console.log(`Desktop package output: ../../generated-artifacts/ayatrisya-desktop`);
