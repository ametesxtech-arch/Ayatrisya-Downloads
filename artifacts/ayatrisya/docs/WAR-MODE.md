# War Mode — Windows local-scan MVP

## Engine choice

The first implementation uses Microsoft Defender already installed by Windows.
Ayatrisya does not redistribute Defender binaries or signatures and does not
install, disable, or change any Windows security setting. This avoids silently
shipping a separate antivirus engine or redistributing signatures without a
verified license. It does **not** meet the original requirement to bundle an
engine and baseline signatures; that work remains open.

## Bundled-engine candidate review

ClamAV was reviewed as the leading candidate. Its current upstream release at the
time of review is 1.5.4 (2026-08-07). The upstream source includes `COPYING.txt`
with the GNU GPL version 2 license. The source README documents Windows MSI and
portable ZIP packages, including x64. The official GitHub release lists the
Windows x64 MSI at 224,457,050 bytes and ZIP at 225,774,978 bytes. Ayatrisya's
existing Windows installer is 111,298,546 bytes. Those are standalone release
assets, not a measured combined installer; including a scanner would
substantially increase download size, and the bundled signature size was not
measurable in this environment.

ClamAV documentation identifies FreshClam as the official signature updater and
says the database is typically updated once or twice daily. It documents private
mirrors for deployments and local database files for scanning. The official
documentation reviewed does not state clear permission to redistribute the
official CVD signature files inside a public/commercial installer. Direct
database requests from this environment returned HTTP 403, so the database
package size and redistribution terms could not be independently verified.
Therefore ClamAV is **not selected for bundling** until the signature
redistribution rights are confirmed. This is an unresolved permission/terms
question, not a claim that redistribution is prohibited.

Sources reviewed:

- [ClamAV source and license](https://github.com/Cisco-Talos/clamav/tree/clamav-1.5.4)
- [ClamAV official Windows package documentation](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/README.md)
- [ClamAV official CVD FAQ](https://github.com/Cisco-Talos/clamav-documentation/blob/main/src/faq/faq-cvd.md)
- [ClamAV official private-mirror guidance](https://github.com/Cisco-Talos/clamav-documentation/blob/main/src/appendix/CvdPrivateMirror.md)
- [ClamAV official signature database documentation](https://github.com/Cisco-Talos/clamav-documentation/blob/main/src/manual/Signatures.md)
- [ClamAV 1.5.4 Windows x64 release assets](https://github.com/Cisco-Talos/clamav/releases/tag/clamav-1.5.4)

The safest current option is to retain the existing Windows Defender integration.
For a bundled ClamAV option, first obtain clear redistribution permission for the
official signature databases or choose a signature set with explicit
redistribution terms. Do not substitute unsigned or unlicensed community rules
and call them complete antivirus protection.

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
