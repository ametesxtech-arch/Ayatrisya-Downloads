# Ayatrisya

Ayatrisya is Ametesx's local-first AI workspace and creative productivity platform. Private content belongs in the user's browser, not an Ayatrisya-owned cloud database. AI models are developed separately by the team in Antigravity.

## Run & Operate

- Managed workflow: `artifacts/ayatrisya: web`
- `pnpm --filter @workspace/ayatrisya run typecheck` — frontend TypeScript check
- `pnpm --filter @workspace/ayatrisya run test` — local repository and integration-boundary unit tests
- `PORT=25517 BASE_PATH=/ pnpm --filter @workspace/ayatrisya run build` — production frontend build
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- The UI does not require a database or the template API server.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web UI: React, Vite, Wouter, Tailwind CSS, Lucide icons
- The shared Express/OpenAPI/database packages are untouched template infrastructure.

## Where things live

- `artifacts/ayatrisya` — public landing page and local-first application
- `artifacts/ayatrisya/src/storage` — owner-scoped IndexedDB, migrations, validated backups and file blobs
- `artifacts/ayatrisya/src/integrations` — configured-only Firebase identity and optional per-user Drive backup boundary
- `artifacts/ayatrisya/src/ai` — Ametesx-owned model transport and capabilities
- `artifacts/ayatrisya/src/index.css` — theme and shared styling
- `artifacts/ayatrisya/docs/LOCAL-DATA-AND-INTEGRATIONS.md` — setup, backup format, protocols and honest integration limitations
- Latest source of truth: the master UI/application/storage brief in `attached_assets/`.

## Architecture decisions

- The latest brief supersedes the original UI-only restriction: build functional browser-local persistence now, then configured Firebase identity, the model boundary, and optional user-owned Drive.
- Do not connect third-party AI inference or image-generation APIs. Ametesx intends to train its own models.
- Use IndexedDB for actual user-created content and preferences. Start empty; do not seed fake histories/files/usage. No paid subscriptions or cloud content database.
- Firebase is explicitly requested for identity. Do not substitute Clerk/Replit Auth, and do not claim live sign-in passed without valid Firebase configuration and end-to-end evidence.
- A Replit owner's Drive connector must not handle app users' private content. Use each user's own drive.file consent. Never upload on connection without an explicit action.
- Test local persistence before Drive work. The current Drive boundary is manual snapshot backup/restore, not complete continuous per-item sync.
- Do not imply that planned models, authentication, research, sync, downloads, or local filesystem operations are operational. Use explicit preview/unavailable states.

## Product

Public landing, splash/onboarding, local chat history, projects/library/files, documents/presentations, research notes/coding tasks, image/3D/music/voice studios, settings, account, backup and restore. AI tools are unavailable until the team's runtime is configured.

## User preferences

- Preserve working code and assets when improving this app.
- Use a premium dark-first graphite and violet-indigo identity, restrained motion, consistent icons, and accessible responsive layouts.
- Never invent a historical/Sanskrit meaning or trademark claim for Ayatrisya.
- Never use fake performance claims, reviews, statistics, citations, downloads, or authenticated-account success.

## Gotchas

- Build commands need the artifact's `PORT` and `BASE_PATH`; managed workflows inject them for previews.
- Real local project coding requires a future desktop application. The browser preview must never claim arbitrary local-folder access.
- Never fabricate replies. V1 Fast and V2 Best Result availability comes from the capability boundary; modes are Normal, Savage and Joke.
- A local backup contains unencrypted private data. Confirm replacement/deletion, validate all incoming references and binary lengths, and keep restore atomic.
- Browser quotas are variable estimates; clearing site data may remove all local content.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
