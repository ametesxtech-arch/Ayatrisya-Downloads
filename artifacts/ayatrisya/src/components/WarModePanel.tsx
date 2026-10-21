import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  CloudDownload,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/Primitives';
import { errMsg } from '@/lib/format';
import type {
  WarModeAuditEntry,
  WarModeQuarantineItem,
  WarModeRuleUpdatePreview,
  WarModeStatus,
  WarModeYaraAuditEntry,
  WarModeYaraProgress,
  WarModeYaraScanResult,
} from '@/desktop/contracts';

function stateTone(state: WarModeStatus['state']) {
  if (state === 'READY') return 'border-emerald-300/20 bg-emerald-300/[.06] text-emerald-200';
  if (state === 'STARTING' || state === 'SCANNING') return 'border-violet-300/20 bg-violet-300/[.06] text-violet-200';
  if (state === 'OFFLINE') return 'border-slate-300/15 bg-white/[.03] text-slate-300';
  return 'border-amber-300/20 bg-amber-300/[.05] text-amber-200';
}

function dateLabel(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
}

function auditLabel(entry: WarModeAuditEntry) {
  const suffix = entry.exitCode === null ? '' : ` · exit ${entry.exitCode}`;
  const labels = {
    started: 'Defender scan started',
    completed: 'Defender command completed',
    failed: 'Defender scan failed',
    'timed-out': 'Defender scan timed out',
  } as const;
  return `${labels[entry.result]}${suffix}`;
}

function yaraAuditLabel(entry: WarModeYaraAuditEntry) {
  switch (entry.action) {
    case 'scan':
      return `YARA-X scan · ${entry.counts?.scanned ?? 0} scanned, ${entry.counts?.detected ?? 0} detected, ${entry.counts?.skipped ?? 0} skipped, ${entry.counts?.inaccessible ?? 0} inaccessible, ${entry.counts?.failed ?? 0} failed`;
    case 'quarantined':
      return `Moved to quarantine · ${entry.originalPath ?? entry.id ?? 'file'}`;
    case 'restored':
      return `Restored · ${entry.originalPath ?? entry.id ?? 'file'}`;
    case 'rules-updated':
      return `Rules updated · ${entry.fromVersion?.slice(0, 12) ?? 'unknown'} → ${entry.toVersion?.slice(0, 12) ?? 'unknown'}`;
    case 'rules-update-failed':
      return `Rule update failed · ${entry.reason ?? 'last known-good rules kept'}`;
    default:
      return `YARA-X activity · ${entry.action}`;
  }
}

export function WarModePanel() {
  const desktop = typeof window !== 'undefined' ? window.ayatrisyaDesktop : undefined;
  const [status, setStatus] = useState<WarModeStatus>({
    state: desktop ? 'STARTING' : 'OFFLINE',
    canScan: false,
    engine: null,
    signatureVersion: null,
    ruleCount: null,
    ruleFileCount: null,
    signatureUpdatedAt: null,
    realTimeProtectionEnabled: false,
    message: desktop ? 'Checking the bundled local scanner…' : 'Local scanning requires Ayatrisya Desktop on Windows.',
    defender: {
      state: 'OFFLINE',
      canScan: false,
      signatureVersion: null,
      signatureUpdatedAt: null,
      realTimeProtectionEnabled: false,
      message: 'Microsoft Defender integration is available only on Windows.',
    },
  });
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [progress, setProgress] = useState<WarModeYaraProgress | null>(null);
  const [scanResult, setScanResult] = useState<WarModeYaraScanResult | null>(null);
  const [quarantine, setQuarantine] = useState<WarModeQuarantineItem[]>([]);
  const [defenderAudit, setDefenderAudit] = useState<WarModeAuditEntry[]>([]);
  const [yaraAudit, setYaraAudit] = useState<WarModeYaraAuditEntry[]>([]);
  const [busy, setBusy] = useState<'status' | 'folder' | 'scan' | 'defender' | 'update' | 'quarantine' | 'restore' | ''>('');
  const [error, setError] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [defenderMessage, setDefenderMessage] = useState('');
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  const refreshStatus = useCallback(async () => {
    if (!desktop) return;
    setBusy('status');
    setStatus((previous) => ({ ...previous, state: 'STARTING', message: 'Checking YARA-X, the bundled rules, and Windows Defender…' }));
    setError('');
    try {
      setStatus(await desktop.getWarModeStatus());
    } catch (cause) {
      setStatus((previous) => ({
        ...previous,
        state: 'ERROR',
        canScan: false,
        message: 'The local rule-based scanner status could not be checked.',
      }));
      setError(errMsg(cause));
    } finally {
      setBusy('');
    }
  }, [desktop]);

  const refreshActivity = useCallback(async () => {
    if (!desktop) return;
    try {
      const [defender, yara] = await Promise.all([
        desktop.getWarModeAuditLog(),
        desktop.getWarModeYaraAuditLog(),
      ]);
      setDefenderAudit(defender);
      setYaraAudit(yara);
    } catch (cause) {
      setError(errMsg(cause));
    }
  }, [desktop]);

  const refreshQuarantine = useCallback(async () => {
    if (!desktop) return;
    try {
      setQuarantine(await desktop.getWarModeQuarantine());
    } catch (cause) {
      setError(errMsg(cause));
    }
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    void refreshStatus();
    void refreshActivity();
    void refreshQuarantine();
    const unsubscribe = desktop.onWarModeYaraProgress(setProgress);
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [desktop, refreshActivity, refreshQuarantine, refreshStatus]);

  async function chooseFolder() {
    if (!desktop) return;
    setBusy('folder');
    setError('');
    setScanMessage('');
    try {
      setFolder(await desktop.chooseWarModeFolder());
      setScanResult(null);
      setProgress(null);
    } catch (cause) {
      setError(errMsg(cause));
    } finally {
      setBusy('');
    }
  }

  async function startYaraScan() {
    if (!desktop || !folder || !status.canScan || busy) return;
    setBusy('scan');
    setStatus((previous) => ({ ...previous, state: 'SCANNING', message: `Starting local YARA-X scan of ${folder.name}…` }));
    setScanMessage('');
    setError('');
    setScanResult(null);
    setProgress(null);
    try {
      const result = await desktop.scanWarModeYaraFolder(folder.id);
      if ('counts' in result) {
        setScanResult(result);
        setScanMessage(result.message);
      } else {
        setScanMessage('Scan cancelled before it started.');
      }
      setFolder(null);
      await refreshStatus();
      await refreshActivity();
      await refreshQuarantine();
    } catch (cause) {
      setFolder(null);
      setError(errMsg(cause));
      await refreshStatus();
      await refreshActivity();
    } finally {
      setProgress(null);
      setBusy('');
    }
  }

  async function cancelYaraScan() {
    if (!desktop || !progress?.scanId) return;
    try {
      await desktop.cancelWarModeYaraScan(progress.scanId);
    } catch (cause) {
      setError(errMsg(cause));
    }
  }

  async function startDefenderScan() {
    if (!desktop || !folder || !status.defender.canScan || busy) return;
    setBusy('defender');
    setDefenderMessage('');
    setError('');
    try {
      const result = await desktop.scanWarModeFolder(folder.id);
      setDefenderMessage(result.message ?? 'Windows Defender returned no result.');
      if (!result.cancelled) setFolder(null);
      await refreshStatus();
      await refreshActivity();
    } catch (cause) {
      setError(errMsg(cause));
      setFolder(null);
      await refreshActivity();
    } finally {
      setBusy('');
    }
  }

  async function quarantineFinding(findingId: string) {
    if (!desktop) return;
    setBusy('quarantine');
    setError('');
    try {
      const result = await desktop.quarantineWarModeFinding(findingId);
      if ('cancelled' in result && result.cancelled) return;
      setScanResult((previous) => previous
        ? { ...previous, findings: previous.findings.filter((finding) => finding.id !== findingId) }
        : previous);
      await refreshQuarantine();
      await refreshActivity();
    } catch (cause) {
      setError(errMsg(cause));
    } finally {
      setBusy('');
    }
  }

  async function restoreItem(itemId: string) {
    if (!desktop) return;
    setBusy('restore');
    setError('');
    try {
      const result = await desktop.restoreWarModeQuarantine(itemId);
      if ('cancelled' in result && result.cancelled) return;
      await refreshQuarantine();
      await refreshActivity();
    } catch (cause) {
      setError(errMsg(cause));
    } finally {
      setBusy('');
    }
  }

  async function checkForRuleUpdates() {
    if (!desktop || busy) return;
    setBusy('update');
    setError('');
    setScanMessage('');
    try {
      const preview: WarModeRuleUpdatePreview = await desktop.prepareWarModeRuleUpdate();
      if (!preview.available || !preview.proposalId) {
        setScanMessage(preview.message ?? 'No rule update is available.');
        return;
      }
      const result = await desktop.applyWarModeRuleUpdate(preview.proposalId);
      if ('cancelled' in result) {
        setScanMessage('The current verified rules remain active.');
        return;
      }
      setStatus(result);
      setScanMessage('The reviewed, signed-source rule update is active.');
      await refreshActivity();
    } catch (cause) {
      setError(errMsg(cause));
      await refreshActivity();
    } finally {
      setBusy('');
    }
  }

  async function openSecurityHistory() {
    if (!desktop) return;
    try {
      await desktop.openWindowsSecurity();
    } catch (cause) {
      setError(errMsg(cause));
    }
  }

  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return <div className="space-y-5">
    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-violet-300" />
            <h2 className="text-sm font-semibold">WAR MODE · YARA-X rule-based scan</h2>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
            Local, on-demand scanning with a bundled YARA-X engine and reviewed rules. Scans run on this computer only.
            Rule matches are not proof of malware and require your review.
          </p>
        </div>
        {desktop && <Button variant="outline" onClick={() => void refreshStatus()} disabled={!!busy}>
          <RefreshCw size={14} />{busy === 'status' ? 'Checking…' : 'Check status'}
        </Button>}
      </div>

      <div className={`mt-4 rounded-lg border p-4 ${stateTone(status.state)}`} role="status" aria-live="polite" data-testid="war-mode-status">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {(status.state === 'STARTING' || status.state === 'SCANNING') ? <LoaderCircle size={15} className="animate-spin" /> : status.state === 'READY' ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
          <span>{status.state}</span>
        </div>
        <p className="mt-1.5 text-xs leading-5">{status.message}</p>
      </div>

      {status.engine && <dl className="mt-4 grid gap-3 rounded-lg border border-white/[.06] bg-black/10 p-4 text-xs sm:grid-cols-3">
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Local engine</dt><dd className="mt-1 text-slate-200">{status.engine}</dd></div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Verified rule set</dt>
          <dd className="mt-1 text-slate-200" title={status.signatureVersion ?? undefined}>
            {status.signatureVersion
              ? `${status.signatureVersion.slice(0, 12)} · ${status.ruleCount ?? '—'} rules in ${status.ruleFileCount ?? '—'} files`
              : 'Not available'}
          </dd>
        </div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Last successful update</dt><dd className="mt-1 text-slate-200">{dateLabel(status.signatureUpdatedAt)}</dd></div>
      </dl>}

      {!isOnline && desktop && <p className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-100/80">
        This device appears offline. The installed rules still work offline; checking for rule updates requires an internet connection.
      </p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {desktop ? <>
          <Button variant="outline" onClick={() => void chooseFolder()} disabled={!!busy || !status.canScan}>
            <FolderOpen size={14} />{busy === 'folder' ? 'Opening…' : 'Choose folder'}
          </Button>
          {folder && <span className="max-w-[300px] truncate text-xs text-slate-300" title={folder.name}>Selected: {folder.name}</span>}
          <Button onClick={() => void startYaraScan()} disabled={!folder || !status.canScan || !!busy}>
            <ShieldCheck size={14} />{busy === 'scan' ? 'Scanning…' : 'Start local scan'}
          </Button>
          {busy === 'scan' && <Button variant="outline" onClick={() => void cancelYaraScan()} disabled={!progress?.scanId}>
            <X size={14} />Cancel scan
          </Button>}
          <Button variant="outline" onClick={() => void checkForRuleUpdates()} disabled={!!busy || !status.canScan}>
            {busy === 'update' ? <LoaderCircle size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            {busy === 'update' ? 'Verifying update…' : 'Check for rule updates'}
          </Button>
        </> : <p className="text-xs text-slate-400">Open this page in Ayatrisya Desktop on Windows to scan local files.</p>}
      </div>

      {progress && busy === 'scan' && <div className="mt-4 rounded-lg border border-white/[.06] bg-black/10 p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-slate-200">Scanning {completed} of {total} files</span>
          <span className="text-slate-400">{percent}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-violet-400 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 truncate text-[11px] text-slate-500" title={progress.currentPath}>{progress.currentPath || 'Preparing file list…'}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {progress.counts.scanned} scanned · {progress.counts.detected} detected · {progress.counts.skipped} skipped · {progress.counts.inaccessible} inaccessible · {progress.counts.failed} failed
        </p>
      </div>}

      {scanResult && <div className="mt-4 rounded-lg border border-white/[.06] bg-black/10 p-4">
        <h3 className="text-xs font-semibold text-slate-200">Scan results · {scanResult.folderName}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
          {Object.entries(scanResult.counts).map(([label, value]) => <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-slate-200">{value}</dd>
          </div>)}
        </dl>
        {scanResult.counts.inaccessible > 0 && <p className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-100/80">
          Windows denied access to some items. Ayatrisya did not bypass permissions or count them as clean. Grant the current Windows account read access in the folder’s Security settings, or choose a folder it can access, then scan again.
        </p>}
        {scanResult.findings.length > 0 && <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-amber-200">Review required · no files were changed during scanning</p>
          {scanResult.findings.map((finding) => <div key={finding.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/10 bg-amber-200/[.03] p-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-100" title={finding.relativePath}>{finding.relativePath}</p>
              <p className="mt-1 break-words text-[11px] text-slate-400">Rule: {finding.rules.join(', ') || 'Unspecified'}</p>
              {finding.attribution.map((match) => <p key={`${match.rule}-${match.authors.join(',')}`} className="mt-1 break-words text-[11px] text-slate-500">
                Author: {match.authors.join(', ') || 'not supplied'}{match.source ? ` · ${match.source}` : ''}
              </p>)}
            </div>
            <Button variant="outline" onClick={() => void quarantineFinding(finding.id)} disabled={!!busy}>
              <ArchiveRestore size={14} />Review & quarantine
            </Button>
          </div>)}
          {scanResult.findingsTruncated && <p className="text-xs text-amber-200">More matches were detected than can be listed in one review. Counts include them; scan a smaller folder to review remaining paths.</p>}
        </div>}
        {scanResult.details.length > 0 && <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-400">
            Skipped, inaccessible, and failed item details ({scanResult.details.length}{scanResult.detailsTruncated ? '+' : ''})
          </summary>
          <ul className="mt-2 max-h-52 space-y-1 overflow-auto text-[11px] text-slate-500">
            {scanResult.details.map((detail, index) => <li key={`${detail.kind}-${detail.path}-${index}`}>
              <span className="text-slate-300">{detail.kind}</span> · {detail.path || 'folder'}{detail.reason ? ` · ${detail.reason}` : ''}
              {detail.attribution?.map((match) => <span key={`${match.rule}-${match.authors.join(',')}`} className="block pl-3 text-slate-600">
                {match.rule} · author: {match.authors.join(', ') || 'not supplied'}
              </span>)}
            </li>)}
          </ul>
        </details>}
      </div>}
      {scanMessage && <p className="mt-4 rounded-lg border border-violet-300/15 bg-violet-300/[.04] p-3 text-xs leading-5 text-violet-100/90" role="status">{scanMessage}</p>}
      {error && <p className="mt-3 text-xs leading-5 text-rose-300" role="alert">{error}</p>}
    </section>

    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Microsoft Defender · separate integration</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">{status.defender.message}</p>
        </div>
        <Button variant="outline" onClick={() => void openSecurityHistory()} disabled={!desktop}>
          <ExternalLink size={14} />Windows Security
        </Button>
      </div>
      <dl className="mt-4 grid gap-3 rounded-lg border border-white/[.06] bg-black/10 p-4 text-xs sm:grid-cols-3">
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Defender status</dt><dd className="mt-1 text-slate-200">{status.defender.state}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Real-time protection</dt><dd className="mt-1 text-slate-200">{status.defender.realTimeProtectionEnabled ? 'Enabled' : 'Not reported as enabled'}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Defender signature update</dt><dd className="mt-1 text-slate-200">{dateLabel(status.defender.signatureUpdatedAt)}</dd></div>
      </dl>
      {desktop && <Button variant="outline" className="mt-3" onClick={() => void startDefenderScan()} disabled={!folder || !status.defender.canScan || !!busy}>
        <ShieldCheck size={14} />{busy === 'defender' ? 'Starting…' : 'Run Defender scan on selected folder'}
      </Button>}
      {defenderMessage && <p className="mt-3 text-xs leading-5 text-violet-100/90" role="status">{defenderMessage}</p>}
    </section>

    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recoverable quarantine</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Files are moved on the same volume and can be restored. Ayatrisya never permanently deletes a match.</p>
        </div>
        {desktop && <Button variant="outline" onClick={() => void refreshQuarantine()} disabled={!!busy}>
          <RefreshCw size={14} />Refresh
        </Button>}
      </div>
      {quarantine.length ? <ul className="mt-3 space-y-2">
        {quarantine.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/[.06] p-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-200" title={item.originalPath}>{item.name}</p>
            <p className="mt-1 truncate text-[11px] text-slate-500" title={item.originalPath}>{item.originalPath}</p>
            <p className="mt-1 text-[11px] text-slate-500">{dateLabel(item.quarantinedAt)} · {item.rules.join(', ')}</p>
            {item.attribution.map((match) => <p key={`${match.rule}-${match.authors.join(',')}`} className="mt-1 text-[11px] text-slate-500">
              Author: {match.authors.join(', ') || 'not supplied'}
            </p>)}
          </div>
          <Button variant="outline" onClick={() => void restoreItem(item.id)} disabled={!!busy}>
            <ArchiveRestore size={14} />Restore
          </Button>
        </li>)}
      </ul> : <p className="mt-3 text-xs text-slate-500">No files are currently in Ayatrisya quarantine.</p>}
    </section>

    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <h2 className="text-sm font-semibold">Scope and limitations</h2>
      <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-400">
        <li>YARA-X uses local rules; it is not a complete antivirus and does not replace Microsoft Defender.</li>
        <li>The bundled rules are from the verified Signature-Base commit shown above and are filtered to the reviewed Detection Rule License 1.1 terms. Updates are fetched from the official source, signature-verified, compiled, and shown for approval before activation.</li>
        <li>Scanning does not upload files or scan results. The bundled baseline works offline; rule updates require an internet connection.</li>
        <li>Every match needs review. Quarantine is recoverable; protected Windows and Ayatrisya files cannot be quarantined, and restore never overwrites an existing file.</li>
        <li>This feature is on-demand only. It does not provide real-time, scheduled, kernel-level, or complete malware protection.</li>
      </ul>
    </section>

    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Local activity log</h2>
        {desktop && <Button variant="outline" onClick={() => { void refreshActivity(); void refreshQuarantine(); }} disabled={!!busy}>
          <RefreshCw size={14} />Refresh
        </Button>}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Stores scan totals, rule-update actions, and quarantine/restore paths locally in this desktop’s app data.</p>
      {yaraAudit.length || defenderAudit.length ? <ul className="mt-3 divide-y divide-white/[.05]">
        {[...yaraAudit.map((entry) => ({ at: entry.at, label: yaraAuditLabel(entry) })), ...defenderAudit.map((entry) => ({ at: entry.at, label: `${entry.folderName} · ${auditLabel(entry)}` }))]
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 100)
          .map((entry, index) => <li key={`${entry.at}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
            <span className="text-slate-300">{entry.label}</span>
            <time className="text-slate-500" dateTime={entry.at}>{dateLabel(entry.at)}</time>
          </li>)}
      </ul> : <p className="mt-3 text-xs text-slate-500">No local War Mode activity recorded yet.</p>}
    </section>
  </div>;
}
