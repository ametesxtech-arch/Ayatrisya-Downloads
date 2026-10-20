---
name: Ayatrisya desktop boundaries
description: Desktop-only local folder and command access, user consent, and deferred sync/platform scope.
---

Ayatrisya is both a browser product and a desktop app. Keep browser access limited to browser-managed storage; never expose the host filesystem or shell to the web renderer. On desktop, local operations stay behind the sandboxed, context-isolated Electron bridge. Folder access starts with the operating-system chooser. Each command is separately confirmed and runs with the user's operating-system permissions; it is not a sandboxed shell or a persistent interactive terminal.

The existing Google Drive backup covers Ayatrisya workspace records, not contents of selected operating-system folders. Folder sync must be explicitly opt-in and clearly scoped before any local project data is uploaded.

**Why:** The user requested a cross-platform desktop app alongside the existing web app, user-authorized local folders, a permission-controlled terminal, optional user-controlled Drive sync, and no unrestricted renderer access. The initial terminal scope is one confirmed command at a time; persistent terminal sessions and selected-folder Drive sync were not delivered.

**How to apply:** Preserve the browser/desktop capability boundary. Never silently broaden folder access or sync scope. Treat Windows and macOS installers as unverified until built and tested on their target platforms; the Linux AppImage was the only package built and smoke-tested in this environment.
