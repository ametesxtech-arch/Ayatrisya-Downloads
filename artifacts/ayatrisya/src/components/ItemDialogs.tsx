import { useEffect, useState } from 'react';
import { Button, ConfirmDialog, Modal, inputCls, areaCls } from '@/components/Primitives';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { driveSync } from '@/integrations/google-drive/sync';
import { downloadBlob } from '@/storage/backup';
import type { Project, ProjectItem } from '@/storage/types';
import { errMsg } from '@/lib/format';
import { confirmDiscard, setDirty } from '@/lib/dirty';
import { pushNotice } from '@/lib/notify';

export const textExt = new Set(['txt', 'md', 'csv', 'json', 'ts', 'tsx', 'py', 'css']);
export const isTextFile = (name: string) => textExt.has(name.split('.').at(-1)?.toLowerCase() ?? '');

export function MoveDialog({ item, onClose }: { item: ProjectItem; onClose: () => void }) {
  const projects = useLocalQuery(() => repository.listProjects({ limit: 200 }), []);
  const [to, setTo] = useState(item.projectId ?? ''), [err, setErr] = useState('');
  return <Modal title="Move to project" onClose={onClose}>
    <label className="block text-xs text-slate-400">Project<select data-autofocus value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1.5`}><option value="">No project (Library only)</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
    <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={async () => { const prev = item.projectId; try { await repository.moveItem(item.id, to || null); pushNotice(`Moved ${item.title}.`, { label: 'Undo', run: () => repository.moveItem(item.id, prev).catch((e) => pushNotice(errMsg(e))) }); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Move</Button></div>
  </Modal>;
}

export function TextFileDialog({ item, onClose }: { item: ProjectItem; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null), [orig, setOrig] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const isDirty = text !== null && text !== orig;
  useEffect(() => { setDirty(isDirty); return () => setDirty(false); }, [isDirty]);
  useEffect(() => {
    if (!isDirty) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [isDirty]);
  const guarded = () => { if (confirmDiscard()) onClose(); };
  useEffect(() => { let off = false; (async () => { try { const b = item.attachmentId ? await repository.getFile(item.attachmentId) : undefined; if (!b) throw new Error('File data is not stored in this browser.'); const t = await b.text(); if (!off) { setText(t); setOrig(t); } } catch (e) { if (!off) setErr(errMsg(e)); } })(); return () => { off = true; }; }, [item.attachmentId]);
  return <Modal title={`Edit ${item.title}`} wide onClose={guarded}>
    {text === null && !err && <div className="h-40 animate-pulse rounded bg-white/[.05]" />}
    {text !== null && <textarea aria-label="File contents" data-autofocus spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} className={`${areaCls} min-h-[50vh] font-mono text-xs`} />}
    {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
    <p className="mt-2 text-[11px] text-slate-500">Plain text only. The file is stored in this browser and is never executed.</p>
    <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={guarded}>Close</Button><Button disabled={busy || text === null || text === orig} onClick={async () => { setBusy(true); setErr(''); try { await repository.updateTextFile(item.id, text!); setOrig(text!); pushNotice('File saved in this browser.'); } catch (e) { setErr(errMsg(e)); } setBusy(false); }}>Save file</Button></div>
  </Modal>;
}

export type DriveTarget = { kind: 'item' | 'project'; id: string; title: string };
type DriveStatus = Awaited<ReturnType<typeof driveSync.itemStatus>>;
const driveApi = {
  item: { status: (id: string) => driveSync.itemStatus(id), sync: (id: string) => driveSync.syncItem(id), download: (id: string) => driveSync.downloadItem(id), remove: (id: string) => driveSync.deleteRemoteItem(id), force: (id: string) => driveSync.resolveItemConflict(id, 'local') },
  project: { status: (id: string) => driveSync.projectStatus(id), sync: (id: string) => driveSync.syncProject(id), download: (id: string) => driveSync.downloadProject(id), remove: (id: string) => driveSync.deleteRemoteProject(id), force: (id: string) => driveSync.resolveProjectConflict(id, 'local') },
};

export function DriveBadge({ target }: { target: DriveTarget }) {
  const [st, setSt] = useState<DriveStatus | null>(null), [bad, setBad] = useState(false);
  const tick = useLocalQuery(() => driveApi[target.kind].status(target.id), [target.id, target.kind]);
  useEffect(() => { setSt(tick.data ?? null); setBad(!!tick.error); }, [tick.data, tick.error]);
  if (!st && !bad) return <span className="inline-block h-4 w-16 animate-pulse rounded bg-white/[.05]" aria-hidden />;
  const label = bad ? 'Drive status unavailable' : { local: 'Local only', pending: 'Drive: pending', failed: 'Drive: failed', conflict: 'Drive: conflict', synced: 'Drive: synced' }[st!.state];
  const tone = bad || st!.state === 'local' ? 'border-white/10 text-slate-500' : st!.state === 'synced' ? 'border-teal-300/25 text-teal-200' : st!.state === 'pending' ? 'border-blue-300/25 text-blue-200' : 'border-amber-300/30 text-amber-200';
  return <span title={bad ? tick.error ?? undefined : st!.error ?? (st!.lastSuccessAt ? `Last confirmed ${new Date(st!.lastSuccessAt).toLocaleString()}` : undefined)} className={`rounded border px-1.5 py-0.5 text-[10px] ${tone}`}>{label}</span>;
}

export function DriveDialog({ target, onClose }: { target: DriveTarget; onClose: () => void }) {
  const api = driveApi[target.kind];
  const [st, setSt] = useState<DriveStatus | null>(null), [err, setErr] = useState(''), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'force' | 'remove' | null>(null);
  const load = () => api.status(target.id).then(setSt, (e) => setErr(errMsg(e)));
  useEffect(() => { void load(); }, [target.id]);
  const label: Record<DriveStatus['state'], string> = { local: 'Local only. Not backed up to Drive.', pending: 'Upload pending.', failed: 'Last upload failed.', conflict: 'Conflict: the Drive copy differs from the local version. Nothing has been overwritten.', synced: 'Backed up to Drive.' };
  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(''); try { await fn(); await load(); } catch (e) { setErr(errMsg(e)); } setBusy(false); }
  const noun = target.kind === 'project' ? 'project' : 'item';
  const review = () => run(async () => { downloadBlob(await api.download(target.id), `${target.title}.drive-copy${target.kind === 'project' ? '.json' : ''}`); pushNotice('Drive version downloaded for review. Your local copy was not changed.'); });
  return <Modal title="Google Drive backup" onClose={onClose}>
    <p className="text-sm font-medium text-slate-100">{target.title}</p>
    <p className="mt-2 text-sm text-slate-300" role="status">{st ? label[st.state] : err ? 'Status unavailable.' : 'Checking status…'}</p>
    {st?.lastSuccessAt && <p className="mt-1 text-xs text-slate-500">Last confirmed {new Date(st.lastSuccessAt).toLocaleString()}</p>}
    {st?.error && <p className="mt-1 text-xs text-amber-200">{st.error}</p>}
    {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
    {st?.state === 'conflict' ? <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[.05] p-3 text-xs text-amber-100">
      <p>Choose how to resolve it. Downloading lets you review the Drive version first; it never replaces local data.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={review}>Download Drive version to review</Button><Button disabled={busy} onClick={() => setConfirm('force')}>Replace Drive copy with local…</Button></div></div>
    : <label className="mt-4 flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-violet-500" />I allow Ayatrisya to upload this {noun} to my own Google Drive.</label>}
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      {st && st.state !== 'local' && <Button variant="outline" disabled={busy} onClick={() => setConfirm('remove')}>Remove Drive copy…</Button>}
      <Button variant="outline" disabled={busy || !(st?.state === 'synced' || st?.state === 'failed' || st?.state === 'pending')} onClick={review}>Download Drive copy</Button>
      <Button disabled={busy || !consent || st?.state === 'conflict'} onClick={() => run(() => api.sync(target.id))}>Back up now</Button>
    </div>
    <p className="mt-3 text-[11px] text-slate-500">Drive is optional and separate from this browser. If Google OAuth is not configured, the real error appears above. Deleting locally never deletes the Drive copy.</p>
    {confirm === 'force' && <ConfirmDialog danger title="Replace Drive copy" confirmLabel="Replace Drive copy" body={<>This overwrites the version on Google Drive with the local {noun}. The Drive version cannot be recovered from Ayatrisya. Download it first if you may need it.</>} onConfirm={async () => { setConfirm(null); await run(() => api.force(target.id)); }} onClose={() => setConfirm(null)} />}
    {confirm === 'remove' && <ConfirmDialog danger title="Remove Drive copy" confirmLabel="Remove from Drive" body={<>This deletes the backup of this {noun} from your Google Drive. The local copy in this browser stays.</>} onConfirm={async () => { setConfirm(null); await run(() => api.remove(target.id)); }} onClose={() => setConfirm(null)} />}
  </Modal>;
}

export function BulkMoveDialog({ items, onClose, onDone }: { items: ProjectItem[]; onClose: () => void; onDone: () => void }) {
  const projects = useLocalQuery(() => repository.listProjects({ limit: 200 }), []);
  const [to, setTo] = useState(''), [err, setErr] = useState('');
  return <Modal title={`Move ${items.length} item${items.length > 1 ? 's' : ''}`} onClose={onClose}>
    <label className="block text-xs text-slate-400">Project<select data-autofocus value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1.5`}><option value="">No project (Library only)</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
    <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={async () => { const prev = items.map((i) => [i.id, i.projectId] as const); try { for (const i of items) await repository.moveItem(i.id, to || null); pushNotice(`Moved ${items.length} item${items.length > 1 ? 's' : ''}.`, { label: 'Undo', run: async () => { for (const [id, p] of prev) try { await repository.moveItem(id, p); } catch (e) { pushNotice(`Undo failed: ${errMsg(e)}`); } } }); onDone(); onClose(); } catch (e) { setErr(errMsg(e)); } }}>Move</Button></div>
  </Modal>;
}

export function DeleteProjectDialog({ project, count, onDone, onClose }: { project: Pick<Project, 'id' | 'title'>; count?: number; onDone: () => void; onClose: () => void }) {
  const [policy, setPolicy] = useState<'retain' | 'delete'>('retain');
  return <ConfirmDialog danger title="Delete project" confirmLabel="Delete project" body={<div className="space-y-3"><p>Delete <b>{project.title}</b>{count !== undefined ? ` (${count} items)` : ''}? Choose what happens to its content.</p>
    <label className="flex gap-2"><input type="radio" name="policy" checked={policy === 'retain'} onChange={() => setPolicy('retain')} className="mt-1 accent-violet-500" /><span><b>Keep content in the Library.</b> Only the project is removed.</span></label>
    <label className="flex gap-2"><input type="radio" name="policy" checked={policy === 'delete'} onChange={() => setPolicy('delete')} className="mt-1 accent-violet-500" /><span><b>Delete everything.</b> Notes, documents and files inside are removed permanently.</span></label><p className="text-xs text-slate-500">Copies already backed up to Google Drive are not affected either way.</p></div>}
    onConfirm={async () => { try { await repository.deleteProject(project.id, policy); onDone(); } catch (e) { pushNotice(errMsg(e)); } onClose(); }} onClose={onClose} />;
}
