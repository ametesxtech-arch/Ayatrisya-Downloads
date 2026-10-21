# Ayatrisya client integration report

## Result

The Ayatrisya web client and desktop renderer now use a shared model client with an explicit platform boundary:

| Client | Model route | Failure behavior |
| --- | --- | --- |
| Web, mobile web, or any page without a verified desktop bridge | Same-origin `/api/model/*` with a Firebase ID token; the API server is responsible for Firebase verification and keeps provider credentials server-side | Auth, endpoint, and model failures are reported; the browser does not call a model vendor directly |
| Ayatrisya Desktop with a valid version-1 bridge handshake | Loopback model adapter through validated Electron IPC | If no local adapter/model is available, the request fails locally. It does not request a Firebase token or fall back to cloud |
| WAR MODE in browser/mobile web | No scanner access | Shows that local scanning requires Ayatrisya Desktop on Windows |
| WAR MODE in Ayatrisya Desktop | Existing local scanner/Defender IPC | Remains independent from model inference |

No user-agent detection is used to decide the model route. The desktop handshake is validated by the renderer and its IPC handler uses the existing trusted sender/frame checks. The renderer still has no direct filesystem, Node.js, or shell access.

## Changes

- Added a versioned desktop runtime handshake returning the app version, platform, allowlisted capabilities, local endpoint state, and the local model IDs/modalities the adapter reports.
- Added a shared runtime validator and React hook. Settings, desktop project access, and WAR MODE use the verified handshake instead of trusting the mere presence of a preload object.
- Removed desktop-to-cloud fallback when a verified desktop has no local endpoint. Unsupported desktop operations, including local speech routes not implemented by the bridge, return unavailable instead of crossing to the cloud.
- Added typed model listing/status operations and session-scoped request jobs with running/completed/failed/cancelled status and cancellation. Chat, coding planning, the desktop coding agent, image/3D/music generation, speech studio, and the settings inference test submit through this shared client.
- Preserved actual chat token streaming where the adapter reports streaming support. No synthetic percentage progress is shown for asset generation.
- Kept the existing authenticated web gateway and local War Mode separation.

### Job API boundary

The job IDs and statuses are currently held in the client process and jobs run immediately. The API server does not expose durable queued-job creation, status polling, or cancellation endpoints. These are not represented as server queue capabilities and status does not survive a reload.

## Changed files

- `artifacts/ayatrisya/electron/main.cjs`
- `artifacts/ayatrisya/electron/preload.cjs`
- `artifacts/ayatrisya/src/ai/client.ts`
- `artifacts/ayatrisya/src/ai/types.ts`
- `artifacts/ayatrisya/src/desktop/contracts.ts`
- `artifacts/ayatrisya/src/desktop/runtime.ts`
- `artifacts/ayatrisya/src/desktop/use-runtime.ts`
- `artifacts/ayatrisya/src/hooks/use-prefs.ts`
- `artifacts/ayatrisya/src/pages/workspace/Chat.tsx`
- `artifacts/ayatrisya/src/pages/workspace/Settings.tsx`
- `artifacts/ayatrisya/src/pages/workspace/Studios.tsx`
- `artifacts/ayatrisya/src/components/CodingPlanner.tsx`
- `artifacts/ayatrisya/src/components/DesktopCodingAgent.tsx`
- `artifacts/ayatrisya/src/components/DesktopProjectManager.tsx`
- `artifacts/ayatrisya/src/components/WarModePanel.tsx`
- `artifacts/ayatrisya/src/tests/desktop-runtime.test.ts`
- `artifacts/ayatrisya/src/tests/local-model.test.ts`
- `artifacts/ayatrisya/src/tests/model-jobs.test.ts`
- `docs/CLIENT_INTEGRATION_AUDIT.md`
- `docs/CLIENT_INTEGRATION_REPORT.md`

## Verification and limits

The report must distinguish source-level tests from live integration:

- **Ayatrisya TypeScript check:** passed.
- **Ayatrisya automated tests:** 11 test files passed; 67 tests passed.
- **API server tests:** 4 test files passed; 18 tests passed.
- **Electron Node tests:** 16 passed across four test files, including loopback endpoint policy, project-file/path validation, archive validation, and WAR MODE command/status safety.
- **Electron syntax:** `main.cjs` and `preload.cjs` passed `node --check`.
- **Hosted gateway auth gate:** an unauthenticated `GET /api/model/health` returned `401 Sign in to Ayatrisya to use hosted models.` This confirms the gate, not successful model inference.
- **Browser checks:** 4 passed, including responsive landing widths from 320px through desktop and absence of browser errors. Authenticated workspace checks were skipped because test-account credentials were not configured; no signed-in screen is claimed as visually verified.
- **Production build:** succeeded with `PORT=5173` and `BASE_PATH=/`. Vite printed a sourcemap-location warning for the existing tooltip component and a large-chunk warning; output was produced successfully.
- **Live hosted inference:** not verified. A successful authenticated request with a non-empty response from a reachable Ayatrisya HTTPS model endpoint is still required.
- **Desktop inference:** not verified against the user's local model runtime because it runs on the user's computer, not in this Replit workspace.
- **Windows/macOS packaging:** not verified by these changes. No claim is made that a native installer or packaged app passed platform testing.
- **WAR MODE:** no scanner behavior was changed or newly verified by this client routing work.
