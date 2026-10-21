# Ayatrisya local application setup

## Local data

By default, conversations, projects, notes, documents, presentations,
preferences, and permitted files are stored in IndexedDB in the current browser
profile and site origin. Desktop uses a stable local `localhost` origin for
IndexedDB, and user-selected project folders remain at their original paths.
Separate, opt-in routes can send selected personalization settings to Firebase
Firestore, user-selected content/backups to Google Drive, and model requests to
the authenticated hosted model gateway. Those routes are described below; local
storage does not mean that every optional feature is local-only.
Firebase identities have distinct local namespaces. New users must sign in; there
is no anonymous workspace. Records created by older guest-mode versions stay in a
separate legacy namespace and can be explicitly imported after sign-in. Import
copies and remaps references without deleting the original records.

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

Uses the official Firebase web SDK for identity. Optional cross-device
personalization uses one Firestore document per signed-in user. It contains a
built-in wallpaper choice and selected personalization controls, including the
memory summary; it does not contain conversations, messages, attachments, or
custom wallpaper image bytes. Turning sync off stops future sync but does not
delete the existing Firestore document. Configure these **public web-app
configuration** variables:

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

Without the configuration, workspace and onboarding access are blocked and the
sign-in screen explains that Firebase setup is required. Email/password account
creation and sign-in, Google sign-in, reset emails and verification require
owner-supplied configuration and live testing. No test here proves these
production identity flows.

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
workspace content. The API service exchanges OAuth codes, retrieves account
identity, and stores an encrypted provider session in a secure, HttpOnly cookie;
provider tokens are not available to browser JavaScript. Disconnect clears the
Ayatrisya session; revoke the provider grant separately in the provider's
security settings. Cookie expiry depends on provider token expiry and the
configured maximum session lifetime; this is not a statement about provider
data retention.

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

Implemented boundary: full browser-profile backup/restore in
`Ayatrisya/Backups/workspace-backup.json`, plus explicit project and item copies
after the user selects those actions. A full backup can include conversations,
messages, projects, notes, preferences, attachment metadata, and file bytes.
Uploads use a local pending/failed/conflict queue, guarded writes, explicit
conflict choices, and read-back confirmation; overwrites are refused without a
Drive ETag. This is not automatic continuous bidirectional sync. Remote full
backup restore requires an explicit validated merge/replace choice. The app can
move tracked remote project/item copies to Drive trash; no in-app delete control
for the full backup file was found, so users must manage that copy in Drive.
There are no live OAuth or Drive test results without an authorized account.

## Hosted and desktop-local model processing

The browser sends model requests to the same-origin Ayatrisya API routes under
`/api/model/*`. The API verifies a Firebase ID token, applies per-user limits,
and forwards the request to the HTTPS endpoint configured by the server-only
`AYATRISYA_MODEL_ENDPOINT` and `AYATRISYA_MODEL_API_KEY` variables. The model
endpoint operator, region, and content-retention terms are deployment-specific
and were not verified in this workspace. A URL or environment variable alone
does not prove that the endpoint is operated by Ametesx.

Hosted chat sends the message history supplied to the model, together with
personalization-injected context. The chat attachment bytes are stored locally
and are not included in the chat request; when a message contains only
attachments, the submitted model text includes their filenames. Hosted
transcription sends the selected recording to the model endpoint, and speech
synthesis sends its text. Image, 3D, and music generation send the prompt and
generation settings. Returned text/audio/assets are received by the app and
saved locally when the user chooses to keep them.

Ayatrisya Desktop uses a separate Electron main-process bridge to a model
service on the same computer, restricted to loopback addresses and fixed model
paths. It does not send model requests to the hosted gateway as a fallback.
This integration does not include model weights or establish which local model
is installed. The local model service itself receives the request.

The gateway has request-size limits, per-user rate limits, a timeout, and
cancellation. The model route does not intentionally log prompt or audio bodies;
platform, API access-log, and model-endpoint logging/retention policies are not
verified here. No claim about remote retention or training use is made.

## Desktop app

The desktop build uses Electron and the shared React/Vite UI. Renderer JavaScript
has no Node.js or shell access. A small context-isolated preload exposes only
typed project-folder operations; the main process accepts requests only from
the trusted top-level Ayatrisya window.

Folder access requires choosing each directory in the operating-system picker.
Only relative paths under a granted folder can be listed, read or edited.
Symlinks are not exposed by the file list and resolved paths are checked against
the selected folder. The built-in editor accepts text files up to 1 MB. Revoking
access removes Ayatrisya's saved grant and does not delete user files.

The desktop command runner is one-shot, not an interactive persistent shell.
Each command is shown in an operating-system confirmation dialog with its exact
working folder. It runs only in that selected project root, has a 60-second
timeout and a 128 KB output limit. The web app does not expose this bridge and
does not claim unrestricted local-file or terminal access.

The selected-folder grants and the desktop app's local data remain on that
computer. Existing Google Drive backup/restore is optional and user-triggered;
it currently covers Ayatrisya's own workspace backup, **not the contents of
selected OS project folders**. Those folders are not uploaded or synced.

The packaged app serves its UI from a stable loopback `localhost` origin so
IndexedDB remains available across restarts. Add `localhost` to Firebase
Authentication's authorized domains for desktop sign-in. The OAuth popup
bridge permits Firebase's standard `firebaseapp.com` / `web.app` auth handler
and Google OAuth popups; custom Firebase auth domains need a deliberate
desktop allowlist change before they will work.

See [DESKTOP-APP.md](DESKTOP-APP.md) for development, installer commands and
OS-specific build/signing requirements. Installer artifacts are written to
`generated-artifacts/ayatrisya-desktop/` and are not committed or deployed.

## Checks

`pnpm --filter @workspace/ayatrisya run test`
`pnpm --filter @workspace/ayatrisya run test:browser` (running dev workflow,
Replit Chromium and Node 24; uses a separate temporary browser profile)
`pnpm --filter @workspace/ayatrisya run typecheck`
`PORT=25517 BASE_PATH=/ pnpm --filter @workspace/ayatrisya run build`

Unit tests use fake IndexedDB / mocked network boundaries. They are not live
Firebase, Drive or model-runtime integration tests.
