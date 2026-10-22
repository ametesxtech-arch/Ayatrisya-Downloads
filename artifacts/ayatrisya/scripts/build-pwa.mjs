import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(appRoot, "dist", "public");
const maxCacheBytes = 40 * 1024 * 1024;
const maxImageBytes = 1024 * 1024;
const staticAssetExtensions = new Set([
  ".css", ".woff", ".woff2", ".ttf", ".otf", ".svg",
  ".png", ".jpg", ".jpeg", ".webp", ".avif",
]);
const imageExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif"]);

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(item) : [item];
  }));
  return nested.flat();
}

async function includeAsset(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!staticAssetExtensions.has(extension)) return false;
  const { size } = await fs.stat(filePath);
  return !imageExtensions.has(extension) || size <= maxImageBytes;
}

const publicFiles = await walk(outputRoot);
const relativePath = (filePath) => `./${path.relative(outputRoot, filePath).split(path.sep).join("/")}`;
const coreNames = [
  "manifest.webmanifest",
  "offline.html",
  "favicon.svg",
  "favicon.ico",
  "ayatrisya-icon-192.png",
  "ayatrisya-desktop.png",
  "brand/ayatrisya-mark.svg",
];
const precache = new Set();

for (const name of coreNames) {
  const filePath = path.join(outputRoot, name);
  await fs.access(filePath);
  precache.add(`./${name}`);
}

for (const filePath of publicFiles) {
  const relative = path.relative(outputRoot, filePath);
  if (!relative.startsWith(`assets${path.sep}`)) continue;
  if (await includeAsset(filePath)) precache.add(relativePath(filePath));
}

const precacheUrls = [...precache].sort();
let totalBytes = 0;
for (const url of precacheUrls) {
  if (url === "./") continue;
  const filePath = path.resolve(outputRoot, url.slice(2));
  totalBytes += (await fs.stat(filePath)).size;
}
if (totalBytes > maxCacheBytes) {
  throw new Error(`PWA public asset cache would be ${totalBytes} bytes; limit is ${maxCacheBytes} bytes.`);
}

const cacheVersion = createHash("sha256").update(precacheUrls.join("\n")).digest("hex").slice(0, 12);
const worker = `/* Generated from the production public asset list. Never cache API or user data. */
const CACHE_PREFIX = "ayatrisya-shell-";
const CACHE_NAME = CACHE_PREFIX + "${cacheVersion}";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};
const PRECACHE_PATHS = new Set(PRECACHE_URLS.map((item) => new URL(item, self.registration.scope).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "AYATRISYA_ACTIVATE_UPDATE") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(new URL("./offline.html", self.registration.scope))) || Response.error();
    }));
    return;
  }

  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) =>
      (await cache.match(request, { ignoreSearch: true })) || fetch(request)));
  }
});
`;

await fs.writeFile(path.join(outputRoot, "service-worker.js"), worker, "utf8");
console.log(`PWA shell prepared: ${precacheUrls.length} public assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB precached.`);
