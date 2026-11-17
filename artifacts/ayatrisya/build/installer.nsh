!macro customInit
  ; Preflight Check 1: Test write permissions and disk space in $TEMP
  ClearErrors
  FileOpen $R0 "$TEMP\ayatrisya_perm_test.tmp" w
  ${If} ${Errors}
    ${IfNot} ${Silent}
      MessageBox MB_ICONSTOP "Ayatrisya Setup: Cannot Write to Temporary Directory$\r$\n$\r$\nTemporary folder: $TEMP$\r$\n$\r$\nThe installer cannot write files to the temporary directory. This is typically caused by insufficient disk space (disk full) or directory permissions.$\r$\n$\r$\nTo fix this:$\r$\n1. Free up disk space on the system drive.$\r$\n2. Or redirect your temporary folder to a drive with available space:$\r$\n   set TEMP=D:\Temp$\r$\n   set TMP=D:\Temp$\r$\n3. Rerun Ayatrisya Setup."
    ${EndIf}
    Abort
  ${Else}
    FileClose $R0
    Delete "$TEMP\ayatrisya_perm_test.tmp"
  ${EndIf}

  ; Preflight Check 2: Check available disk space on temporary drive
  System::Call 'kernel32::GetDiskFreeSpaceExW(w "$TEMP", *l .r0, *l .r1, *l .r2) i .r3'
  ${If} $3 != 0
    System::Int64Op $0 / 1048576
    Pop $R1
    ${If} $R1 < 500
      ${IfNot} ${Silent}
        MessageBox MB_ICONEXCLAMATION "Ayatrisya Setup: Low Disk Space on Temporary Drive$\r$\n$\r$\nTemporary folder: $TEMP$\r$\nAvailable space: $R1 MB$\r$\nRecommended space: at least 500 MB$\r$\n$\r$\nThe installer requires temporary disk space to unpack installation components. If extraction fails with a file write error, please free up space or set TEMP to a drive with more storage (e.g. D:\Temp)."
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; Preflight Check 3: Check available disk space on destination drive ($INSTDIR)
  System::Call 'kernel32::GetDiskFreeSpaceExW(w "$INSTDIR", *l .r0, *l .r1, *l .r2) i .r3'
  ${If} $3 != 0
    System::Int64Op $0 / 1048576
    Pop $R2
    ${If} $R2 < 1000
      ${IfNot} ${Silent}
        MessageBox MB_ICONEXCLAMATION "Ayatrisya Setup: Low Disk Space on Target Drive$\r$\n$\r$\nInstallation path: $INSTDIR$\r$\nAvailable space: $R2 MB$\r$\nRequired space: ~1000 MB$\r$\n$\r$\nPlease select a destination folder on a drive with sufficient free space during setup."
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
