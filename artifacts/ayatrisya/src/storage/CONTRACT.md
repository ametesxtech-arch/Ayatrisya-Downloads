# Local application contract

Main-agent-owned: `src/storage`, `src/ai`, `src/integrations`, `src/tests`.
UI-agent-owned: existing pages/components, app providers/router and CSS.
All private content stays in IndexedDB. No application server/database is used.
These files are being implemented concurrently; import the exact interfaces below.

## React query hook

`import { useLocalQuery } from '@/storage/hooks'`

`useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = [])`
returns `{ data: T | undefined, loading: boolean, error: string | null, refresh: () => void }`.
It refreshes after repository mutations, owner changes and cross-tab changes.
Always render loading/error/empty states. Do not ignore rejected mutations.

## Repository

`import { repository } from '@/storage/repository'`

- `repository.ownerId` (default `"signed-out"`)
- `setOwner(ownerId: string): void` (auth provider calls with `firebase:${uid}`, or `"signed-out"` when no account is active)
- `getPreferences(): Promise<Preferences>`
- `savePreferences(patch: Partial<Preferences>): Promise<Preferences>`
- `listConversations(options?: ListOptions): Promise<Conversation[]>` newest first; limit default 30
- `getConversation(id: string): Promise<Conversation | undefined>`
- `createConversation(title?: string): Promise<Conversation>`
- `renameConversation(id, title): Promise<void>`
- `deleteConversation(id): Promise<void>` with cascade
- `getMessages(conversationId): Promise<Message[]>`
- `addMessage(conversationId, content, role?: 'user' | 'assistant', attachmentIds?: string[]): Promise<Message>`
- `editMessage(id, content): Promise<void>`
- `listProjects(options?: ListOptions & { archived?: boolean }): Promise<Project[]>`
- `getProject(id): Promise<Project | undefined>`
- `createProject({ title, description?, tags? }): Promise<Project>`
- `updateProject(id, patch: Partial<Pick<Project,'title'|'description'|'tags'|'archived'>>): Promise<void>`
- `deleteProject(id): Promise<void>` with cascade
- `listItems(options?: ItemOptions): Promise<ProjectItem[]>`
- `getItem(id): Promise<ProjectItem | undefined>`
- `saveItem(input: {id?: string; title: string; kind: ItemKind; content?: string; projectId?: string|null; tags?: string[]; completed?: boolean}): Promise<ProjectItem>`
- `deleteItem(id): Promise<void>`
- `addFile(file: File, projectId?: string|null, conversationId?: string|null): Promise<Attachment>` creates actual Blob and a library item
- `listAttachments(): Promise<Attachment[]>`
- `getFile(id): Promise<Blob | undefined>`
- `deleteAttachment(id): Promise<void>`
- `stats(): Promise<StorageStats>` navigator estimate is optional, never invented
- `requestPersistence(): Promise<boolean>` not a guarantee
- `clearLocalData(): Promise<void>` current owner only; UI MUST confirm first
- `copyGuestToCurrent(): Promise<number>` explicit copy, keeps guest originals, remaps IDs/references, no silent migration
- `subscribe(listener): () => void`

Types live in `@/storage/types`. Every record is owner-scoped and timestamped.

## Backups

`import { exportBackup, inspectBackup, restoreBackup, downloadBlob } from '@/storage/backup'`

- `exportBackup(): Promise<Blob>` JSON including blobs as separate assets
- `inspectBackup(text: string): {conversations:number; projects:number; items:number; attachments:number}`
- `restoreBackup(text: string, mode: 'merge'|'replace'): Promise<{imported:number; skipped:number}>`
- `downloadBlob(blob: Blob, filename: string): void`

Import file is JSON, max 100 MB. Merge preserves existing duplicate IDs; replace clears
only current owner's records, atomically. UI MUST confirm replace and clear.
Backups are not sync; downloaded backups contain private data, unencrypted.

## Authentication

`import { AuthProvider, useAuth } from '@/integrations/firebase/AuthProvider'`

Wrap App in AuthProvider.
`useAuth()` -> `{ user: {uid,email,displayName,emailVerified}|null, guest, loading, configured, error,
signIn(email,password), register(email,password), googleSignIn(), githubSignIn(), resetPassword(email),
sendVerification(), refreshUser(), signOut(), startGuest() }`.
Methods reject on failure. Never display successful authentication if configured=false.
Guest access is browser-local and limited to chat plus the image-generation page; other workspace and onboarding
routes require an authenticated account. Guest records use the `"guest"` owner and are never auto-uploaded or
auto-migrated; the explicit `copyGuestToCurrent` option can preserve them after sign-in. Missing Firebase config
still permits guest access but blocks account sign-in. The guest image allowance is two generations; image
generation is unavailable until a compatible model endpoint is connected.

## Model connection

`import { modelClient } from '@/ai/client'`

- `getModelCapabilities(): Promise<ModelCapability[]>` with `{id,label,available,reason,streaming,attachments,modalities:string[]}`
- `getConnectionHealth(): Promise<{configured:boolean;connected:boolean;message:string}>`
- `generateResponse(messages: Array<{role:'user'|'assistant';content:string}>, {model,mode,onToken?,signal?}): Promise<string>`
- `cancelGeneration(): void`
- `transcribeAudio(blob, {signal?}): Promise<string>`
- `synthesizeSpeech(text, {signal?}): Promise<Blob>`

No endpoint is configured now; capabilities are unavailable, no fake replies.
Save the user's message locally even when inference unavailable; clearly show not sent.
Ask for explicit consent before sending to configured remote inference. Attachments
must not silently upload; transport currently supports text only.

## Drive

`import { driveSync } from '@/integrations/google-drive/sync'`

- `status(): Promise<{configured:boolean;connected:boolean;paused:boolean;pending:number;lastSuccess:string|null;conflicts:number;message:string}>`
- `connect(): Promise<void>` actual per-user GIS OAuth drive.file; must be user initiated
- `disconnect(): void`
- `syncNow(): Promise<void>` explicit user action; saves a browser backup into user Drive
- `pause(): void`, `resume(): void`
- `downloadRemote(): Promise<string>` returns remote JSON; UI previews and asks merge/replace before restore
- `resolveConflict('local'|'remote'): Promise<string|void>` explicit choice

No OAuth client configured now; connect must report unavailable. Do not use the Replit
owner's Drive connector to upload other app users' content. Clearly label this as manual
Drive backup/restore with guarded conflict detection, not full continuous item sync.

## Desktop

`import.meta.env.VITE_DESKTOP_DOWNLOAD_URL` optional HTTPS release URL.
No supplied URL means coming soon, never a fake link.
