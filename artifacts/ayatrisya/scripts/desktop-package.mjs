import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawTarget = (process.argv[2] || '').toLowerCase().replace(/^[.-]/, '');

const targetAliases = {
  exe: 'windows',
  win: 'windows',
  windows: 'windows',
  dmg: 'mac',
  mac: 'mac',
  macos: 'mac',
  appimage: 'linux',
  linux: 'linux',
  all: 'all',
};

const target = targetAliases[rawTarget];

const targets = {
  linux: ['--linux', 'AppImage'],
  windows: ['--win', 'nsis'],
  mac: ['--mac', 'dmg', '--universal'],
};

if (!target) {
  throw new Error('Choose a desktop build target: .exe (windows), .dmg (mac), .appimage (linux), or all.');
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const env = {
  ...process.env,
  PORT: process.env.PORT || '4187',
  BASE_PATH: '/',
  NODE_ENV: 'production',
  VITE_API_URL: process.env.VITE_API_URL || 'https://ayatrisya-model-api.onrender.com',
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAsTIhiNu7UhTwOh-gfY5exLLIX9qGRtyk',
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'ayatrisya.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'ayatrisya',
  VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '1:663542830691:web:70912ddce81c1ecd284a56',
};
delete env.REPL_ID;

function run(args, label) {
  const result = spawnSync(pnpm, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
}

// Build production web bundle first
run(['exec', 'vite', 'build', '--config', 'vite.config.ts'], 'desktop web build');

function packageTarget(t) {
  console.log(`\n========================================`);
  console.log(`Packaging Ayatrisya for target: ${t.toUpperCase()}`);
  console.log(`========================================\n`);

  if (t === 'mac') {
    if (process.platform !== 'darwin') {
      console.warn('Notice: macOS .dmg installer targets require macOS (or macOS CI agent) to produce signed DMG images.');
      console.log('Packaging macOS bundle files with electron-builder...');
    } else {
      try {
        run(['exec', 'node', 'scripts/prepare-mac-icon.mjs'], 'macOS icon preparation');
      } catch (err) {
        console.warn('Icon preparation warning:', err.message);
      }
    }
  }

  if (t === 'windows') {
    try {
      run(['exec', 'node', 'scripts/prepare-war-mode-assets.mjs'], 'WAR MODE scanner asset preparation');
    } catch (err) {
      console.warn('War mode asset preparation note:', err.message);
    }
  }

  run(['exec', 'electron-builder', ...targets[t], '--publish', 'never'], `${t} installer build`);
}

if (target === 'all') {
  if (process.platform === 'win32') {
    packageTarget('windows');
    try {
      packageTarget('linux');
    } catch (err) {
      console.warn('Linux AppImage cross-build note:', err.message);
    }
  } else if (process.platform === 'darwin') {
    packageTarget('mac');
    packageTarget('linux');
    packageTarget('windows');
  } else {
    packageTarget('linux');
    packageTarget('windows');
  }
} else {
  packageTarget(target);
}

console.log(`\nDesktop package artifacts location: ../../generated-artifacts/ayatrisya-desktop`);
