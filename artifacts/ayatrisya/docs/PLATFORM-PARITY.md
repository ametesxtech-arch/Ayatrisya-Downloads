# Ayatrisya Platform Parity Audit

Status: PWA foundation and opt-in desktop companion implemented in development. Windows browser/desktop integration, production hosting, and user acceptance remain unverified. “Available” describes an implemented code path, not a claim that AI inference is connected.

| Capability | Web / PWA | Native desktop | Audit result |
|---|---|---|---|
| Shared workspace routes and core React UI | Existing | Existing shared UI | Available; both use the same React application and routed workspace. |
| Responsive navigation | Existing mobile sidebar and breakpoint-based layout | Same UI, desktop viewport | Existing breakpoints, safe areas, and mobile navigation; run the browser viewport suite before claiming full device verification. |
| Sign-in and account access | Firebase Auth; requires a network connection for provider operations | Firebase Auth through the desktop app | Available when configured; offline authentication is not promised. |
| Saved conversations, projects, documents, notes, and preferences | Browser-local storage, with selected account preferences/backups able to sync | Persistent local app origin; same workspace UI | Available; PWA uses the same browser origin and storage as the website. |
| Chat and model selection | Authenticated hosted model gateway | Explicitly configured same-computer loopback model | Partial; hosted inference currently returns 503 because the configured endpoint is private/local HTTP. Desktop does not silently fall back to hosted inference. |
| Research and writing | Manual research notes; local documents and export | Same UI | Available as local productivity workflows; generated AI output depends on verified model inference. |
| Coding | Planner/task specifications and ZIP storage; an optional same-computer companion can expose a bounded file tree/editor and confirmed commands | User-selected local folder, bounded text editing, and individually confirmed commands | Partial; the companion does not provide model inference or a browser build/preview executor. Without an enabled, paired desktop app, the website has no host file or shell access. |
| WAR MODE | Not available in a browser | Windows-local Defender integration and bundled rule scanner | Desktop-only by design; preserve offline behavior and do not emulate it in the PWA. |
| Image, 3D, music, voice tools | Shared screens, but availability depends on model capabilities | Same screens plus local model routing when configured | Partial; do not claim generation works until a real model response is demonstrated. |
| PWA manifest, service worker, install prompt, offline fallback | Manifest, install guidance, update prompt, and static offline notice are implemented | Not applicable | Requires an HTTPS production host for public installability. No Firebase Hosting deployment or production configuration was performed. |
| Static asset/offline caching | Service worker caches the offline notice, manifest, icons, CSS, and bounded public media only | Not applicable | JavaScript bundles are intentionally excluded because they contain browser Firebase client configuration. No API/auth responses or private workspace data are cached. Offline mode shows a static notice; the full workspace still needs network. |
| Desktop companion | Browser can pair for 15 minutes with a running, explicitly enabled desktop app; folder selection uses the native picker; supported source reads, file writes, commands, and activity log are bounded | Separate opt-in loopback service in Electron main process | Service binds only to `127.0.0.1`, uses exact-origin/Host checks, browser pairing with native approval, in-memory token, per-edit and per-command native confirmations, and cancellation. Windows browser Private Network Access behavior remains unverified. |
| Deep links | Wouter routes plus the existing SPA rewrite to `index.html` | Same app routes | Available; preserve the configured base path. |
| Installer downloads | `/desktop` enables platform links only with a direct HTTPS installer URL plus version, size, SHA-256, and HTTPS release notes; otherwise downloads stay disabled. Verified status requires linked native test evidence. | Existing Linux x64 AppImage, Windows x64 NSIS, and macOS universal DMG build targets | No public URLs are configured. Do not invent URLs or publish artifacts. Windows signing and macOS notarization are not configured. |

## Companion constraints

- The loopback companion is separate from Electron’s static content server and is disabled until the user enables it for that desktop session.
- Packaged builds accept only `https://ayatrisya.web.app`. Local development additionally accepts the local Vite origin passed to the desktop development process. Replit preview origins are not allowlisted.
- Browser sessions are bound to the approved origin, kept in memory for 15 minutes, and revoked on disconnect, page exit where the browser permits, or desktop shutdown.
- The website receives no project root paths. The companion allows supported text source/documentation files only; it filters credential, generated, dependency, and private-key paths. File creation/edits and each command require a native desktop confirmation.
- Command execution still runs with the desktop user’s OS permissions; it is not a sandbox. The runner has a 60-second timeout, a 128 KB output cap, and cancellation support.
- The companion does not route file contents to a model. Do not claim AI coding is available through it.
- A PWA on a phone cannot access a different computer’s loopback listener. The desktop and browser must run on the same computer.
- The official Privacy Policy remains unpublished. Its owner review must account for this new optional local browser-to-desktop data flow before any future publication.

## Boundaries

- A browser/PWA cannot use the host filesystem or run native commands unless the user explicitly enables and pairs the same-computer desktop companion.
- The current offline PWA provides a static fallback notice and public styles/images only. It does not cache executable bundles, auth, chat, API responses, or private data.
- Hosted AI, Firebase sign-in, synchronization, and model generation still require their respective services and must show unavailable states offline. The configured hosted AI endpoint still returns 503; the companion is not an AI fallback.
- The service worker bypasses `/api`, all non-static/private requests, and all JavaScript bundles.
- Linux unit/security tests do not verify Windows native dialogs, installer behavior, or browser Private Network Access. Do not claim Windows integration is verified until it passes on a Windows runner.
- This audit does not authorize production deployment, Firebase changes, model-provider changes, or installer publication.

## Verification

- TypeScript typecheck passed.
- Vitest: 73 tests passed.
- Desktop/security Node tests: 25 passed, including loopback binding, origin/Host checks, pairing/revocation, request limits, cancellation, and browser-companion path policy.
- Production Vite build and `test:pwa` passed. The generated service worker allowlist contains 8 public assets (about 0.70 MiB); it excludes executable JavaScript, APIs, and private workspace data.
- `test:browser` passed its current browser-flow suite with no browser exceptions and no unexpected network writes. It observed 20 Firebase Authentication writes and 0 Firestore writes. This is not a verification of a real user account or hosted AI inference.
- The public desktop/PWA information page was visually checked at desktop and phone widths. Authenticated companion permissions and Windows browser Private Network Access were not exercised in a Windows desktop build.
- The build reports existing chunk-size warnings (two bundles exceed 500 KB) and a tooltip source-map warning. These did not fail the build.
- No production deployment, Firebase Hosting change, installer publication, Windows native test, macOS test, or hosted model test was performed.
