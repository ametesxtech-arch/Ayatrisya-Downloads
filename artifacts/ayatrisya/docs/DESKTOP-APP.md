# Ayatrisya desktop app

Ayatrisya uses Electron around the existing React/TypeScript application. The
website continues to run as a normal browser app and has no access to local
folders or shell commands. The desktop renderer receives a narrow
`window.ayatrisyaDesktop` API through a context-isolated, sandboxed preload.

## Development

Requirements: Node.js 24, pnpm, and a graphical desktop session with Electron's
Linux/macOS/Windows runtime libraries.

```sh
pnpm --filter @workspace/ayatrisya run desktop:dev
```

This starts a loopback-only Vite server and launches Electron against it. The
packaged app uses a local HTTP server bound to `localhost`; its port is stored
in Electron's user-data directory and reused so browser-local data is not
silently split across app launches. If that port is already occupied, startup
fails explicitly rather than changing the app's storage origin.

## Local project access

Use **Add local folder** in Projects and choose a directory in the system
folder picker. Ayatrisya stores the grant locally and reads/writes only paths
relative to that folder. The built-in editor handles text files up to 1 MB.
Removing a grant does not remove the directory or its files.

The command runner executes one command at a time in the chosen project root.
Before launch, an OS confirmation shows the exact command and directory.
Commands stop after 60 seconds and output is capped at 128 KB. This is not an
interactive shell/PTY. Do not paste commands you do not understand.

## Build installers

Build outputs go to `generated-artifacts/ayatrisya-desktop/`.

### Linux

On Linux:

```sh
pnpm --filter @workspace/ayatrisya run desktop:package:linux
```

This builds a portable AppImage. Linux runtime dependencies for Electron are
managed through the workspace's Nix environment. A Debian package is not
configured because this project has not supplied the maintainer and homepage
metadata electron-builder requires. Test the AppImage on target distributions
before release.

### Windows

Build on Windows with:

```powershell
pnpm --filter @workspace/ayatrisya run desktop:package:windows
```

This builds an x64 NSIS installer. A Windows-native build is the supported
release path. The attempted Linux cross-build failed while running the NSIS
installer under Wine to extract its uninstaller; do not distribute that partial
output. Code-signing credentials are not included; sign the installer before
broad distribution.

### macOS

Build on macOS with:

```sh
pnpm --filter @workspace/ayatrisya run desktop:package:mac
```

The script creates the `.icns` from the shared app icon using Apple's `sips`
and `iconutil`, then builds a universal `.dmg` for Intel and Apple Silicon.
Code signing and Apple notarization need the publisher's Apple Developer
credentials and must be completed before broad distribution.

### Native CI builds

`.github/workflows/desktop-installers.yml` builds Linux, Windows, and universal
macOS installers on their native GitHub-hosted runners. Run it manually with
`workflow_dispatch` or push a `desktop-v*` tag. The installers are uploaded as
workflow artifacts for 30 days; the workflow does not publish a public release.
The Windows job also silently installs the NSIS package and confirms the
installed app remains running for ten seconds. This is a startup smoke check,
not a full interactive application test.

For website downloads, configure HTTPS URLs for
`VITE_DESKTOP_DOWNLOAD_LINUX_URL`, `VITE_DESKTOP_DOWNLOAD_WINDOWS_URL`, and
`VITE_DESKTOP_DOWNLOAD_MAC_URL`. `VITE_DESKTOP_DOWNLOAD_URL` can point to a
general release page. Unsigned Windows and macOS installers may show operating
system security warnings.

## Authentication and Drive

For desktop sign-in, add `localhost` to Firebase Authentication's authorized
domains. Email/password remains network-dependent; Google and GitHub use
isolated OAuth popups. The desktop OAuth popup allowlist is intentionally
limited to the default Firebase Auth domains (`firebaseapp.com` and
`web.app`) plus Google/GitHub provider pages.

Google Drive stays optional and user-controlled. The current Drive backup is
for Ayatrisya workspace records; it does not upload or mirror the contents of
selected operating-system project folders.

## Checks

```sh
pnpm --filter @workspace/ayatrisya run test:desktop:security
pnpm --filter @workspace/ayatrisya run typecheck
pnpm --filter @workspace/ayatrisya run lint
```

The security tests cover path traversal, symlink escapes, and command-input
validation. They do not replace testing the Electron app on each target OS.
