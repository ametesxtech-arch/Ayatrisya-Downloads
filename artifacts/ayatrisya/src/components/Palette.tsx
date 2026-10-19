import { useEffect, useRef, useState } from 'react';
import { Check, FileText, FolderKanban, MessageSquare, Pencil, Search, Trash2, X } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/Primitives';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { errMsg } from '@/lib/format';
import { DeleteProjectDialog } from '@/components/ItemDialogs';

export type Command = { id: string; label: string; hint?: string; run: () => void };
const filters: Array<[string, string, string[] | undefined]> = [
  ['all', 'All', undefined], ['chat', 'Chats', ['conversation']], ['project', 'Projects', ['project']], ['document', 'Documents', ['document']],
  ['note', 'Notes', ['note']], ['file', 'Files', ['file']], ['slides', 'Slides', ['presentation']], ['task', 'Tasks', ['task', 'code']],
];

export function Palette({ commands, goto, notify, onClose }: { commands: Command[]; goto: (h: string) => void; notify: (m: string) => void; onClose: () => void }) {
  const [q, setQ] = useState(''), [dq, setDq] = useState(''), [filter, setFilter] = useState('all'), [active, setActive] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null), [rv, setRv] = useState(''), [del, setDel] = useState<{ id: string; title: string; resource: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = window.setTimeout(() => setDq(q.trim()), 180); return () => window.clearTimeout(t); }, [q]);
  const types = filters.find((f) => f[0] === filter)?.[2];
  const res = useLocalQuery(() => (dq ? repository.searchAll(dq, { types, limit: 30 }) : Promise.resolve([])), [dq, filter]);
  const cmds = filter === 'all' ? commands.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase())) : [];
  const results = res.data ?? [];
  const total = cmds.length + results.length;
  useEffect(() => setActive(0), [dq, filter]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const open = (i: number) => { if (i < cmds.length) { onClose(); cmds[i].run(); } else { const r = results[i - cmds.length]; if (r) { goto(r.href); onClose(); } } };
  async function commitRename(r: (typeof results)[number]) {
    const v = rv.trim(); if (!v) return;
    try {
      if (r.resource === 'conversation') await repository.renameConversation(r.id, v);
      else if (r.resource === 'project') await repository.updateProject(r.id, { title: v });
      else { const it = await repository.getItem(r.id); if (it) await repository.saveItem({ id: it.id, title: v, kind: it.kind, content: it.content, projectId: it.projectId, tags: it.tags, completed: it.completed }); }
      setRenaming(null); res.refresh();
    } catch (e) { notify(errMsg(e)); }
  }
  async function doDelete() {
    if (!del || del.resource === 'project') return;
    try { if (del.resource === 'conversation') await repository.deleteConversation(del.id); else await repository.deleteItem(del.id); notify('Deleted.'); } catch (e) { notify(errMsg(e)); }
    setDel(null);
  }
  const Icon = (t: string) => (t === 'conversation' ? MessageSquare : t === 'project' ? FolderKanban : FileText);
  return <Modal title="Search and commands" wide onClose={onClose}>
    <div role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-controls="palette-list" className="relative">
      <Search size={16} className="absolute left-3 top-3.5 text-slate-500" />
      <input data-autofocus aria-label="Search your workspace" aria-activedescendant={total ? `pal-${active}` : undefined} value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (total ? (a + 1) % total : 0)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (total ? (a - 1 + total) % total : 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); open(active); }
          else if (e.key === 'F2' && active >= cmds.length) { const r = results[active - cmds.length]; if (r) { setRenaming(r.id); setRv(r.title); } }
        }}
        placeholder="Search chats, projects, documents, files, or type a command" className="h-12 w-full rounded-lg border border-white/10 bg-[#101116] pl-10 pr-10 text-sm text-white placeholder:text-slate-500" />
      {q && <button aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2 top-2.5 grid size-7 place-items-center rounded text-slate-400 hover:bg-white/10"><X size={14} /></button>}
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Result type">
      {filters.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[11px] ${filter === k ? 'border-violet-400/50 bg-violet-400/15 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>{l}</button>)}
    </div>
    <div ref={listRef} id="palette-list" role="listbox" aria-label="Results" className="mt-3 max-h-[50vh] overflow-y-auto">
      {cmds.length > 0 && <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Commands</p>}
      {cmds.map((c, i) => <div key={c.id} id={`pal-${i}`} role="option" aria-selected={active === i} data-active={active === i} onMouseMove={() => setActive(i)} onClick={() => open(i)} className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm ${active === i ? 'bg-white/[.08]' : ''}`}>{c.label}{c.hint && <kbd className="rounded border border-white/10 px-1.5 text-[10px] text-slate-500">{c.hint}</kbd>}</div>)}
      {dq && <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Results</p>}
      {res.loading && dq && !res.data && <div className="m-2 h-10 animate-pulse rounded bg-white/[.05]" />}
      {res.error && <p role="alert" className="p-3 text-xs text-rose-300">Search failed: {res.error}</p>}
      {dq && res.data && results.length === 0 && <p className="p-5 text-center text-xs text-slate-500" data-testid="search-empty">Nothing matches "{dq}"{filter !== 'all' ? ' in this type' : ''}.</p>}
      {results.map((r, j) => { const i = cmds.length + j; const I = Icon(r.resource); return <div key={`${r.resource}-${r.id}`} id={`pal-${i}`} role="option" aria-selected={active === i} data-active={active === i} onMouseMove={() => setActive(i)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 ${active === i ? 'bg-white/[.08]' : ''}`}>
        <I size={15} className="shrink-0 text-violet-300" />
        {renaming === r.id ? <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); void commitRename(r); }}><input data-autofocus aria-label="New name" value={rv} onChange={(e) => setRv(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} className="h-8 flex-1 rounded border border-white/10 bg-[#101116] px-2 text-sm" /><button aria-label="Save name" className="text-teal-300"><Check size={15} /></button></form>
          : <button onClick={() => open(i)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm">{r.title}</span><span className="block truncate text-[11px] text-slate-500">{r.type} · {r.snippet}</span></button>}
        {renaming !== r.id && <span className="flex opacity-70 group-hover:opacity-100">
          <button aria-label={`Rename ${r.title}`} onClick={() => { setRenaming(r.id); setRv(r.title); }} className="grid size-8 place-items-center rounded text-slate-400 hover:bg-white/10"><Pencil size={13} /></button>
          <button aria-label={`Delete ${r.title}`} onClick={() => setDel({ id: r.id, title: r.title, resource: r.resource })} className="grid size-8 place-items-center rounded text-slate-400 hover:bg-white/10"><Trash2 size={13} /></button>
        </span>}
      </div>; })}
    </div>
    <p className="mt-3 border-t border-white/[.07] pt-3 text-[11px] text-slate-500">Arrow keys to move, Enter to open, F2 to rename. Search runs on this browser only.</p>
    {del && del.resource === 'project' && <DeleteProjectDialog project={{ id: del.id, title: del.title }} onDone={() => { notify('Project deleted.'); res.refresh(); }} onClose={() => setDel(null)} />}
    {del && del.resource !== 'project' && <ConfirmDialog danger title="Delete" confirmLabel="Delete" body={<>Delete <b>{del.title}</b> from this browser? This cannot be undone. Drive copies are not affected.</>} onConfirm={doDelete} onClose={() => setDel(null)} />}
  </Modal>;
}
