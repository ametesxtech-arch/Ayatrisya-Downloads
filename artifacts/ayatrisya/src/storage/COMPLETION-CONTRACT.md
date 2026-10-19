# Completion UI integration contract

Preserve the existing repository and component conventions. Main owns all
src/storage, src/ai, src/integrations, src/tests, scripts and package files.
UI worker owns pages/components/hooks/lib styling/public brand assets/index.html.
Methods below are being added now; do not create parallel storage.

## Additive persisted fields
- Conversation: pinned:boolean, archived:boolean (defaults false; old data migrated).
- Project: pinned:boolean, color:"violet"|"cyan"|"rose"|"amber"|"emerald",
  icon:"folder"|"code"|"book"|"music"|"orbit" (defaults false/violet/folder).
- Preferences: enterToSend:boolean=true, historySort:"newest"|"oldest"|"title"="newest",
  historyPinnedFirst:boolean=true, animationIntensity:"full"|"subtle"|"none"="full",
  logoIdle:boolean=false, projectView:"grid"|"list"="grid".
- Existing preferences and all data are preserved. Backup exports version2;
  prior version1 imports remain supported.

## Repository methods (all async, throw on errors, notify after commit)
- listConversations({...ListOptions,archived?:boolean,pinned?:boolean,
  sort?:"newest"|"oldest"|"title",pinnedFirst?:boolean}): Conversation[].
  Default excludes archived, newest first, pinned first.
- updateConversation(id, {title?,pinned?,archived?}): Promise<void>.
- deleteConversations(ids:string[]): Promise<void> (atomic; deletes associated
  messages/attachment blobs/library file items). Existing deleteConversation works.
- clearConversation(id): Promise<void> (keeps conversation; removes messages/files).
- deleteMessage(id): Promise<void> (files remain in library; no fabricated outputs).
- duplicateConversation(id): Promise<Conversation> (copies messages/files/new IDs).
- duplicateProject(id): Promise<Project> (copies metadata/items/files with new IDs).
- deleteProject(id, policy:"delete"|"retain"="delete"): Promise<void>.
  retain detaches all contained items/files into Library. UI MUST ask this choice.
- createProject/updateProject accept pinned/color/icon alongside existing fields.
- duplicateItem(id, projectId?:string|null): Promise<ProjectItem>.
- moveItem(id, projectId:string|null): Promise<void> (updates attached file metadata).
- updateTextFile(itemId, content:string): Promise<void> (safe text extensions only,
  actual blob bytes/metadata/size updated, never executes code).
- searchAll(query, {types?:string[],limit?:number}={}): SearchResult[].
  SearchResult {id,title,snippet,updatedAt,type,href,resource:"conversation"|"project"|"item"}.
  types: conversation,project,note,document,presentation,file,task,code.
  href for item: /workspace/documents/id for document; /workspace/library?item=id
  otherwise. Library must open this item via query param.

## Real export helpers from storage/backup.ts
- exportConversation(id, repo?): Promise<Blob> -- portable subset backup with actual files.
- exportProject(id, repo?): Promise<Blob> -- portable project+items/files backup.
- exportBackup/inspectBackup/restoreBackup/downloadBlob remain unchanged.

## Drive boundary additions
- driveSync.syncItem(itemId): Promise<void> -- explicit manual user-authorized
  upload, queued with checksums/metadata. No automatic first-connect upload.
- driveSync.downloadItem(itemId): Promise<Blob> -- real API download for an
  already backed-up item, not a silent local overwrite.
- driveSync.itemStatus(itemId): Promise<{remoteId?:string,lastSuccessAt?:string,
  state:"local"|"pending"|"failed"|"conflict"|"synced",error?:string}>.
- Existing whole-workspace backup and setup status remain.
- Item upload conflicts must be shown and never silently overwritten.

## Verification
Do not claim live Firebase/Drive tests without configuration. No third-party AI.
Do not replace real content with sample records. Native app creation is not needed:
this remains the existing responsive web app.
