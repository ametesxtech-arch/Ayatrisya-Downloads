# Ayatrisya

Ayatrisya is Ametesx's AI workspace and creative productivity platform. The current deliverable is a web UI preview, not an operational AI service.

## Run & Operate

- Managed workflow: `artifacts/ayatrisya: web`
- `pnpm --filter @workspace/ayatrisya run typecheck` — frontend TypeScript check
- `PORT=25517 BASE_PATH=/ pnpm --filter @workspace/ayatrisya run build` — production frontend build
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- The UI does not require a database or the template API server.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web UI: React, Vite, Wouter, Tailwind CSS, Lucide icons
- The shared Express/OpenAPI/database packages are untouched template infrastructure.

## Where things live

- `artifacts/ayatrisya` — public landing page and UI-only application
- `artifacts/ayatrisya/src/data` — illustrative demo fixtures
- `artifacts/ayatrisya/src/index.css` — theme and shared styling
- The full user brief is preserved in `.local/conversation-workspace/files/attached_assets/`.

## Architecture decisions

- Follow the user’s development sequence: finish the UI, then integrate Ametesx's own trained AI models, then implement local-first storage, desktop filesystem access, and optional Google Drive support.
- Do not connect third-party AI inference or image-generation APIs. Ametesx intends to train its own models.
- Keep demo state in memory. Do not add a cloud database, persistent storage engine, OAuth, or paid subscriptions during the UI phase.
- Do not imply that planned models, authentication, research, sync, downloads, or local filesystem operations are operational. Use explicit preview/unavailable states.

## Product

Public landing, authentication previews, onboarding, chat, research, coding/desktop preview, image studio, documents, presentations, projects, library, settings, and account UI.

## User preferences

- Preserve working code and assets when improving this app.
- Use a premium dark-first graphite and violet-indigo identity, restrained motion, consistent icons, and accessible responsive layouts.
- Never invent a historical/Sanskrit meaning or trademark claim for Ayatrisya.
- Never use fake performance claims, reviews, statistics, citations, downloads, or authenticated-account success.

## Gotchas

- Build commands need the artifact's `PORT` and `BASE_PATH`; managed workflows inject them for previews.
- Real local project coding requires a future desktop application. The browser preview must never claim arbitrary local-folder access.
- Illustrative content and deterministic demo responses must stay visibly labeled.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
