import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AYATRISYA_DESKTOP_PORT || 4187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('AYATRISYA_DESKTOP_PORT must be a port between 1024 and 65535.');
}
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const env = { ...process.env, PORT: String(port), BASE_PATH: '/' };
delete env.REPL_ID;

const vite = spawn(pnpm, [
  'exec', 'vite', '--config', 'vite.config.ts', '--host', 'localhost',
  '--port', String(port), '--strictPort',
], { cwd: root, env, stdio: 'inherit' });
let electron = null;
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  if (electron && electron.exitCode === null) electron.kill();
  if (vite.exitCode === null) vite.kill();
}

process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
vite.once('error', (error) => {
  console.error(`Could not start Vite: ${error.message}`);
  process.exitCode = 1;
  void stop();
});

const localUrl = `http://localhost:${port}/`;
let ready = false;
for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
  if (vite.exitCode !== null) break;
  try {
    const response = await fetch(localUrl);
    ready = response.ok;
  } catch {
    await delay(250);
  }
}
if (!ready) {
  console.error('Vite did not become ready on the local desktop development port.');
  process.exitCode = 1;
  await stop();
} else {
  const debugArgs = process.env.AYATRISYA_DESKTOP_DEBUG === '1'
    ? ['--remote-debugging-port=9223']
    : [];
  electron = spawn(pnpm, ['exec', 'electron', '.', ...debugArgs], {
    cwd: root,
    env: { ...env, AYATRISYA_DESKTOP_DEV_URL: localUrl },
    stdio: 'inherit',
  });
  electron.once('error', (error) => {
    console.error(`Could not start Electron: ${error.message}`);
    process.exitCode = 1;
    void stop();
  });
  electron.once('exit', (code) => {
    if (process.exitCode === undefined) process.exitCode = code ?? 0;
    void stop();
  });
  vite.once('exit', (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      void stop();
    }
  });
}

await new Promise((resolve) => {
  if (stopping) return resolve();
  const timer = setInterval(() => {
    if (stopping || (electron && electron.exitCode !== null) || vite.exitCode !== null) {
      clearInterval(timer);
      resolve();
    }
  }, 100);
});
await stop();
