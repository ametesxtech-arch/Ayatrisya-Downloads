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

Native desktop CI must keep the runner-specific optional binaries for Rollup,
esbuild, lightningcss, and Tailwind's native engine in the pnpm lockfile. The
Replit development workspace was optimized for Linux x64, so its platform
overrides originally removed the Windows and macOS binaries.

**Why:** The first real native CI run passed Linux but failed on Windows and
macOS before electron-builder ran because Vite could not load the missing
platform bindings.

**How to apply:** When adding a native runner or changing pnpm overrides, confirm
its architecture's optional binaries remain in the lockfile and pass a frozen
install on that runner before debugging packaging.

Never create or deploy to a Firebase project without the user's explicit
approval.

**Why:** The user set this boundary for Ayatrisya.

**How to apply:** Get explicit approval before creating Firebase resources or
deploying to Firebase.

War Mode must remain independent of both hosted and desktop model APIs. Its
local Windows Defender and bundled scanner paths must not be gated on model
credentials, endpoint availability, or AI authentication; optional rule updates
are separate from offline scanning.

**Why:** The user explicitly requires desktop War Mode to keep working without
the model API.

**How to apply:** Keep scanning and local status checks on the desktop bridge;
do not add model API calls or cloud prerequisites to those operations.
