# Ayatrisya Privacy Policy — Internal Draft

> **NOT APPROVED · NOT PUBLISHED · NOT EFFECTIVE.** This is an evidence-based
> working draft for owner and qualified legal review. It is not legal advice or
> a statement of legal compliance.

**Effective date:** Pending owner and qualified legal approval. No date is set.

## Owner decisions required before publication

- Confirm the legal/service operator's name and any applicable parent/subsidiary
  relationship. “Ametesx” is a product/brand label in the checked UI; the legal
  entity behind it was not established by this source review.
- Provide a verified, monitored privacy contact and a process for access,
  correction, deletion, and other privacy requests. No verified contact channel
  was found in the checked project files.
- Identify the intended countries/regions of operation and audience, then obtain
  qualified legal review of applicable notice, consent, children's privacy,
  retention, transfer, and user-rights requirements. Do not infer a jurisdiction
  from the workspace timezone or hosting setup.
- Confirm the production web/API hosting operator, deployment regions, CDN and
  access-log configuration, and their retention terms. The checked artifact
  manifests describe build/run behavior but do not identify a production
  deployment, region, or live data-processing agreement.
- Reconcile the web artifact metadata description, which still describes an
  earlier UI-only prototype with AI/storage/OAuth/cloud services not implemented,
  against the current source and actual deployed build. The policy must describe
  the production build, not an assumed workspace configuration.
- Identify the operator and region for the configured model endpoint, all
  subprocessors, model/data terms, whether inputs or outputs are logged or used
  for training, and the actual deletion/retention process. The source uses
  server-side `AYATRISYA_MODEL_ENDPOINT` and `AYATRISYA_MODEL_API_KEY`; their
  runtime values and service terms were not inspected or verified.
- Confirm Firebase project ownership and Firestore region, rules, backups, and
  retention. Confirm Google Drive, Google Identity Services, GitHub, and Figma
  terms and relevant provider settings for the production OAuth apps.
- Define account deletion and remote-data deletion procedures. The app currently
  has no in-app Firebase account deletion flow.
- Set the effective date only after the final notice is approved and deployed.

## Verified implementation and data flows

### Browser-local workspace

The web app stores workspace conversations, messages, projects, project items,
attachments/file bytes, and preferences in an owner-scoped IndexedDB database
for the current browser profile and app origin. Custom wallpaper image bytes
also remain in local preferences. The app does not automatically upload these
records merely because a person signs in.

Browser `localStorage` is used for a legacy guest-mode flag and the guest image
generation counter. The sidebar layout preference is written to a first-party
`sidebar_state` cookie with a seven-day max age. These are functional storage
mechanisms, not an analytics-cookie inventory. Firebase Authentication uses the
Firebase web SDK's session persistence; this app does not explicitly select a
different persistence mode.

Browser storage can be cleared or evicted and is not a durable backup. A
downloaded workspace backup is unencrypted JSON and may contain conversations,
messages, projects, notes, preferences, attachment metadata, and file bytes.

### Firebase Authentication and optional Firestore

The client uses Firebase Authentication for email/password, Google, and GitHub
sign-in when configured. The app receives Firebase user fields such as UID,
email, display name, provider information, and email-verification state. Firebase
also handles password reset and verification email flows. The Firebase project
operator, region, provider-side retention, and production settings have not been
verified from the client source.

When a signed-in, non-guest user explicitly enables cross-device personalization,
the app reads and writes `users/{uid}/privateSettings/personalization` in
Firestore. The document contains a built-in wallpaper identifier, selected
personalization controls (including the memory summary and custom instructions),
schema version, and update timestamp. It does not contain chat history,
attachments, or custom wallpaper image bytes. Turning sync off stops future
app-side sync; it does **not** delete the existing cloud document. No app control
to delete that Firestore document was found.

### Hosted model requests

In the browser, model requests go to the same-origin Ayatrisya API under
`/api/model/*`. The API requires and verifies a Firebase ID token, applies
per-user rate limits, request-size limits and timeouts, then forwards the request
to the server-configured HTTPS Ayatrisya model endpoint using a server-only key.
The endpoint operator, deployment region, logging, training use, and retention
period are unknown until the service owner verifies the live deployment and its
terms.

Verified request content:

- Chat: the conversation history supplied by the chat screen, plus
  personalization-injected context, model choice, and mode. Locally stored
  attachment bytes are not included in chat requests. For an attachment-only
  message, the chat text sent to the model contains attachment filenames.
- Image, 3D, and music: user-entered prompt and generation settings.
- Transcription: the selected audio recording is uploaded to the model endpoint.
- Speech synthesis: the requested text is sent to the model endpoint.
- Responses: generated text and media return through the Ayatrisya API to the
  browser. Generated content is saved in local workspace storage when retained
  by the user.

The planner sends the selected project type and user brief after the user
confirms; it does not include project files. The desktop coding agent reads only
the explicitly selected project files and task, then sends that context through
the desktop loopback bridge to the local model service after confirmation. It
does not send those files through the hosted Ayatrisya gateway. The selected
files remain on the device unless the user separately uploads them elsewhere.
The desktop-local adapter does not support the hosted transcription or speech
routes; those requests fail rather than silently switching to hosted inference.

The API source does not intentionally log request bodies in the model proxy.
That does not establish what the hosting platform, reverse proxy, or model
endpoint records. Their access logs and retention are owner-review items.

### Desktop-local inference

Ayatrisya Desktop has a separate context-isolated Electron bridge that permits
fixed model routes only to loopback addresses on the same computer. Requests go
from the native process to the user's configured local model service; the
renderer cannot select arbitrary destinations. Desktop does not silently fall
back to hosted inference if its local model is missing or fails. The local
runtime operator is the device user; Ayatrisya does not establish which model
software is installed or how that separate software handles data.

### Google Drive backup and user-selected copies

The user authorizes Google Drive through Google Identity Services and the
`drive.file` scope. The browser sends authorized requests directly to Google
Drive APIs. A full workspace backup can include the local workspace records and
file bytes described above. The app also offers explicit project/item upload,
download, and conflict-resolution actions. These actions are user-triggered;
they are not continuous automatic workspace sync.

The OAuth access token is held in memory by the client and can expire. Disconnect
asks Google to revoke the current token. Tracked project/item remote copies can
be moved to Drive trash by an app control. No in-app delete control for the full
workspace-backup file was found; a user can manage that file in Google Drive.
Google's service region, retention, and trash/deletion timing remain subject to
the user's Google account and Google's terms.

### GitHub and Figma account connectors

These are separate from Firebase GitHub sign-in. The optional GitHub connector
requests `read:user`; the Figma connector requests `current_user:read`. The
verified routes retrieve account identity only and do not read repositories or
Figma design files. Firebase ID tokens and OAuth responses pass through the
Ayatrisya API; the API exchanges authorization codes and fetches account
profiles. Encrypted provider sessions, including provider tokens and account
name, are stored in secure HttpOnly cookies rather than browser JavaScript.

Disconnect clears the Ayatrisya session cookie; it does not necessarily revoke
the provider's grant. The user can revoke it in GitHub or Figma account settings.
Provider-side location, logging, and retention are governed by those providers
and are not verified here.

### Fonts and request metadata

The app loads DM Sans, Manrope, and IBM Plex Mono from Google Fonts at runtime.
This can expose ordinary request metadata such as network address and browser
headers to Google; the font requests do not contain workspace prompts or files.
No analytics or advertising SDK was found in the inspected client source or
package manifest. Production-injected scripts, tags, CDN behavior, and hosting
access logs were not verified.

## Deletion controls and limits

- **Clear local data:** Settings → Storage and backup removes the current
  workspace owner's records from the current browser's IndexedDB. It does not
  clear the separate guest-mode/image-quota `localStorage` values, the sidebar
  cookie, or the Firebase Authentication session. It does not delete a Firebase
  account, Firestore personalization document, Google Drive copy, model endpoint
  logs, or provider records.
- **Turn off personalization sync:** stops app-side synchronization but keeps the
  existing Firestore document. There is no app-side cloud-preference deletion
  control verified in the source.
- **Delete Drive copies:** the app can move tracked project/item copies to Drive
  trash. A full backup file must be managed in Drive. Drive trash and permanent
  deletion follow Google Drive behavior; no timing guarantee is made here.
- **Delete an account:** signing out only ends the current Firebase session.
  Account deletion is not implemented in the app. No verified support/privacy
  channel or backend account-deletion procedure was found.
- **Provider access:** disconnecting a GitHub/Figma connector removes the local
  Ayatrisya session but may leave provider authorization active until separately
  revoked at that provider.

The source code does not establish remote retention periods, and no retention
period is stated in this draft. No security or privacy outcome is guaranteed.

## Source files checked

- `src/storage/database.ts`, `src/storage/repository.ts`,
  `src/storage/backup.ts`, `src/storage/types.ts`
- `src/integrations/firebase/client.ts`,
  `src/integrations/firebase/AuthProvider.tsx`,
  `src/integrations/firebase/personalization-sync.ts`,
  `src/integrations/firebase/CloudPreferenceSync.tsx`
- `src/ai/client.ts`, `src/pages/workspace/Chat.tsx`,
  `src/components/CodingPlanner.tsx`,
  `src/components/DesktopCodingAgent.tsx`,
  `src/integrations/google-drive/client.ts`,
  `src/integrations/google-drive/sync.ts`
- `src/components/ProviderConnections.tsx`,
  `artifacts/api-server/src/routes/integrations.ts`,
  `artifacts/api-server/src/routes/model.ts`,
  `artifacts/api-server/src/lib/logger.ts`
- `index.html`, `.replit-artifact/artifact.toml` for the web artifact, and the
  API artifact's `.replit-artifact/artifact.toml`
- `.env.example` for variable names only; no secret values were read

## Legal review

Qualified counsel should review the final notice after the operator, user
locations, actual services, live data flows, retention, and deletion procedures
are confirmed. This draft does not choose a legal jurisdiction or claim
compliance with any law.
