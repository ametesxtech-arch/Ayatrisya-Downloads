import { useState, type ReactNode } from 'react';
import { ConfirmDialog, Modal, Button, inputCls } from '@/components/Primitives';
import type { MenuItem } from '@/components/Menus';
import { repository } from '@/storage/repository';
import { exportConversation, downloadBlob } from '@/storage/backup';
import type { Conversation } from '@/storage/types';
import { errMsg, safeName } from '@/lib/format';
import { pushNotice } from '@/lib/notify';

export function RenameDialog({ title, initial, onSubmit, onClose }: { title: string; initial: string; onSubmit: (v: string) => Promise<void>; onClose: () => void }) {
  const [v, setV] = useState(initial), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  return <Modal title={title} onClose={onClose}><form onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) { setErr('Enter a name.'); return; } setBusy(true); try { await onSubmit(v.trim()); onClose(); } catch (er) { setErr(errMsg(er)); setBusy(false); } }}>
    <input data-autofocus aria-label="Name" value={v} onChange={(e) => setV(e.target.value)} className={inputCls} />
    {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
    <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div></form></Modal>;
}

export function useConvActions({ notify, goto, onDeleted }: { notify: (m: string) => void; goto: (h: string) => void; onDeleted?: (ids: string[]) => void }) {
  const [rename, setRename] = useState<Conversation | null>(null), [del, setDel] = useState<Conversation[] | null>(null), [clear, setClear] = useState<Conversation | null>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => { try { await fn(); if (ok) notify(ok); return true; } catch (e) { notify(errMsg(e)); return false; } };
  const items = (c: Conversation): MenuItem[] => [
    { label: 'Open', onSelect: () => goto(`/workspace/chat/${c.id}`) },
    { label: 'Rename', onSelect: () => setRename(c) },
    { label: c.pinned ? 'Unpin' : 'Pin to top', onSelect: () => run(() => repository.updateConversation(c.id, { pinned: !c.pinned })) },
    { label: c.archived ? 'Restore from archive' : 'Archive', onSelect: () => run(async () => { await repository.updateConversation(c.id, { archived: !c.archived }); pushNotice(c.archived ? 'Conversation restored.' : 'Conversation archived.', { label: 'Undo', run: () => repository.updateConversation(c.id, { archived: c.archived }).catch((e) => notify(errMsg(e))) }); }) },
    { label: 'Duplicate', onSelect: () => run(async () => { const d = await repository.duplicateConversation(c.id); pushNotice('Conversation duplicated.', { label: 'Open', run: () => goto(`/workspace/chat/${d.id}`) }); }) },
    { label: 'Export as JSON', onSelect: () => run(async () => downloadBlob(await exportConversation(c.id), `${safeName(c.title)}.conversation.json`), 'Conversation exported. The file contains private data and is not encrypted.') },
    { divider: true, label: '', onSelect: () => undefined },
    { label: 'Clear messages', onSelect: () => setClear(c) },
    { label: 'Delete', danger: true, onSelect: () => setDel([c]) },
  ];
  const dialogs: ReactNode = <>
    {rename && <RenameDialog title="Rename conversation" initial={rename.title} onClose={() => setRename(null)} onSubmit={(v) => repository.renameConversation(rename.id, v)} />}
    {clear && <ConfirmDialog danger title="Clear conversation" confirmLabel="Clear messages" body={<>Remove every message and attached file from <b>{clear.title}</b>? The conversation itself stays. This cannot be undone. Drive copies are not affected.</>} onConfirm={async () => { if (await run(() => repository.clearConversation(clear.id), 'Conversation cleared.')) setClear(null); }} onClose={() => setClear(null)} />}
    {del && <ConfirmDialog danger title={del.length === 1 ? 'Delete conversation' : `Delete ${del.length} conversations`} confirmLabel={`Delete ${del.length}`} body={<>This permanently deletes {del.length === 1 ? <b>{del[0].title}</b> : `${del.length} conversations`}, their messages, and files attached in {del.length === 1 ? 'it' : 'them'}, including the matching Library entries. This cannot be undone. Export first if you may need a copy. Copies already backed up to Google Drive are not affected.</>} onConfirm={async () => { const ids = del.map((c) => c.id); if (await run(() => repository.deleteConversations(ids), `Deleted ${ids.length} conversation${ids.length > 1 ? 's' : ''}.`)) { onDeleted?.(ids); setDel(null); } }} onClose={() => setDel(null)} />}
  </>;
  return { items, dialogs, askDelete: (c: Conversation[]) => setDel(c), run };
}
