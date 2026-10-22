import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ChevronRight, Code2, FileCode2, Folder, FolderOpen, FolderPlus, RefreshCw,
  Save, SquareTerminal, Trash2,
} from 'lucide-react';
import { Button, areaCls, inputCls } from '@/components/Primitives';
import { formatBytes } from '@/lib/format';
import type { DesktopCompanionStatus, DesktopFile, DesktopProject } from '@/desktop/contracts';
import { DesktopCodingAgent } from './DesktopCodingAgent';
import { useDesktopRuntime } from '@/desktop/use-runtime';
import type { BrowserCompanionState, CodingDesktopApi } from '@/pwa/use-browser-companion';

export function DesktopProjectManager({ browserCompanion }: { browserCompanion: BrowserCompanionState }) {
  const { desktop: nativeDesktop, checking } = useDesktopRuntime();
  const desktop: CodingDesktopApi | null = nativeDesktop ?? browserCompanion.api;
  const isBrowserCompanion = !nativeDesktop && Boolean(browserCompanion.api);
  const [projects, setProjects] = useState<DesktopProject[]>([]);
  const [activeId, setActiveId] = useState('');
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [directory, setDirectory] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [command, setCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [activeCommandId, setActiveCommandId] = useState('');
  const [companionStatus, setCompanionStatus] = useState<DesktopCompanionStatus | null>(null);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [companionError, setCompanionError] = useState('');
  const active = projects.find((project) => project.id === activeId) ?? null;
  const breadcrumbs = directory.split('/').filter(Boolean);

  useEffect(() => {
    if (!nativeDesktop) {
      setCompanionStatus(null);
      return;
    }
    let cancelled = false;
    nativeDesktop.getLocalCompanionStatus().then((status) => {
      if (!cancelled) setCompanionStatus(status);
    }).catch((reason: unknown) => {
      if (!cancelled) setCompanionError(reason instanceof Error ? reason.message : 'Local companion status is unavailable.');
    });
    return () => { cancelled = true; };
  }, [nativeDesktop]);

  useEffect(() => {
    if (!desktop) {
      setProjects([]);
      setActiveId('');
      setFiles([]);
      setDirectory('');
      setSelectedFile('');
      setDraft('');
      setDirty(false);
      setTerminalOutput('');
      return;
    }
    let cancelled = false;
    setBusy(true);
    desktop.listProjects().then((rows) => {
      if (cancelled) return;
      setProjects(rows);
      setActiveId((current) => rows.some((project) => project.id === current) ? current : rows[0]?.id ?? '');
      setError('');
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Local folders could not be loaded.');
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [desktop, refreshKey]);

  useEffect(() => {
    if (!desktop || !active?.available) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    desktop.listFiles(active.id, directory).then((rows) => {
      if (!cancelled) { setFiles(rows); setError(''); }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Files could not be listed.');
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [desktop, active?.id, active?.available, directory, refreshKey]);

  useEffect(() => {
    if (!activeCommandId) return;
    const commandId = activeCommandId;
    return () => { void desktop?.cancelCommand(commandId).catch(() => undefined); };
  }, [activeCommandId, desktop]);

  if (checking && !desktop) return <section className="mb-7 rounded-2xl border border-white/10 bg-[#13151c] p-4 sm:p-5" role="status">
    <p className="text-xs text-slate-400">Verifying the Ayatrisya desktop bridge…</p>
  </section>;

  if (!desktop) return <section className="mb-7 rounded-2xl border border-white/10 bg-[#13151c] p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <Code2 size={17} className="mt-0.5 text-violet-200" />
      <div>
        <h2 className="display text-lg font-semibold">Connect local files through Ayatrisya Desktop</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">The browser cannot access your files by itself. For same-computer access, open Ayatrisya Desktop, enable its loopback-only browser companion in Coding, and pair this browser. Folder selection, every file edit, and every command require a native desktop confirmation. This companion does not send files to a model.</p>
        {browserCompanion.error && <p className="mt-3 text-xs text-amber-200" role="alert">{browserCompanion.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {browserCompanion.mode === 'available' && <Button onClick={() => void browserCompanion.pair()} disabled={browserCompanion.busy} data-testid="button-pair-desktop-companion">{browserCompanion.busy ? 'Waiting for desktop approval…' : 'Pair this browser'}</Button>}
          {browserCompanion.mode === 'paired' && <Button variant="outline" onClick={() => void browserCompanion.disconnect()} disabled={browserCompanion.busy} data-testid="button-disconnect-desktop-companion">Disconnect browser</Button>}
          {browserCompanion.mode === 'unavailable' && <Button variant="outline" onClick={() => void browserCompanion.refresh()} disabled={browserCompanion.busy} data-testid="button-refresh-desktop-companion">Check again</Button>}
          <Link href="/desktop" className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-200 hover:bg-white/[.06]" data-testid="link-desktop-for-local-folders">Get Ayatrisya Desktop</Link>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-slate-500" role="status">
          {browserCompanion.mode === 'checking' ? 'Checking for Ayatrisya Desktop on this computer…' :
            browserCompanion.mode === 'paired' ? 'This browser is paired for a temporary session.' :
              browserCompanion.mode === 'available' ? 'Desktop companion detected. Pairing will open a confirmation in the desktop app.' :
                'The desktop app must be running on this same computer. Mobile browsers cannot connect to a different computer’s loopback service.'}
        </p>
      </div>
    </div>
  </section>;

  function confirmDiscard() {
    return !dirty || window.confirm('Discard unsaved file edits?');
  }

  function switchFolder(projectId: string) {
    if (!confirmDiscard()) return;
    setActiveId(projectId);
    setDirectory('');
    setSelectedFile('');
    setDraft('');
    setDirty(false);
    setTerminalOutput('');
    setError('');
  }

  async function addFolder() {
    setBusy(true);
    setError('');
    try {
      const project = await desktop!.chooseProjectFolder();
      if (project) {
        setProjects((current) => current.some((row) => row.id === project.id)
          ? current
          : [...current, project]);
        setActiveId(project.id);
        setDirectory('');
        setSelectedFile('');
        setDraft('');
        setDirty(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The folder could not be added.');
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder(project: DesktopProject) {
    if (!window.confirm(`Remove Ayatrisya's access to "${project.name}"? Your files will not be deleted.`)) return;
    setBusy(true);
    setError('');
    try {
      await desktop!.removeProjectFolder(project.id);
      setProjects((current) => current.filter((row) => row.id !== project.id));
      if (activeId === project.id) {
        setActiveId('');
        setDirectory('');
        setSelectedFile('');
        setDraft('');
        setDirty(false);
        setFiles([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Folder access could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  async function openFile(file: DesktopFile) {
    if (!confirmDiscard()) return;
    setBusy(true);
    setError('');
    try {
      const content = await desktop!.readFile(active!.id, file.relativePath);
      setSelectedFile(file.relativePath);
      setDraft(content);
      setDirty(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be opened.');
    } finally {
      setBusy(false);
    }
  }

  async function createFile() {
    if (!active || !newFileName.trim()) return;
    if (/[\\/]/.test(newFileName)) {
      setError('Enter a file name without folder separators.');
      return;
    }
    const relativePath = [directory, newFileName.trim()].filter(Boolean).join('/');
    setBusy(true);
    setError('');
    try {
      await desktop!.createFile(active.id, relativePath);
      setSelectedFile(relativePath);
      setDraft('');
      setDirty(false);
      setNewFileName('');
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function saveFile() {
    if (!active || !selectedFile) return;
    setBusy(true);
    setError('');
    try {
      await desktop!.writeFile(active.id, selectedFile, draft);
      setDirty(false);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function runCommand() {
    if (!active || !command.trim()) return;
    const commandId = crypto.randomUUID();
    setActiveCommandId(commandId);
    setBusy(true);
    setError('');
    setTerminalOutput('');
    try {
      const result = await desktop!.runCommand(active.id, command, commandId);
      if (result.cancelled) {
        setTerminalOutput('Command cancelled. Nothing was run.');
      } else {
        const pieces = [
          result.stdout,
          result.stderr,
          result.timedOut ? '[Stopped after 60 seconds.]' : '',
          result.outputLimited ? '[Output was limited to 128 KB.]' : '',
          result.code === 0 ? '[Exited successfully.]' : result.code === null ? '[Process was stopped.]' : `[Exited with code ${result.code}.]`,
        ].filter(Boolean);
        setTerminalOutput(pieces.join('\n'));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The command could not be run.');
    } finally {
      setActiveCommandId('');
      setBusy(false);
    }
  }

  async function cancelCommand() {
    if (!activeCommandId) return;
    try {
      await desktop?.cancelCommand(activeCommandId);
      setTerminalOutput((value) => `${value}${value ? '\n' : ''}Cancellation requested…`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The command could not be cancelled.');
    }
  }

  async function toggleCompanion() {
    if (!nativeDesktop) return;
    setCompanionBusy(true);
    setCompanionError('');
    try {
      const status = companionStatus?.enabled
        ? await nativeDesktop.disableLocalCompanion()
        : await nativeDesktop.enableLocalCompanion();
      setCompanionStatus(status);
    } catch (reason) {
      setCompanionError(reason instanceof Error ? reason.message : 'The browser companion could not be started.');
      setCompanionStatus(await nativeDesktop.getLocalCompanionStatus().catch(() => null));
    } finally {
      setCompanionBusy(false);
    }
  }

  function enterDirectory(file: DesktopFile) {
    if (!confirmDiscard()) return;
    setDirectory(file.relativePath);
    setSelectedFile('');
    setDraft('');
    setDirty(false);
  }

  return <section className="mb-7 rounded-2xl border border-white/10 bg-[#13151c] p-4 sm:p-5" aria-labelledby="desktop-projects-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-200">{isBrowserCompanion ? 'Temporary browser connection' : 'Desktop workspace'}</p>
        <h2 id="desktop-projects-heading" className="display mt-1 text-lg font-semibold">Local project folders</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{isBrowserCompanion
          ? 'Files stay on this computer. The website only sees folders you choose and supported source files you open. Each file change and command requires a separate native desktop confirmation.'
          : 'Open folders only after choosing them. Without an approved browser pairing, folders remain local. Removing access never deletes your files.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {nativeDesktop && <Button variant="outline" onClick={() => void toggleCompanion()} disabled={companionBusy} data-testid="button-toggle-local-companion">
          {companionBusy ? 'Working…' : companionStatus?.enabled ? 'Disable browser companion' : 'Enable browser companion'}
        </Button>}
        <Button onClick={() => void addFolder()} disabled={busy} data-testid="button-open-local-folder"><FolderPlus size={15} />Open folder</Button>
      </div>
    </div>

    {nativeDesktop && <div className="mt-3 rounded-lg border border-white/[.07] bg-black/10 p-3 text-xs">
      <p className="font-medium text-slate-200" role="status">{companionStatus?.enabled ? `Browser companion is on for this session at 127.0.0.1:${companionStatus.port}.` : 'Browser companion is off.'}</p>
      <p className="mt-1 leading-5 text-slate-500">Only {companionStatus?.allowedOrigin ?? 'the Ayatrisya website'} is allowed in packaged builds. Pairing lasts 15 minutes and requires approval in this desktop app. It stops when the desktop window closes.</p>
      {companionError && <p className="mt-2 text-amber-200" role="alert">{companionError}</p>}
    </div>}
    {isBrowserCompanion && <details className="mt-3 rounded-lg border border-white/[.07] bg-black/10 p-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-300">Local companion activity ({browserCompanion.audit.length})</summary>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">This in-memory log records operation types and results only—not file contents, commands, or access tokens. It clears when the desktop companion stops.</p>
      <Button variant="outline" className="mt-2 min-h-8 px-2 text-[10px]" onClick={() => void browserCompanion.refreshAudit()} data-testid="button-refresh-companion-audit"><RefreshCw size={12} />Refresh activity</Button>
      {browserCompanion.audit.length ? <ul className="mt-2 max-h-36 space-y-1 overflow-auto">
        {browserCompanion.audit.slice(0, 20).map((entry, index) => <li key={`${entry.at}-${index}`} className="flex flex-wrap justify-between gap-x-3 text-[10px] text-slate-500">
          <span>{entry.operation.replaceAll('-', ' ')} · {entry.status}</span>
          <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString()}</time>
        </li>)}
      </ul> : <p className="mt-2 text-[10px] text-slate-500">No companion actions recorded yet.</p>}
    </details>}

    {error && <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs text-rose-200" role="alert">{error}</p>}
    <div className="mt-4 grid gap-3 xl:grid-cols-[230px_minmax(210px,260px)_minmax(0,1fr)]">
      <div className="rounded-xl border border-white/[.07] bg-black/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">Folders</h3>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={busy} aria-label="Refresh local folders" className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"><RefreshCw size={13} /></button>
        </div>
        {projects.length === 0 && <p className="py-3 text-xs text-slate-500">No local folders added.</p>}
        <div className="space-y-1">
          {projects.map((project) => <div key={project.id} className={`group flex items-start gap-2 rounded-lg px-2 py-2 ${activeId === project.id ? 'bg-violet-400/10 text-white' : 'text-slate-300 hover:bg-white/[.04]'}`}>
            <button type="button" onClick={() => switchFolder(project.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left" title={project.path}>
              <FolderOpen size={14} className="mt-0.5 shrink-0 text-violet-200" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{project.name}</span>
                <span className={`block truncate text-[10px] ${project.available ? 'text-slate-500' : 'text-amber-300'}`}>{project.available ? (isBrowserCompanion ? 'Local folder · path hidden' : project.path) : 'Folder unavailable — reselect to restore access'}</span>
              </span>
            </button>
            <button type="button" onClick={() => void removeFolder(project)} disabled={busy} aria-label={`Remove access to ${project.name}`} title="Remove access only" className="mt-0.5 rounded p-1 text-slate-500 opacity-70 hover:bg-white/10 hover:text-rose-200 disabled:opacity-40"><Trash2 size={12} /></button>
          </div>)}
        </div>
      </div>

      <div className="min-h-48 rounded-xl border border-white/[.07] bg-black/10 p-3">
        <div className="mb-2 flex min-h-6 flex-wrap items-center gap-1 text-xs">
          <button type="button" onClick={() => { if (confirmDiscard()) { setDirectory(''); setSelectedFile(''); setDraft(''); setDirty(false); } }} className="font-semibold text-slate-200 hover:text-white" disabled={!active}>Files</button>
          {breadcrumbs.map((part, index) => <span key={`${part}-${index}`} className="flex items-center gap-1 text-slate-500">
            <ChevronRight size={12} />
            <button type="button" onClick={() => { if (confirmDiscard()) { setDirectory(breadcrumbs.slice(0, index + 1).join('/')); setSelectedFile(''); setDraft(''); setDirty(false); } }} className="max-w-24 truncate hover:text-white">{part}</button>
          </span>)}
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={busy || !active} aria-label="Refresh files" className="ml-auto rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"><RefreshCw size={12} /></button>
        </div>
        {!active && <p className="py-5 text-xs text-slate-500">Choose or add a local folder to browse files.</p>}
        {active && !active.available && <p className="py-5 text-xs text-amber-300">Folder unavailable. Re-add it to grant access again.</p>}
        {active?.available && !files.length && <p className="py-5 text-xs text-slate-500">{busy ? 'Loading files…' : 'This folder is empty.'}</p>}
        <div className="max-h-[280px] space-y-0.5 overflow-auto">
          {files.map((file) => <button key={file.relativePath} type="button" onClick={() => file.isDirectory ? enterDirectory(file) : void openFile(file)} disabled={busy} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/[.05] disabled:opacity-50 ${selectedFile === file.relativePath ? 'bg-violet-400/10 text-white' : 'text-slate-300'}`}>
            {file.isDirectory ? <Folder size={13} className="shrink-0 text-violet-200" /> : <FileCode2 size={13} className="shrink-0 text-slate-500" />}
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            {!file.isDirectory && <span className="shrink-0 text-[10px] text-slate-500">{formatBytes(file.size)}</span>}
          </button>)}
        </div>
        {active?.available && <div className="mt-3 flex gap-2 border-t border-white/[.07] pt-3">
          <input value={newFileName} onChange={(event) => setNewFileName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createFile(); }} disabled={busy} className={`${inputCls} min-w-0 flex-1 text-xs`} placeholder="New file name" aria-label="New local file name" maxLength={200} />
          <Button variant="outline" onClick={() => void createFile()} disabled={busy || !newFileName.trim()}>Create file</Button>
        </div>}
      </div>

      <div className="min-h-48 rounded-xl border border-white/[.07] bg-black/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-xs font-semibold text-slate-200">{selectedFile || 'Text editor'}</h3>
          {selectedFile && <Button variant="outline" onClick={() => void saveFile()} disabled={busy || !dirty}><Save size={13} />Save</Button>}
        </div>
        {selectedFile
          ? <textarea aria-label={`Edit ${selectedFile}`} spellCheck={false} value={draft} onChange={(event) => { setDraft(event.target.value); setDirty(true); }} className={`${areaCls} mono min-h-[220px] w-full resize-y text-xs leading-5`} />
          : <p className="grid min-h-[220px] place-items-center text-center text-xs text-slate-500">Select a text file to view and edit it.<br />Files larger than 1 MB and binary files are not opened.</p>}
        {dirty && <p className="mt-1 text-[10px] text-amber-300">Unsaved local changes</p>}
      </div>
    </div>

    <div className="mt-3 rounded-xl border border-white/[.07] bg-black/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <SquareTerminal size={15} className="text-violet-200" />
        <h3 className="text-xs font-semibold text-slate-200">One-shot terminal commands</h3>
        <span className="text-[10px] text-slate-500">Runs in the selected folder; every command needs a native confirmation.</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runCommand(); }} disabled={!active?.available || busy} className={`${inputCls} mono min-w-0 flex-1`} placeholder="Example: pnpm test" aria-label="Terminal command" maxLength={2000} />
        <Button onClick={() => void runCommand()} disabled={!active?.available || busy || !command.trim()}><SquareTerminal size={14} />{busy ? 'Working…' : 'Review & run'}</Button>
        {activeCommandId && <Button variant="outline" onClick={() => void cancelCommand()} data-testid="button-cancel-terminal-command">Cancel</Button>}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">Ayatrisya shows the exact command and folder in an operating-system confirmation before running it. Commands use your OS account permissions, so they may affect files outside this folder. They stop after 60 seconds; output is capped at 128 KB. This is a command runner, not a persistent interactive shell.</p>
      {terminalOutput && <pre className="mono mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#090a0f] p-3 text-[11px] leading-5 text-slate-300" aria-live="polite">{terminalOutput}</pre>}
    </div>

    {nativeDesktop && active?.available && <DesktopCodingAgent
      desktop={nativeDesktop}
      projectId={active.id}
      projectName={active.name}
      directory={directory}
      files={files}
      onPatchApplied={(relativePath, content) => {
        setSelectedFile(relativePath);
        setDraft(content);
        setDirty(false);
        setRefreshKey((key) => key + 1);
      }}
    />}
  </section>;
}
