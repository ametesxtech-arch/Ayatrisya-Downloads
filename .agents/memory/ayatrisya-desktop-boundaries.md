---
name: Ayatrisya desktop boundaries
description: Desktop-only local folder and command access, user consent, and deferred sync/platform scope.
---

Ayatrisya is both a browser product and a desktop app. Keep browser access limited to browser-managed storage; never expose the host filesystem or shell to the web renderer. On desktop, local operations stay behind the sandboxed, context-isolated Electron bridge. Folder access starts with the operating-system chooser. Each command is separately confirmed and runs with the user's operating-system permissions; it is not a sandboxed shell or a persistent interactive terminal.

The existing Google Drive backup covers Ayatrisya workspace records, not contents of selected operating-system folders. Folder sync must be explicitly opt-in and clearly scoped before any local project data is uploaded.

**Why:** The user requested a cross-platform desktop app alongside the existing web app, user-authorized local folders, a permission-controlled terminal, optional user-controlled Drive sync, and no unrestricted renderer access. The initial terminal scope is one confirmed command at a time; persistent terminal sessions and selected-folder Drive sync were not delivered.

Native installers need native operating-system runners. In the Replit Linux environment, the Linux AppImage builds, but Wine fails during the NSIS uninstaller-extraction stage; any partial Windows output is not distributable. A macOS DMG must be built on macOS.

**Why:** Replit's Linux host cannot run the Windows NSIS packaging step reliably and does not provide Apple's macOS packaging tools.

**How to apply:** Preserve the browser/desktop capability boundary. Never silently broaden folder access or sync scope. Use native Windows and macOS runners before calling those installers complete or tested; keep signing, notarization, and public hosting status explicit.
