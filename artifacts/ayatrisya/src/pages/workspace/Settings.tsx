import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Download, HardDrive, Trash2, Upload } from 'lucide-react';
import { Button, ConfirmDialog, LoadError, Modal, Notice, Skeleton, Switch, inputCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { PersonalizationPage } from '@/pages/workspace/Personalization';
import { downloadBlob, exportBackup, inspectBackup, restoreBackup } from '@/storage/backup';
import { driveSync } from '@/integrations/google-drive/sync';
import { errMsg, formatBytes } from '@/lib/format';
import type { ChatMode, ModelId, Preferences } from '@/storage/types';

type Section = 'appearance' | 'personalization' | 'models' | 'privacy' | 'storage';
const sections: Array<[Section, string]> = [['appearance', 'Appearance'], ['personalization', 'Personalization'], ['models', 'Models'], ['privacy', 'Privacy'], ['storage', 'Storage and backup']];
const MAX_BACKUP = 100 * 1024 * 1024;

export function SettingsPage({ notify, goto, initial = 'appearance' }: { notify: (m: string) => void; goto: (h: string) => void; initial?: Section }) {
  const [section, setSection] = useState<Section>(initial);
  useEffect(() => setSection(initial), [initial]);
  return <div className="mx-auto max-w-[900px] p-4 sm:p-8">
    {section !== 'personalization' && <PageHeading eyebrow="Settings" title={section === 'storage' ? 'Storage and backup' : 'Settings'} description="Preferences are saved in this browser for the current workspace owner." />}
    <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[.07]">
      {sections.map(([k, l]) => <button key={k} role="tab" aria-selected={section === k} onClick={() => setSection(k)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium ${section === k ? 'border-violet-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>{l}</button>)}
    </div>
    {section === 'appearance' && <Appearance />}
    {section === 'personalization' && <PersonalizationPage />}
    {section === 'models' && <Models />}
    {section === 'privacy' && <Privacy goStorage={() => setSection('storage')} goto={goto} />}
    {section === 'storage' && <Storage notify={notify} />}
    <p className="mt-8 text-xs text-slate-500">Profile and sign-in details are on the <Link href="/workspace/account" className="underline">Account</Link> page. <button className="underline" onClick={() => goto('/onboarding')}>Run setup again</button></p>
  </div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-5 rounded-xl border border-white/[.075] bg-[#15171e] p-5"><h2 className="mb-1 text-sm font-semibold">{title}</h2><div className="divide-y divide-white/[.05]">{children}</div></section>;
}

function Appearance() {
  const { prefs, save } = usePrefs();
  return <>
    <Card title="Theme">
      <label className="block py-3 text-xs font-medium text-slate-400">Theme<select value={prefs.theme} onChange={(e) => void save({ theme: e.target.value as Preferences['theme'] })} className={`${inputCls} mt-1.5 max-w-xs`}><option>Dark</option><option>Light</option><option>Follow system</option></select></label>
      <label className="block py-3 text-xs font-medium text-slate-400">Language<select disabled value="English" className={`${inputCls} mt-1.5 max-w-xs opacity-70`}><option>English</option></select><span className="mt-1 block text-[11px] text-slate-500">English is the only interface language available.</span></label>
    </Card>
    <Card title="Behaviour">
      <Switch label="Reduce motion" description="Turns off animations and transitions, in addition to your system setting." checked={prefs.reducedMotion} onChange={(v) => void save({ reducedMotion: v })} />
      <Switch label="Collapse the sidebar" description="Keeps the desktop sidebar narrow." checked={prefs.sidebarCollapsed} onChange={(v) => void save({ sidebarCollapsed: v })} />
      <Switch label="Send with Enter" description="On: Enter sends and Shift+Enter adds a line. Off: Ctrl+Enter sends." checked={prefs.enterToSend} onChange={(v) => void save({ enterToSend: v })} />
      <Switch label="Pinned chats first" description="Keep pinned conversations at the top of history and the sidebar." checked={prefs.historyPinnedFirst} onChange={(v) => void save({ historyPinnedFirst: v })} />
      <Switch label="Quiet logo animation while idle" description="Plays a short orbit nudge on the sidebar logo every 40 seconds. Pauses when the tab is hidden." checked={prefs.logoIdle} onChange={(v) => void save({ logoIdle: v })} />
      <label className="flex items-center justify-between gap-4 py-3 text-sm">Workspace mode<select aria-label="Workspace mode" value={prefs.workspaceMode} onChange={(e) => void save({ workspaceMode: e.target.value as Preferences['workspaceMode'] })} className="rounded-md border border-white/10 bg-[#101116] px-3 py-2 text-xs"><option value="standard">Standard</option><option value="focus">Focus</option><option value="studio">Studio</option><option value="developer">Developer</option><option value="compact">Compact</option></select></label>
      <p className="pb-2 text-[11px] leading-5 text-slate-500">Focus hides desktop navigation; Studio widens chat; Developer shows real local and model status; Compact tightens navigation. The mode is saved with your browser preferences.</p>
      <label className="flex items-center justify-between gap-4 py-3 text-sm">History order<select value={prefs.historySort} onChange={(e) => void save({ historySort: e.target.value as typeof prefs.historySort })} className="rounded-md border border-white/10 bg-[#101116] px-3 py-2 text-xs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A to Z</option></select></label>
      <label className="flex items-center justify-between gap-4 py-3 text-sm">Project view<select value={prefs.projectView} onChange={(e) => void save({ projectView: e.target.value as typeof prefs.projectView })} className="rounded-md border border-white/10 bg-[#101116] px-3 py-2 text-xs"><option value="grid">Grid</option><option value="list">List</option></select></label>
      <label className="flex items-center justify-between gap-4 py-3 text-sm">Animation intensity<select value={prefs.animationIntensity} onChange={(e) => void save({ animationIntensity: e.target.value as typeof prefs.animationIntensity })} className="rounded-md border border-white/10 bg-[#101116] px-3 py-2 text-xs"><option value="full">Full</option><option value="subtle">Subtle</option><option value="none">None</option></select></label>
      <Switch label="Skip the intro screen" description="Go straight to your workspace when opening Ayatrisya." checked={prefs.skipIntro} onChange={(v) => void save({ skipIntro: v })} />
    </Card>
  </>;
}

function Models() {
  const { prefs, save } = usePrefs();
  const { caps, loading, error, refresh } = useCaps();
  const [demoOpen, setDemoOpen] = useState(false);
  return <>
    <Card title="Defaults">
      <label className="block py-3 text-xs font-medium text-slate-400">Default model<select value={prefs.model} onChange={(e) => void save({ model: e.target.value as ModelId })} className={`${inputCls} mt-1.5 max-w-xs`}><option value="v1-fast">V1 Fast</option><option value="v2-best">V2 Best Result</option></select></label>
      <label className="block py-3 text-xs font-medium text-slate-400">Default chat mode<select value={prefs.mode} onChange={(e) => void save({ mode: e.target.value as ChatMode })} className={`${inputCls} mt-1.5 max-w-xs`}><option>Normal</option><option>Savage</option><option>Joke</option></select><span className="mt-1 block text-[11px] text-slate-500">Mode is passed to the model as configuration. It does not change anything without a connected model.</span></label>
    </Card>
    <Card title="Model status">
      {loading && <Skeleton className="my-3 h-14" />}
      {error && <LoadError message={error} retry={refresh} />}
      {caps.map((c) => <div key={c.id} className="py-3 text-sm" data-testid={`capability-${c.id}`}><div className="flex items-center justify-between"><b>{c.label}</b><span className={`text-xs ${c.available ? 'text-teal-300' : 'text-amber-300'}`}>{c.available ? 'Reported available' : 'Unavailable'}</span></div><p className="mt-1 text-xs text-slate-500">{c.reason}{c.available ? ` Streaming: ${c.streaming ? 'yes' : 'no'}. Modalities: ${c.modalities.join(', ') || 'text'}.` : ''}</p></div>)}
      {!loading && caps.length === 0 && !error && <p className="py-3 text-sm text-slate-400">No capabilities were reported. No model is connected.</p>}
      <p className="py-3 text-xs text-slate-500">The model endpoint is configured when the app is built, not in the browser. There is no fallback to any third-party AI service.</p>
    </Card>
    {import.meta.env.DEV && <Card title="Developer-only visual preview">
      <p className="py-3 text-xs text-slate-400">DEMO — NOT REAL AI. This isolated example is not a model response, is never saved to a conversation, and is excluded from production builds.</p>
      <Button variant="outline" onClick={() => setDemoOpen(v => !v)}>{demoOpen ? 'Hide illustration' : 'Preview example response layout'}</Button>
      {demoOpen && <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/[.05] p-4 text-sm"><b className="text-violet-300">DEMO — NOT REAL AI</b><p className="mt-2">A connected model’s response would appear here.</p></div>}
    </Card>}
  </>;
}

function Privacy({ goStorage, goto }: { goStorage: () => void; goto: (h: string) => void }) {
  return <>
    <Card title="Delete selected data">
      <p className="py-3 text-sm leading-6 text-slate-400">Choose exactly what to remove. Each manager shows counts and asks before deleting.</p>
      <div className="flex flex-wrap gap-2 pb-3"><Button variant="outline" onClick={() => goto('/workspace/history')}>Select conversations</Button><Button variant="outline" onClick={() => goto('/workspace/projects')}>Manage projects</Button><Button variant="outline" onClick={() => goto('/workspace/library')}>Manage files and notes</Button></div>
    </Card>
    <Card title="How your data is handled">
      <p className="py-3 text-sm leading-6 text-slate-400">Conversations, projects, notes, documents and files are stored in IndexedDB in this browser profile. Ayatrisya has no content database. Clearing browser data, or using a private window, can remove them; export a backup to keep a copy.</p>
      <p className="py-3 text-sm leading-6 text-slate-400">If a model server is configured, text you choose to send reaches that server for processing, and you are asked first. Attachments are not sent. Ayatrisya does not train models on private content.</p>
      <p className="py-3 text-sm leading-6 text-slate-400">Google Drive backup is manual and optional, and only works when an OAuth client is configured.</p>
    </Card>
    <Button onClick={goStorage}><HardDrive size={15} />Export or delete your data</Button>
  </>;
}

function Storage({ notify }: { notify: (m: string) => void }) {
  const stats = useLocalQuery(() => repository.stats(), []);
  const [persist, setPersist] = useState<boolean | null>(null);
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const [clear, setClear] = useState(false), [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const s = stats.data;
  async function doExport() {
    setBusy('export');
    try { downloadBlob(await exportBackup(), `ayatrisya-backup-${new Date().toISOString().slice(0, 10)}.json`); notify('Backup downloaded. It is unencrypted and contains your private data.'); } catch (e) { notify(errMsg(e)); } finally { setBusy(''); }
  }
  async function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BACKUP) { notify('Backups larger than 100 MB cannot be imported.'); return; }
    try { const t = await f.text(); inspectBackup(t); setRestoreText(t); } catch (e) { notify(`Not a valid backup: ${errMsg(e)}`); }
    if (fileRef.current) fileRef.current.value = '';
  }
  return <>
    <Card title="This browser">
      {stats.loading && !s && <Skeleton className="my-3 h-20" />}
      {stats.error && <LoadError message={stats.error} retry={stats.refresh} />}
      {s && <dl className="grid grid-cols-2 gap-4 py-4 text-sm sm:grid-cols-4" data-testid="storage-stats">
        {([['Conversations', s.conversations], ['Projects', s.projects], ['Items', s.items], ['Files', s.attachments]] as const).map(([k, v]) => <div key={k}><dt className="text-[11px] text-slate-500">{k}</dt><dd className="display text-xl font-semibold">{v}</dd></div>)}
        <div><dt className="text-[11px] text-slate-500">Used (estimate)</dt><dd>{s.usage !== undefined ? formatBytes(s.usage) : 'Not reported by this browser'}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Quota (estimate)</dt><dd>{s.quota !== undefined ? formatBytes(s.quota) : 'Not reported'}</dd></div>
        <div className="col-span-2"><dt className="text-[11px] text-slate-500">Persistent storage</dt><dd>{(persist ?? s.persistent) === null ? 'Unknown' : (persist ?? s.persistent) ? 'Granted (the browser may still evict under extreme pressure)' : 'Not granted; the browser may clear data when space is low'}</dd></div>
      </dl>}
      <div className="py-3"><Button variant="outline" onClick={async () => { try { const g = await repository.requestPersistence(); setPersist(g); notify(g ? 'The browser granted persistent storage. This is not a guarantee.' : 'The browser did not grant persistent storage.'); } catch (e) { notify(errMsg(e)); } }}>Request persistent storage</Button></div>
    </Card>
    <Card title="Backup and restore">
      <p className="py-3 text-xs leading-5 text-slate-400">A backup is a downloaded JSON file, not synchronisation. It is unencrypted and contains private data. Importing lets you merge (keeps existing records with the same ID) or replace (clears this workspace first, after confirmation).</p>
      <div className="flex flex-wrap gap-2 py-3"><Button onClick={doExport} disabled={busy === 'export'}><Download size={15} />{busy === 'export' ? 'Preparing…' : 'Export backup'}</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void pickFile(e.target.files?.[0])} data-testid="input-import" />
        <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={15} />Import backup</Button></div>
    </Card>
    <DrivePanel notify={notify} onRemote={setRestoreText} />
    <Card title="Delete local data"><div className="py-3"><p className="mb-3 text-xs leading-5 text-slate-400">Removes every conversation, project, item and file for the current workspace owner from this browser. Other accounts and Drive copies are unaffected.</p><Button variant="outline" onClick={() => setClear(true)} data-testid="button-clear"><Trash2 size={15} />Clear local data</Button></div></Card>
    {restoreText !== null && <RestoreModal text={restoreText} notify={notify} onClose={() => setRestoreText(null)} />}
    {clear && <ConfirmDialog danger title="Clear all local data" confirmLabel="Delete everything" body="This permanently deletes all conversations, projects, notes, documents and files stored in this browser for the current workspace owner. Export a backup first if you might need them." onConfirm={async () => { try { await repository.clearLocalData(); notify('Local data cleared.'); } catch (e) { notify(errMsg(e)); } setClear(false); }} onClose={() => setClear(false)} />}
  </>;
}

function RestoreModal({ text, notify, onClose }: { text: string; notify: (m: string) => void; onClose: () => void }) {
  let info: ReturnType<typeof inspectBackup> | null = null; let bad = '';
  try { info = inspectBackup(text); } catch (e) { bad = errMsg(e); }
  const [confirmReplace, setConfirmReplace] = useState(false), [busy, setBusy] = useState(false);
  async function go(mode: 'merge' | 'replace') {
    setBusy(true);
    try { const r = await restoreBackup(text, mode); notify(`Restore finished: ${r.imported} imported, ${r.skipped} skipped.`); onClose(); } catch (e) { notify(`Restore failed: ${errMsg(e)}`); setBusy(false); setConfirmReplace(false); }
  }
  if (confirmReplace) return <ConfirmDialog danger title="Replace local data" confirmLabel="Replace" body="This clears every record in this workspace and replaces it with the backup. The operation is atomic, but your current data will be gone." onConfirm={() => go('replace')} onClose={() => setConfirmReplace(false)} />;
  return <Modal title="Import backup" onClose={onClose}>
    {bad ? <p role="alert" className="text-sm text-rose-300">{bad}</p> : info && <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[11px] text-slate-500">Conversations</dt><dd>{info.conversations}</dd></div><div><dt className="text-[11px] text-slate-500">Projects</dt><dd>{info.projects}</dd></div><div><dt className="text-[11px] text-slate-500">Items</dt><dd>{info.items}</dd></div><div><dt className="text-[11px] text-slate-500">Files</dt><dd>{info.attachments}</dd></div></dl>}
    <p className="mt-4 text-xs leading-5 text-slate-400">Merge keeps your current records and skips duplicates by ID. Replace discards current data first.</p>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="outline" disabled={!!bad || busy} onClick={() => setConfirmReplace(true)}>Replace</Button><Button disabled={!!bad || busy} onClick={() => go('merge')}>{busy ? 'Working…' : 'Merge'}</Button></div>
  </Modal>;
}

type DriveStatus = Awaited<ReturnType<typeof driveSync.status>>;
function DrivePanel({ notify, onRemote }: { notify: (m: string) => void; onRemote: (t: string) => void }) {
  const [st, setSt] = useState<DriveStatus | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState('');
  const load = useCallback(() => { driveSync.status().then(setSt, (e) => setErr(errMsg(e))); }, []);
  useEffect(load, [load]);
  async function run(k: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(k); setErr('');
    try { await fn(); if (ok) notify(ok); } catch (e) { setErr(errMsg(e)); } finally { setBusy(''); load(); }
  }
  return <Card title="Google Drive backup (manual)">
    <div className="py-3"><Notice>This is manual backup and restore to your own Drive, not continuous sync. It has not been tested live in this build.</Notice></div>
    <div className="py-3 text-sm" data-testid="drive-status">
      {!st && !err && <Skeleton className="h-12" />}
      {st && <><p>{st.message}</p><p className="mt-1 text-xs text-slate-500">Configured: {st.configured ? 'yes' : 'no'} · Connected: {st.connected ? 'yes' : 'no'} · Paused: {st.paused ? 'yes' : 'no'} · Pending: {st.pending} · Conflicts: {st.conflicts} · Last success: {st.lastSuccess ? new Date(st.lastSuccess).toLocaleString() : 'never'}</p></>}
      {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
    </div>
    <div className="flex flex-wrap gap-2 py-3">
      <Button variant="outline" disabled={!st?.configured || st.connected || !!busy} onClick={() => run('c', () => driveSync.connect(), 'Connected to Google Drive.')}>Connect Drive</Button>
      <Button variant="outline" disabled={!st?.connected || !!busy} onClick={() => run('s', () => driveSync.syncNow(), 'Backup saved to Drive.')}>{busy === 's' ? 'Backing up…' : 'Back up now'}</Button>
      <Button variant="outline" disabled={!st?.connected || !!busy} onClick={() => run('d', async () => onRemote(await driveSync.downloadRemote()))}>Preview Drive backup</Button>
      <Button variant="outline" disabled={!st?.connected} onClick={() => void run('p', () => (st?.paused ? driveSync.resume() : driveSync.pause()))}>{st?.paused ? 'Resume' : 'Pause'}</Button>
      <Button variant="outline" disabled={!st?.connected} onClick={() => { driveSync.disconnect(); load(); notify('Disconnected from Drive.'); }}>Disconnect</Button>
    </div>
    {st && st.conflicts > 0 && <div className="py-3 text-sm"><p className="mb-2">A conflict was detected between the local and Drive copies. Choose which to keep.</p><div className="flex gap-2"><Button variant="outline" onClick={() => run('rl', () => driveSync.resolveConflict('local'), 'Kept the local copy.')}>Keep local</Button><Button variant="outline" onClick={() => run('rr', async () => { const t = await driveSync.resolveConflict('remote'); if (typeof t === 'string') onRemote(t); })}>Use Drive copy</Button></div></div>}
  </Card>;
}
