import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(appRoot, "dist", "public");
const manifest = JSON.parse(await fs.readFile(path.join(outputRoot, "manifest.webmanifest"), "utf8"));
const worker = await fs.readFile(path.join(outputRoot, "service-worker.js"), "utf8");

assert.equal(manifest.name, "Ayatrisya");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert(manifest.icons.some((icon) => icon.sizes === "192x192"));
assert(manifest.icons.some((icon) => icon.sizes === "512x512"));

for (const icon of manifest.icons) {
  const filePath = path.resolve(outputRoot, icon.src.replace(/^\.\//, ""));
  await fs.access(filePath);
  const png = await fs.readFile(filePath);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.readUInt32BE(16), Number(icon.sizes.split("x")[0]));
  assert.equal(png.readUInt32BE(20), Number(icon.sizes.split("x")[1]));
}

assert.match(worker, /request\.mode === "navigate"/);
assert.match(worker, /url\.pathname === "\/api" \|\| url\.pathname\.startsWith\("\/api\/"\)/);
assert.match(worker, /AYATRISYA_ACTIVATE_UPDATE/);
assert.doesNotMatch(worker, /caches\.put\(/);
assert.doesNotMatch(worker, /Authorization|firebase|token/i);
const precacheMatch = worker.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
assert(precacheMatch, "Generated worker should contain a static allowlist.");
const precacheUrls = JSON.parse(precacheMatch[1]);
assert(precacheUrls.includes("./offline.html"));
assert(precacheUrls.every((url) => !/\.m?js(?:$|\?)/i.test(url)), "Executable bundles must not be stored in the service-worker cache.");
assert(precacheUrls.every((url) => !/(^|\/)api(\/|$)/i.test(url)), "API routes must never be stored in the service-worker cache.");

console.log("PWA manifest, icons, static-only cache, offline fallback, update gate, and no-API-cache policy verified.");
