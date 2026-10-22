# Ayatrisya Platform Parity Audit

Status: initial code audit. “Available” describes an implemented path, not a claim that a remote AI model is currently connected.

| Capability | Web / PWA | Native desktop | Audit result |
|---|---|---|---|
| Shared workspace routes and core React UI | Existing | Existing shared UI | Available; both use the same React application and routed workspace. |
| Responsive navigation | Existing mobile sidebar and breakpoint-based layout | Same UI, desktop viewport | Partial; responsive CSS and safe-area handling exist, but all routes still need device testing. |
| Sign-in and account access | Firebase Auth; requires a network connection for provider operations | Firebase Auth through the desktop app | Available when configured; offline authentication is not promised. |
| Saved conversations, projects, documents, notes, and preferences | Browser-local storage, with selected account preferences/backups able to sync | Persistent local app origin; same workspace UI | Available; PWA uses the same browser origin and storage as the website. |
| Chat and model selection | Authenticated hosted model gateway | Explicitly configured same-computer loopback model | Partial; hosted inference currently returns 503 because the configured endpoint is private/local HTTP. Desktop does not silently fall back to hosted inference. |
| Research and writing | Manual research notes; local documents and export | Same UI | Available as local productivity workflows; generated AI output depends on verified model inference. |
| Coding | Planner/task specifications and ZIP storage; no browser project file tree, multi-tab editor, or build/preview executor | User-selected local folder, bounded text editing, and individually confirmed commands | Partial; browser-compatible project editing and previews remain gaps. Browser terminal/shell access must not be added. |
| WAR MODE | Not available in a browser | Windows-local Defender integration and bundled rule scanner | Desktop-only by design; preserve offline behavior and do not emulate it in the PWA. |
| Image, 3D, music, voice tools | Shared screens, but availability depends on model capabilities | Same screens plus local model routing when configured | Partial; do not claim generation works until a real model response is demonstrated. |
| PWA manifest, service worker, install prompt, offline fallback | Missing in the initial audit | Not applicable | To be implemented for the web app only. |
| Static asset/offline caching | No service worker in the initial audit | Not applicable | Must cache only public shell assets; never cache API/auth responses or private workspace data. |
| Deep links | Wouter routes plus the existing SPA rewrite to `index.html` | Same app routes | Available; preserve the configured base path. |
| Installer downloads | `/desktop` reads verified HTTPS `VITE_DESKTOP_DOWNLOAD_*` values; blank values show “Not hosted” | Existing Linux AppImage, Windows NSIS, and macOS DMG build targets | Keep all targets; do not invent URLs or publish artifacts. Windows signing and macOS notarization are not configured. |

## Boundaries

- A browser/PWA cannot use the host filesystem or run native commands. Use the desktop app for those operations.
- Offline PWA support means the public app shell and static assets can load. Hosted AI, Firebase sign-in, synchronization, and model generation still require their respective services and must show unavailable states offline.
- The service worker must bypass `/api` and all non-static/private requests.
- This audit does not authorize production deployment, Firebase changes, model-provider changes, or installer publication.
