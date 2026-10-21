# War Mode — Windows local-scan MVP

## Engine choice

The first implementation uses Microsoft Defender already installed by Windows.
Ayatrisya does not redistribute Defender binaries or signatures and does not
install, disable, or change any Windows security setting. This avoids silently
shipping a separate antivirus engine. The Ayatrisya app still uses Defender
only; the alternative below is a verified bundling candidate, not an integrated
scanner.

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

ClamAV is not selected because the CVD redistribution terms could not be
verified. The existing Windows Defender integration remains intact. The
alternative below has explicit redistribution terms for a curated ruleset, but
is not yet bundled or integrated.

## Alternative candidate with explicit redistribution terms

YARA-X plus a curated snapshot of Neo23x0's Signature-Base is a viable candidate
for a redistributable offline baseline. It has **not** been integrated into the
app or Windows installer.

### Engine license and Windows package

- YARA-X v1.22.0 is licensed under BSD-3-Clause. The license permits source and
  binary redistribution if the copyright notice, conditions, and disclaimer are
  retained in the documentation/materials.
- The official Windows x64 release asset is
  `yara-x-v1.22.0-x86_64-pc-windows-msvc.zip` (9,081,400 bytes). Its published
  SHA-256, `eac36a58699b94d3732a7fe1d8453fe89e0077bb18ac2c99b4c2ee102a431f2e`,
  matched the downloaded asset. The ZIP contains a single `yr.exe`
  (26,424,320 bytes). Static PE inspection found Windows system-library imports;
  the executable was not run on Windows, so runtime compatibility and any
  environment-specific requirements remain unverified.

### Signature license and baseline size

- The official [Signature-Base repository](https://github.com/Neo23x0/signature-base)
  README states that its signatures and IOC files use the custom Detection Rule
  License (DRL) 1.1 except YARA rules that explicitly name another license.
  DRL 1.1 expressly permits use, copying, modification, distribution,
  sublicensing, and selling copies. It requires retaining rule-author
  attribution where supplied, the source URI, and the license; attribution
  supplied by a rule must also be retained in match messages.
- Do **not** use the repository's old `v2.0` release: its README identifies that
  release as the final one under the older CC-BY-NC terms. The reviewed snapshot
  is commit
  `3ce6640c26046da8e6d8094af3eaaee3ee84e648` (2026-10-17), after the license
  switch.
- A conservative baseline contains 711 `.yar` files. It excludes 29 files with
  explicit license metadata other than the root DRL license and 13 files listed
  by the repository as requiring LOKI/THOR external variables (one file
  overlaps, so 41 files are excluded in total). The selected rule source is
  5,194,627 bytes; a ZIP with those rules and the DRL license is 1,409,807
  bytes. Any distributable bundle must also preserve the source URL, snapshot
  commit, full license, and rule-author metadata.
- The repository is actively updated, but it does not provide a current signed
  signature-feed release. Future updates would need to come from this official
  repository at a pinned commit and repeat the per-rule license and external
  variable filtering. No updater is implemented.

### Candidate validation and limits

- The official YARA-X Linux x64 release was downloaded for local validation;
  its GitHub-published SHA-256 matched, and it reported version 1.22.0.
- YARA-X compiled all 711 selected rule files with no errors into a
  4,961,790-byte database. A non-suppressed compile emitted 199 nonfatal
  warnings, including duplicate patterns, deprecated PE fields, and
  text-as-hex suggestions.
- An offline scan of the harmless 68-byte EICAR test file matched the
  repository's `SUSP_Just_EICAR` rule. A small benign text control produced no
  matches. This is a Linux engine/rules smoke test, not a Windows test or a
  false-positive-rate evaluation. The EICAR rule has score 40 and is a test
  signature; it must not trigger quarantine.
- The Windows executable archive plus compiled rules represent about 31.4 MB
  of uncompressed files before notices and installer compression. Ayatrisya's
  current installer is 111,298,546 bytes; a rebuilt installer's actual size has
  not been measured.
- No Windows installer, offline Windows scan, Windows EICAR run, update flow,
  quarantine, restore, or permission-failure path has been tested. The rule
  scores do not yet establish a validated high-confidence auto-quarantine
  threshold. Defender remains unchanged and is still the only scanner wired
  into Ayatrisya.

Sources:

- [YARA-X v1.22.0 source and BSD-3-Clause license](https://github.com/VirusTotal/yara-x/tree/v1.22.0)
- [YARA-X v1.22.0 Windows and Linux release assets](https://github.com/VirusTotal/yara-x/releases/tag/v1.22.0)
- [Signature-Base reviewed snapshot](https://github.com/Neo23x0/signature-base/tree/3ce6640c26046da8e6d8094af3eaaee3ee84e648)
- [Signature-Base license at that snapshot](https://github.com/Neo23x0/signature-base/blob/3ce6640c26046da8e6d8094af3eaaee3ee84e648/LICENSE)
- [Signature-Base README and license/external-variable policy](https://github.com/Neo23x0/signature-base/blob/3ce6640c26046da8e6d8094af3eaaee3ee84e648/README.md)
- [Signature-Base external-variable rules](https://github.com/Neo23x0/signature-base/blob/3ce6640c26046da8e6d8094af3eaaee3ee84e648/yara/external-variable-rules.txt)

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
