# Ayatrisya client integration audit

## Scope reviewed

Reviewed the React/Vite client, its model transport, Firebase auth, workspace and studio callers, Electron preload/IPC, and the War Mode panel. This audit distinguishes implemented code paths from live or platform-level verification.

## Existing functionality

- **Web authentication and cloud gateway:** The app uses Firebase auth. `src/ai/client.ts` obtains a Firebase ID token and calls same-origin `/api/model/*`; the API server verifies the token and keeps `AYATRISYA_MODEL_API_KEY` server-side. Chat, image, 3D, music, transcription, and speech routes exist in the contract and gateway.
- **Shared app caller:** Chat, coding agent, coding planner, image/3D/music studios, and voice tools call the shared `modelClient`, rather than calling a model vendor directly.
- **Desktop bridge:** Electron exposes a typed allowlist through `preload.cjs`, with context isolation, renderer Node integration disabled, sandboxing, and sender/frame URL checks in the IPC registration wrapper. Local endpoint validation permits loopback only.
- **Desktop-local models:** When a local endpoint is configured, the client uses validated desktop IPC for health, capabilities, chat, image, 3D, and music. The bridge currently does not carry an API key and does not support local speech routes.
- **War Mode:** The browser displays an explanatory, non-scanning state. The desktop panel calls local YARA-X and Windows Defender bridge methods and presents status, scan progress/counts, findings, review/quarantine, restore, rule updates, and audit history. These are separate from model inference.
- **Responsive web:** Workspace navigation and pages use responsive layouts and do not depend on user-agent detection for the desktop model transport.

## Implemented integration

- **Versioned desktop handshake:** Electron returns a version-1 runtime descriptor with the Ayatrisya app version, OS platform, allowlisted capabilities, local endpoint configuration state, and model availability reported by the local adapter. The preload exposes only this handshake; its IPC channel uses the existing trusted-window/frame check.
- **Verified runtime detection:** Client components treat the app as desktop only after validating the handshake shape and supported API version. Renderer user-agent checks are not used.
- **No silent desktop cloud fallback:** Once the handshake verifies Electron, model requests use only the loopback adapter. If no local endpoint is configured, the UI reports that state and generation fails locally without requesting a Firebase token or calling `/api/model`.
- **Unsupported local speech is explicit:** Desktop local capabilities are limited to the modalities the bridge actually supports. Transcription and speech synthesis do not fall back to hosted inference.
- **Shared inference contract:** Chat, coding agent/planner, media studios, and the live model test use the same `modelClient` capability and request interface. It includes model listing/status and in-memory request-job submission/status/cancellation. Chat streaming is retained where the actual upstream supports it.
- **Separate WAR MODE:** War Mode remains behind the verified desktop bridge, with browser/mobile web showing an explanatory offline state. It is not part of model inference.

## Remaining limitations

1. **No server-backed queue:** The API server does not provide a persistent job-creation/status/cancellation API. The new client job IDs and statuses are session-memory only; jobs are sent immediately, not queued, and there is no percentage progress for image/3D/music output unless the real adapter reports it. No fake server job endpoints were added.
2. **No live hosted inference verification:** This workspace has not completed an authenticated, non-empty inference through a reachable Ayatrisya HTTPS cloud model service. A health or capabilities response alone is not counted as an inference test.
3. **Desktop local runtime is user-owned and not reachable from Replit:** The loopback endpoint must be running on the end user's computer. This environment cannot verify its generated output.
4. **No packaged Windows/macOS integration test was run for this change:** Source-level IPC and browser tests do not prove the packaged desktop app, native model runtime, or War Mode on Windows/macOS.

## Security and privacy boundaries to preserve

- Browser and mobile web use only the authenticated same-origin API gateway.
- A verified desktop bridge routes model requests only to loopback IPC and must not fall back to cloud implicitly.
- Do not add arbitrary private-network/HTTP model targets, model-provider APIs, browser-visible secrets, or renderer filesystem/shell access.
- Keep War Mode local and separate from ordinary browser clients.

## Verification available in this workspace

The integration changes are covered by Ayatrisya typechecking and automated tests for handshake validation, no-cloud-fallback behavior, request-job state/cancellation, and existing local model IPC. These checks validate client code paths only; they do not prove live model inference or native Windows/macOS behavior. See `docs/CLIENT_INTEGRATION_REPORT.md` for exact results.
