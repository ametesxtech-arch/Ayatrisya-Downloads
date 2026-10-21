import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, FolderOpen, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/Primitives';
import { errMsg } from '@/lib/format';
import type { WarModeAuditEntry, WarModeStatus } from '@/desktop/contracts';

function stateTone(state: WarModeStatus['state']) {
  if (state === 'READY') return 'border-emerald-300/20 bg-emerald-300/[.06] text-emerald-200';
  if (state === 'STARTING' || state === 'SCANNING') return 'border-violet-300/20 bg-violet-300/[.06] text-violet-200';
  if (state === 'OFFLINE') return 'border-slate-300/15 bg-white/[.03] text-slate-300';
  return 'border-amber-300/20 bg-amber-300/[.05] text-amber-200';
}

function dateLabel(value: string | null) {
  if (!value) return 'Not reported by Windows';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Windows returned an invalid date' : date.toLocaleString();
}

function auditLabel(entry: WarModeAuditEntry) {
  const suffix = entry.exitCode === null ? '' : ` · exit ${entry.exitCode}`;
  const labels = {
    started: 'Scan started',
    completed: 'Scan command completed',
    failed: 'Scan failed',
    'timed-out': 'Scan timed out',
  } as const;
  return `${labels[entry.result]}${suffix}`;
}

export function WarModePanel() {
  const desktop = typeof window !== 'undefined' ? window.ayatrisyaDesktop : undefined;
  const [status, setStatus] = useState<WarModeStatus>({
    state: desktop ? 'STARTING' : 'OFFLINE',
    canScan: false,
    engine: null,
    signatureVersion: null,
    signatureUpdatedAt: null,
    realTimeProtectionEnabled: false,
    message: desktop ? 'Checking the local scanner…' : 'War Mode scanning requires Ayatrisya Desktop on Windows.',
  });
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [audit, setAudit] = useState<WarModeAuditEntry[]>([]);
  const [busy, setBusy] = useState<'status' | 'folder' | 'scan' | ''>('');
  const [error, setError] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  const refreshStatus = useCallback(async () => {
    if (!desktop) return;
    setBusy('status');
    setStatus((previous) => ({ ...previous, state: 'STARTING', message: 'Checking Windows Defender and local signatures…' }));
    setError('');
    try {
      setStatus(await desktop.getWarModeStatus());
    } catch (cause) {
      setStatus({
        state: 'ERROR',
        canScan: false,
        engine: 'Microsoft Defender',
        signatureVersion: null,
        signatureUpdatedAt: null,
        realTimeProtectionEnabled: false,
        message: 'The local scanner status could not be checked.',
      });
      setError(errMsg(cause));
    } finally {
      setBusy('');
    }
  }, [desktop]);

  const refreshAudit = useCallback(async () => {
    if (!desktop) return;
    try {
      setAudit(await desktop.getWarModeAuditLog());
    } catch (cause) {
      setError(errMsg(cause));
    }
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    void refreshStatus();
    void refreshAudit();
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [desktop, refreshAudit, refreshStatus]);

  async function chooseFolder() {
    if (!desktop) return;
    setBusy('folder');
    setError('');
    setScanMessage('');
    try {
      setFolder(await desktop.chooseWarModeFolder());
    } catch (cause) {
      setError(errMsg(cause));
    } finally {
      setBusy('');
    }
  }

  async function startScan() {
    if (!desktop || !folder || !status.canScan || busy) return;
    setBusy('scan');
    setStatus((previous) => ({ ...previous, state: 'SCANNING', message: `Starting a local Defender scan of ${folder.name}…` }));
    setScanMessage('');
    setError('');
    try {
      const result = await desktop.scanWarModeFolder(folder.id);
      if (result.cancelled) {
        setScanMessage('Scan cancelled before it started.');
        await refreshStatus();
        return;
      }
      setScanMessage(result.message ?? 'The scanner returned no result.');
      setFolder(null);
      await refreshStatus();
      await refreshAudit();
    } catch (cause) {
      setFolder(null);
      setStatus((previous) => ({ ...previous, state: 'ATTENTION_REQUIRED', canScan: false, message: 'The scan did not complete.' }));
      setError(errMsg(cause));
      await refreshAudit();
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

  return <div className="space-y-5">
    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-violet-300" /><h2 className="text-sm font-semibold">War Mode · Local scan</h2></div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Run an on-demand scan using the Windows Defender installation and signatures already on this computer. Ayatrisya only starts a scan after you choose a folder and confirm it.</p>
        </div>
        {desktop && <Button variant="outline" onClick={() => void refreshStatus()} disabled={!!busy}><RefreshCw size={14} />{busy === 'status' ? 'Checking…' : 'Check status'}</Button>}
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
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Signature version</dt><dd className="mt-1 text-slate-200">{status.signatureVersion ?? 'Not available'}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Last signature update</dt><dd className="mt-1 text-slate-200">{dateLabel(status.signatureUpdatedAt)}</dd></div>
      </dl>}

      {!isOnline && desktop && <p className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-100/80">This device appears offline. A scan can use only the signatures already installed on Windows; Ayatrisya will not attempt to update them.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {desktop ? <>
          <Button variant="outline" onClick={() => void chooseFolder()} disabled={!!busy || !status.canScan}><FolderOpen size={14} />{busy === 'folder' ? 'Opening…' : 'Choose folder'}</Button>
          {folder && <span className="max-w-[250px] truncate text-xs text-slate-300" title={folder.name}>Selected: {folder.name}</span>}
          <Button onClick={() => void startScan()} disabled={!folder || !status.canScan || !!busy}><ShieldCheck size={14} />{busy === 'scan' ? 'Scanning…' : 'Start offline scan'}</Button>
          <Button variant="outline" onClick={() => void openSecurityHistory()}><ExternalLink size={14} />Windows Security</Button>
        </> : <p className="text-xs text-slate-400">Open this page in Ayatrisya Desktop on Windows to check the local scanner.</p>}
      </div>

      {scanMessage && <p className="mt-4 rounded-lg border border-violet-300/15 bg-violet-300/[.04] p-3 text-xs leading-5 text-violet-100/90" role="status">{scanMessage}</p>}
      {error && <p className="mt-3 text-xs leading-5 text-rose-300" role="alert">{error}</p>}
    </section>

    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <h2 className="text-sm font-semibold">Scope and limitations</h2>
      <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-400">
        <li>Ayatrisya invokes Windows Defender locally; it does not upload scanned files or call an Ayatrisya AI model.</li>
        <li>Defender’s existing cloud and quarantine settings are left unchanged. Offline scans depend on signatures already installed on Windows.</li>
        <li>Ayatrisya does not bundle Defender or its signatures. This first integration does not expose per-file totals, skipped-file counts, or threat details, so it never shows a percentage or claims a clean scan. Check Windows Security Protection history for findings and restore actions.</li>
        <li>This is an on-demand folder scan, not real-time, kernel-level, scheduled, or whole-device protection. It does not change Windows security settings.</li>
      </ul>
    </section>

    <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Local activity log</h2>
        {desktop && <Button variant="outline" onClick={() => void refreshAudit()} disabled={busy === 'scan'}><RefreshCw size={14} />Refresh</Button>}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Stores only scan time, folder name, result, and exit code in this desktop’s local app data.</p>
      {audit.length ? <ul className="mt-3 divide-y divide-white/[.05]">
        {[...audit].reverse().map((entry, index) => <li key={`${entry.at}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
          <span className="text-slate-300">{auditLabel(entry)} · {entry.folderName}</span>
          <time className="text-slate-500" dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
        </li>)}
      </ul> : <p className="mt-3 text-xs text-slate-500">No local scan activity recorded yet.</p>}
    </section>
  </div>;
}
