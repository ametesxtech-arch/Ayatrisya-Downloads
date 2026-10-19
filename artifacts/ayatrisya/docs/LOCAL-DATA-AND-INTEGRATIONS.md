# Ayatrisya local application setup

## Local data

No cloud content database or backend upload service is used. Conversations,
projects, notes, documents, presentations, preferences and permitted files are
stored in IndexedDB in the current browser profile and current site origin.
Firebase identities have distinct local namespaces. Guest content is retained
separately; explicit guest import copies it and remaps references without deleting
the guest originals. Signing in does not upload guest content.

Browser quotas vary. The displayed `navigator.storage.estimate()` figures are
origin-wide estimates, not exact app-content bytes or a promised capacity.
Clearing site/browser data can permanently remove content. A persistence request
may be denied and is not a permanence guarantee.

Backup format: JSON envelope `format: "ayatrisya-backup"`, `version: 1`,
`exportedAt`, preferences, conversations, messages, projects, items, attachments
and separate base64 binary `assets`. Files are limited to 10 MB; supported backup
imports to 100 MB. Backups are unencrypted private-data files. Store them safely.
Schema, duplicate IDs, binary lengths, and parent references are validated before
an atomic restore. Merge keeps existing IDs unchanged; replace clears the current
local profile only. A downloaded backup is not a synchronization operation.

## Firebase Authentication

Uses the official Firebase web SDK only for identity. There is no Firestore
content storage. Configure these **public web-app configuration** variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Create/register a Firebase Web App, enable Email/Password and Google providers
in Firebase Authentication, and add the actual development/published app hostnames
to Firebase Authentication's authorized domains. Configure email verification and
password reset templates in that Firebase project. Restart/rebuild after changes.
Firebase web API keys identify a project, not a service-account credential.
Never put a service-account JSON/private key, client secret, or OAuth token in a
`VITE_*` variable. Configure appropriate Firebase API-key restrictions.

Without the configuration the app offers a real local guest workspace and clearly
unavailable sign-in. Real Google/email sign-in, registration, reset emails and
verification require owner-supplied configuration and live testing. No test here
proves these production identity flows.

## GitHub and Figma account connections

Connections are optional and belong to the signed-in Firebase account. The OAuth
callback and provider-token exchange run on the separate API service at
`/api/integrations/{github|figma}/callback`. Register the exact HTTPS callback
paths on each provider app for the preview and published app origins you use.
Set `AYATRISYA_APP_ORIGIN` to the exact published HTTPS origin in production.
The frontend and API service must share that origin.

Use Replit Secrets for `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
`FIGMA_OAUTH_CLIENT_ID`, and `FIGMA_OAUTH_CLIENT_SECRET`. Keep these server-only;
never give them a `VITE_` prefix or put them in an `.env` file. The existing
`SESSION_SECRET` encrypts short-lived OAuth state and provider sessions in
HttpOnly cookies. The server verifies Firebase ID tokens against Google's public
Firebase signing keys and binds each provider session to that Firebase user ID.
Provider tokens do not go to browser JavaScript or the local content database.

GitHub uses an OAuth App with the `read:user` scope. Register its homepage and
callback in GitHub Developer settings; GitHub permits up to ten callback URLs.
Figma uses an OAuth app with the `current_user:read` scope and the Figma REST API
OAuth flow. Figma requires the callback URI to match the app registration. A
draft Figma app can only be used by its creators/team; a public Figma app must
be published and approved by Figma before other users can authorize it.

These initial connections verify account identity only. They **do not** read
GitHub repositories or Figma design files, and they do not send or sync Ayatrisya
content. GitHub and Figma access tokens are encrypted in short-lived browser
cookies and are refreshed server-side when the provider supports it. Disconnect
clears Ayatrisya's session; revoke its authorization separately in the provider's
security settings to invalidate the provider grant too.

Set `FIREBASE_PROJECT_ID` on the API service to the same Firebase project as
`VITE_FIREBASE_PROJECT_ID`. Missing OAuth app settings are reported as not
configured; the app does not simulate a successful link. Browser tests cannot
confirm a live provider grant without owner-created OAuth apps and an authorized
test account.

## Optional user-owned Google Drive

`VITE_GOOGLE_CLIENT_ID` is a public OAuth Web Client ID. Enable the Drive API in
the chosen Google Cloud project, configure the consent screen/test users as
applicable, and register each exact HTTPS app origin under authorized JavaScript
origins. Request only `https://www.googleapis.com/auth/drive.file`.
No client secret is needed by this browser token flow.

The app uses Google Identity Services. Each end user grants consent themselves.
The Replit project-owner connector is intentionally NOT used to handle app users'
private content. Tokens are in memory only, expire, and are revoked on disconnect.
Connecting does not immediately upload anything.

Implemented boundary: manual browser-profile backup/restore in
`Ayatrisya/Backups/workspace-backup.json`, a local pending/failed/conflict queue,
bounded retry scheduling, checksums, guarded writes, explicit conflict choices,
pause/resume and read-back confirmation. It refuses to overwrite when Drive does
not provide an ETag. This is NOT a finished continuous, per-item, cross-device
bidirectional sync service. Exports/Projects remote folders, item-level tombstones,
automatic background retries and offline Drive files are not implemented.
Remote download requires an explicit validated merge/replace restore.
There are no live OAuth or Drive test results without an authorized account.

## Ametesx-owned model protocol

Optional `VITE_AYATRISYA_ENDPOINT` must be the exact HTTPS endpoint of
Ametesx-controlled infrastructure, with no credentials/query/fragment.
No third-party inference provider or localhost fallback is supported.
The browser sends no cookies or secrets to the model server; configure CORS for
the exact app origins. If model-server authorization becomes necessary, add a
server-side credential boundary rather than putting secrets in the browser.

- `GET /health` -> `{ "status": "ok" }`
- `GET /capabilities` -> `{ "models": [{ "id": "v1-fast" | "v2-best",
  "available": true, "reason": "...", "streaming": true,
  "modalities": ["chat", "stt", "tts"] }] }`
- `POST /chat` JSON `{ messages: [{role,content}], model, mode, stream }`
  where modes are `Normal`, `Savage`, `Joke`.
- Non-stream reply: `application/json` `{ "text": "..." }`.
- Stream: NDJSON or SSE `data:` JSON lines `{ "token": "..." }`,
  optional `{ "done": true }` / `[DONE]`. Errors may use `{ "error": "..." }`.
- `POST /transcribe` multipart audio -> `{ "text": "..." }`
- `POST /speech` JSON `{ "text": "..." }` -> `audio/*` bytes.

Text-only chat transport deliberately does not upload local attachments.
Generation supports network/format/status errors, 120-second timeout, AbortSignal
and stop cancellation. STT/TTS calls are gated by declared actual capability.
No prompt/audio/file body is logged. There is no production mock AI mode.
The development-only Models settings visual preview is explicitly labelled
`DEMO — NOT REAL AI`, isolated from conversations, and removed from production.

The application cannot prove ownership from a URL; the deployment owner must
configure only Ametesx infrastructure and disclose remote processing to users.
Next: deploy the team's runtime, confirm protocol/CORS, configure the endpoint,
then test capability availability, real generation, streaming, stop, failures,
privacy consent and STT/TTS with team-provided models.

## Desktop release

Optional `VITE_DESKTOP_DOWNLOAD_URL` must point to a genuine HTTPS release.
Until supplied, desktop download remains coming soon. The browser does not
execute commands or read arbitrary folders.

## Checks

`pnpm --filter @workspace/ayatrisya run test`
`pnpm --filter @workspace/ayatrisya run test:browser` (running dev workflow,
Replit Chromium and Node 24; uses a separate temporary browser profile)
`pnpm --filter @workspace/ayatrisya run typecheck`
`PORT=25517 BASE_PATH=/ pnpm --filter @workspace/ayatrisya run build`

Unit tests use fake IndexedDB / mocked network boundaries. They are not live
Firebase, Drive or model-runtime integration tests.
