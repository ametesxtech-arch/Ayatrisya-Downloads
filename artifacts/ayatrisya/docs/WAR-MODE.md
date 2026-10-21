# WAR MODE — Windows local rule scanner

## Selected engine and rule licenses

Ayatrisya bundles **YARA-X v1.22.0** with the reviewed 711-file snapshot from
Neo23x0's Signature-Base. Those source files contain **4,886 rule
declarations**; the 711 count refers to source files, not individual rules.

- YARA-X is licensed under BSD-3-Clause. Its official Windows x64 release ZIP is
  9,081,400 bytes and contains `yr.exe` (26,424,320 bytes). The ZIP SHA-256 is
  `eac36a58699b94d3732a7fe1d8453fe89e0077bb18ac2c99b4c2ee102a431f2e`; the
  executable SHA-256 is
  `e2e431175174158fc74c8709896c6d4a6667592bbb65a8132dea624ba125d76f`.
- The rule snapshot is commit
  `3ce6640c26046da8e6d8094af3eaaee3ee84e648` (2026-10-17). GitHub reports its
  commit signature as valid. The full source archive is checked against the
  signed Git tree's blob hashes before packaging.
- Signature-Base's root license is the custom Detection Rule License (DRL) 1.1.
  Its README says YARA files that specify another license are excluded from the
  default grant. Ayatrisya excludes 29 rules with a different explicit
  `license` value and 13 files requiring LOKI/THOR external variables (one
  overlap), leaving 711 of 752 source files. Those files contain 4,886 rule
  declarations and total 5,194,627 bytes. Rule metadata and source files are
  preserved.
- DRL 1.1 permits copying and redistribution when its conditions are met. It
  requires author attribution in messages based on rule matches. Ayatrisya uses
  YARA-X's `--print-meta` output and shows the rule's supplied author in the
  review UI and native quarantine confirmation. The complete DRL license,
  YARA-X license, and notices ship beside the rules.
- The generated Windows resource set is about 31.6 MB uncompressed, before
  installer compression. The final Windows installer size is measured by the
  native CI build and must be recorded from that run; Linux package sizes are
  not a substitute.

ClamAV was also reviewed. Its GPLv2 engine and Windows packages are available,
but the reviewed official documentation did not establish redistribution terms
for its CVD signature database. It was not selected; no ClamAV permission is
assumed.

## Runtime behavior

- YARA-X is available only in Ayatrisya Desktop on Windows. Microsoft Defender
  remains a separate, unchanged integration; YARA-X is **not** a full antivirus
  replacement.
- The Windows installer includes the pinned YARA-X executable, all 711
  license-cleared source files containing 4,886 rule declarations, notices,
  and an integrity manifest. At first
  launch, Ayatrisya validates the manifest, executable, licenses, and every
  rule hash, then compiles the baseline into local app data. `READY` appears
  only after successful validation and compilation. No network request is
  needed for startup or baseline scanning.
- The UI asks the user to choose a local folder using the native picker and
  confirms before scanning. Paths and process execution remain in Electron's
  main process; the renderer cannot provide arbitrary scan paths or commands.
- Scanning is local and reports scanned, detected, skipped, inaccessible, and
  failed counts. It avoids symbolic links and junctions; limits scanning to
  10,000 file paths, 100,000 directory entries, and two hours; skips individual
  files over 1 GiB; and limits each scanner process to 60 seconds and 50% CPU.
  Details are bounded in the UI and indicate when they are truncated. A skip,
  access failure, scanner error, or time limit is never reported as clean.
- Progress and cancellation are supported. Files not scanned after a
  cancellation are counted as skipped.
- A rule match is an indicator, not a confirmed malware verdict. Every match
  requires review; no rule match triggers automatic quarantine. After another
  native confirmation, Ayatrisya renames the file into a restricted
  `.ayatrisya-quarantine` directory on the same volume, preserving the original
  file rather than deleting it. A local index and audit log retain the original
  path, metadata, rule, and supplied author. Restore is supported and refuses
  to overwrite an existing file. Windows, Defender, Ayatrisya, and scanner
  installation paths are protected from quarantine.
- Updates are manual and require internet access. Ayatrisya fetches only from
  the official GitHub repository, requires GitHub's valid-signature result,
  verifies source blobs against the signed tree, re-applies the same license
  and external-variable filtering, compiles to a staging directory, and asks
  for approval before switching the active rules. Failed or declined updates
  leave the current rules active. Offline scanning continues with the installed
  baseline or last-known-good update.
- Defender's status and scan command are presented separately. Defender may
  take actions according to its own settings; its result details and restore
  actions remain in Windows Security.

## Limitations

This is an on-demand YARA-X rule scanner, not real-time, scheduled, kernel-level,
or complete malware protection. No false-positive rate has been established.
Some files may be skipped or inaccessible, and matching rules can be
inaccurate. Ayatrisya does not upload file contents or scan results. If a safe
same-volume move or quarantine ACL cannot be established, the original file is
left where it is.

## Verification and evidence

Local checks performed in this workspace:

- Signature baseline extraction and integrity checks matched 711 selected
  files containing 4,886 rule declarations, 29 license exclusions, 13
  external-variable exclusions, one overlap, and 5,194,627 source bytes.
- YARA-X 1.22.0 on Linux compiled the 4,886-rule set. An offline scan detected
  the harmless EICAR test file with `SUSP_Just_EICAR` and returned no matches
  for the benign control. This is not Windows evidence.
- ZIP traversal/duplicate-path checks, desktop security tests, and TypeScript
  type checking are run locally.

The Windows installer workflow now installs and launches the packaged app,
then runs its packaged YARA-X integration suite using a temporary app profile.
That suite checks offline startup, the EICAR detection rule and benign control,
progress/cancellation, recoverable quarantine and restore, failed-update
retention, a Windows ACL permission denial, and uninstall. It writes a JSON
test report. **Do not claim the Windows integration passed until that native
runner report is available.**

## Sources

- [YARA-X v1.22.0 source and BSD-3-Clause license](https://github.com/VirusTotal/yara-x/tree/v1.22.0)
- [YARA-X v1.22.0 releases](https://github.com/VirusTotal/yara-x/releases/tag/v1.22.0)
- [Signature-Base reviewed commit](https://github.com/Neo23x0/signature-base/tree/3ce6640c26046da8e6d8094af3eaaee3ee84e648)
- [DRL 1.1 at the reviewed commit](https://github.com/Neo23x0/signature-base/blob/3ce6640c26046da8e6d8094af3eaaee3ee84e648/LICENSE)
- [Signature-Base README and filtering policy](https://github.com/Neo23x0/signature-base/blob/3ce6640c26046da8e6d8094af3eaaee3ee84e648/README.md)
- [External-variable rules list](https://github.com/Neo23x0/signature-base/blob/3ce6640c26046da8e6d8094af3eaaee3ee84e648/yara/external-variable-rules.txt)
