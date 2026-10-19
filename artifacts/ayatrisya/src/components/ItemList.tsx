import { useEffect, useState } from 'react';
import { Code2, File as FileIcon, FileText, ListChecks, Presentation, StickyNote } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/Primitives';
import { ItemEditor } from '@/components/ItemEditors';
import { PreviewModal } from '@/components/AttachmentPreview';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { downloadBlob } from '@/storage/backup';
import type { ItemKind, ProjectItem } from '@/storage/types';
import { ActionMenu, useContextMenu, type MenuItem } from '@/components/Menus';
import { DriveDialog, MoveDialog, TextFileDialog, isTextFile } from '@/components/ItemDialogs';
import { pushNotice } from '@/lib/notify';
import { confirmDiscard } from '@/lib/dirty';
import { ago, downloadText, errMsg, formatBytes, safeName } from '@/lib/format';

export const kindLabel: Record<ItemKind, string> = { note: 'Note', document: 'Document', presentation: 'Presentation', file: 'File', task: 'Task', code: 'Coding task' };
const icons: Record<ItemKind, typeof FileText> = { note: StickyNote, document: FileText, presentation: Presentation, file: FileIcon, task: ListChecks, code: Code2 };

export function ItemList({ items, notify, autoOpenId, onOpenChange, selected, onToggle }: { selected?: Set<string>; onToggle?: (id: string) => void; items: ProjectItem[]; notify: (m: string) => void; autoOpenId?: string | null; onOpenChange?: (id: string | null) => void }) {
  const atts = useLocalQuery(() => repository.listAttachments(), []);
  const map = new Map((atts.data ?? []).map((a) => [a.id, a]));
  const [openId, setOpenIdRaw] = useState<string | null>(autoOpenId ?? null);
  const setOpenId = (v: string | null) => { setOpenIdRaw(v); onOpenChange?.(v); };
  useEffect(() => { if (autoOpenId) setOpenIdRaw(autoOpenId); }, [autoOpenId]);
  const extra = useLocalQuery(() => (openId && !items.some((x) => x.id === openId) ? repository.getItem(openId) : Promise.resolve(undefined)), [openId]);
  const [move, setMove] = useState<ProjectItem | null>(null), [edit, setEdit] = useState<ProjectItem | null>(null), [drive, setDrive] = useState<ProjectItem | null>(null);
  const ctx = useContextMenu();
  const [del, setDel] = useState<ProjectItem | null>(null);
  const [ren, setRen] = useState<ProjectItem | null>(null);
  const [name, setName] = useState('');
  const open = items.find((i) => i.id === openId) ?? extra.data ?? undefined;
  async function download(i: ProjectItem) {
    try {
      if (i.kind === 'file' && i.attachmentId) {
        const b = await repository.getFile(i.attachmentId);
        if (!b) { notify('File data is not available locally.'); return; }
        downloadBlob(b, map.get(i.attachmentId)?.name ?? i.title);
      } else downloadText(i.kind === 'presentation' ? i.content : `# ${i.title}\n\n${i.content}`, `${safeName(i.title)}.${i.kind === 'presentation' ? 'json' : 'md'}`);
    } catch (e) { notify(errMsg(e)); }
  }
  async function remove(i: ProjectItem) {
    try {
      if (i.attachmentId) await repository.deleteAttachment(i.attachmentId);
      await repository.deleteItem(i.id).catch(() => undefined);
      notify('Deleted from this browser.');
      setDel(null);
    } catch (e) { notify(errMsg(e)); }
  }
  async function rename() {
    if (!ren || !name.trim()) return;
    try {
      await repository.saveItem({ id: ren.id, title: name.trim(), kind: ren.kind, content: ren.content, projectId: ren.projectId, tags: ren.tags, completed: ren.completed });
      setRen(null);
    } catch (e) { notify(errMsg(e)); }
  }
  const menu = (i: ProjectItem): MenuItem[] => {
    const a = i.attachmentId ? map.get(i.attachmentId) : undefined;
    return [
      { label: 'Open', onSelect: () => setOpenId(i.id) },
      ...(i.kind === 'file' && a && isTextFile(a.name) ? [{ label: 'Edit text', onSelect: () => setEdit(i) }] : []),
      { label: 'Rename', onSelect: () => { setRen(i); setName(i.title); } },
      { label: 'Duplicate', onSelect: () => { repository.duplicateItem(i.id, i.projectId).then(() => notify('Duplicated.'), (e) => notify(errMsg(e))); } },
      { label: 'Move to project…', onSelect: () => setMove(i) },
      ...(i.projectId ? [{ label: 'Remove from project', onSelect: () => { const prev = i.projectId; repository.moveItem(i.id, null).then(() => pushNotice('Removed from project. It is still in the Library.', { label: 'Undo', run: () => repository.moveItem(i.id, prev).catch((e) => notify(errMsg(e))) }), (e) => notify(errMsg(e))); } }] : []),
      { label: 'Download', onSelect: () => void download(i) },
      { label: 'Google Drive…', onSelect: () => setDrive(i) },
      { label: 'Delete', danger: true, onSelect: () => setDel(i) },
    ];
  };
  return <>
    <ul className="stagger divide-y divide-white/[.06] rounded-xl border border-white/[.075] bg-[#15171e]">
      {items.map((i) => {
        const Icon = icons[i.kind]; const a = i.attachmentId ? map.get(i.attachmentId) : undefined;
        return <li key={i.id} onContextMenu={ctx.open(menu(i))} className="flex items-center gap-3 p-3" data-testid={`row-item-${i.id}`}>
          {onToggle && <input type="checkbox" aria-label={`Select ${i.title}`} checked={selected?.has(i.id) ?? false} onChange={() => onToggle(i.id)} className="accent-violet-500" />}
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-300/[.07] text-violet-200"><Icon size={16} /></span>
          <button onClick={() => setOpenId(i.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-slate-100">{i.title}</span>
            <span className="block truncate text-[11px] text-slate-500">{kindLabel[i.kind]}{a ? ` · ${formatBytes(a.size)}` : ''} · {ago(i.updatedAt)}{i.kind === 'file' && !a && !atts.loading ? ' · metadata only, file data not found' : ''}</span></button>
          <ActionMenu label={`Actions for ${i.title}`} items={menu(i)} />
        </li>;
      })}
    </ul>
    {open && open.kind === 'file' && open.attachmentId && map.get(open.attachmentId) && <PreviewModal attachment={map.get(open.attachmentId)!} onClose={() => setOpenId(null)} />}
    {open && open.kind === 'file' && !(open.attachmentId && map.get(open.attachmentId)) && <Modal title={open.title} onClose={() => setOpenId(null)}><p className="text-sm text-slate-400">This item exists only as a record. Its file data is not stored in this browser.</p></Modal>}
    {open && open.kind !== 'file' && <Modal title={`Edit ${kindLabel[open.kind].toLowerCase()}`} wide onClose={() => { if (confirmDiscard()) setOpenId(null); }}><ItemEditor key={open.id} item={open} onClose={() => setOpenId(null)} /></Modal>}
    {ctx.node}{move && <MoveDialog item={move} onClose={() => setMove(null)} />}{edit && <TextFileDialog item={edit} onClose={() => setEdit(null)} />}{drive && <DriveDialog target={{ kind: 'item', id: drive.id, title: drive.title }} onClose={() => setDrive(null)} />}
    {del && <ConfirmDialog danger title="Delete item" confirmLabel="Delete" body={<>Delete <b>{del.title}</b> from this browser? This cannot be undone. Copies already backed up to Google Drive are not affected.</>} onConfirm={() => remove(del)} onClose={() => setDel(null)} />}
    {ren && <Modal title="Rename" onClose={() => setRen(null)}><form onSubmit={(e) => { e.preventDefault(); void rename(); }}><label className="block text-xs text-slate-400">Name<input data-autofocus value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm text-white" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRen(null)} className="h-10 rounded-lg px-4 text-sm text-slate-300 hover:bg-white/10">Cancel</button><button type="submit" className="h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white">Rename</button></div></form></Modal>}
  </>;
}
