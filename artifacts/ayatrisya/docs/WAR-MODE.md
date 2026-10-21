# War Mode — Windows local-scan MVP

## Engine choice

The first implementation uses Microsoft Defender already installed by Windows.
Ayatrisya does not redistribute Defender binaries or signatures and does not
install, disable, or change any Windows security setting. This avoids silently
shipping a separate antivirus engine or redistributing signatures without a
verified license. It does **not** meet the original requirement to bundle an
engine and baseline signatures; that work remains open.

## How it works

- Available only in Ayatrisya Desktop on Windows.
- Reads `Get-MpComputerStatus` through a fixed, encoded PowerShell command.
- Reports `READY` only when Defender, its scan executable, and a local signature
  version are present. It displays the signature version and last update time.
- The user selects a local folder in the native folder picker and confirms a
  native confirmation dialog. The folder path stays in the Electron main process
  and is passed to `MpCmdRun.exe` as one argument; the renderer cannot provide a
  command or an arbitrary path.
- The scan runs with the user's existing Windows permissions. Defender applies
  its own existing response and quarantine settings. Ayatrisya does not delete
  or quarantine files.
- The app records only scan timestamps, the selected folder's display name,
  outcome, and exit code in a local JSONL log under the app's user data folder.
- Windows Security is the source for threat details, Protection history, and
  restore actions.

Ayatrisya itself makes no network request during a scan. If the device is
offline, scanning can use only signatures already installed on Windows; the app
does not update them. Defender's own cloud settings are left unchanged.

## Honest limitations

The current interface does not receive authoritative per-file totals, skipped
or inaccessible file counts, or a reliable per-scan threat list from Defender.
It therefore uses indeterminate activity, never reports a percent or a “clean”
result, and directs users to Windows Security. It does not implement app-owned
quarantine/restore, scan cancellation, scheduled scans, folder monitoring,
archive-specific reporting, kernel drivers, or real-time protection.

The Windows command timeout stops Ayatrisya waiting; it is not a verified
guarantee that the Defender service stops its scan. A timed-out scan is reported
as incomplete and must be checked in Windows Security.

## Verification boundary

Unit tests on Linux verify PowerShell command construction, local-only Windows
path checks, status parsing, and fail-closed behavior. The actual scanner only
runs on Windows. Before claiming support, test a clean Windows 10/11 install,
offline operation with the displayed signature version, a harmless EICAR test
file, permission failures, and the actual Protection History/restore flow.
