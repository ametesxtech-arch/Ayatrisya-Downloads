import { useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { validateFile, validateFileContent } from '@/storage/files';
import { Search, Upload } from 'lucide-react';
import { Button, EmptyPreview, LoadError, Skeleton, inputCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { BulkMoveDialog } from '@/components/ItemDialogs';
import { ConfirmDialog } from '@/components/Primitives';
import { ItemList, kindLabel } from '@/components/ItemList';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import type { ItemKind } from '@/storage/types';
import { MAX_UPLOAD, errMsg, formatBytes } from '@/lib/format';

export function LibraryPage({ notify }: { notify: (m: string) => void }) {
  const [q, setQ] = useState(''), [kind, setKind] = useState<'' | ItemKind>(''), [project, setProject] = useState(''), [sort, setSort] = useState<'date' | 'name' | 'size'>('date'), [limit, setLimit] = useState(100);
  const search = useSearch(), [, setLoc] = useLocation(), [drag, setDrag] = useState(false);
  const itemParam = new URLSearchParams(search).get('item');
  const [sel, setSel] = useState<Set<string>>(new Set()), [bulk, setBulk] = useState<'move' | 'delete' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const projects = useLocalQuery(() => repository.listProjects({ limit: 200 }), []);
  const list = useLocalQuery(() => repository.listItems({ search: q || undefined, kind: kind || undefined, projectId: project === '' ? undefined : project === 'none' ? null : project, sort, limit }), [q, kind, project, sort, limit]);
  async function upload(files: FileList | File[] | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      try { validateFile(f); await validateFileContent(f); } catch (e) { notify(`${f.name}: ${errMsg(e)}`); continue; }
      if (f.size > MAX_UPLOAD) { notify(`${f.name} is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_UPLOAD)}.`); continue; }
      try { await repository.addFile(f, project && project !== 'none' ? project : null); notify(`Saved ${f.name} in this browser.`); } catch (e) { notify(`Could not store ${f.name}: ${errMsg(e)}`); }
    }
    if (input.current) input.current.value = '';
  }
  const items = list.data ?? [];
  const chosen = items.filter((i) => sel.has(i.id));
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const kinds = Object.entries(chosen.reduce<Record<string, number>>((m, i) => ({ ...m, [i.kind]: (m[i.kind] ?? 0) + 1 }), {})).map(([k, n]) => `${n} ${kindLabel[k as ItemKind].toLowerCase()}${n > 1 ? 's' : ''}`).join(', ');
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }} onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(Array.from(e.dataTransfer.files)); }}>
    {drag && <div className="pointer-events-none fixed inset-4 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-violet-300/60 bg-[#101116]/80 text-sm text-violet-100" role="status">Drop files to store them in this browser</div>}
   
    <PageHeading eyebrow="Library" title="Everything you have stored here." description="Notes, documents, slides and files kept in this browser. They are not uploaded anywhere."
      actions={<><input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} data-testid="input-upload" /><Button onClick={() => input.current?.click()}><Upload size={15} />Add files</Button></>} />
    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
      <label className="relative block"><span className="sr-only">Search library</span><Search size={15} className="absolute left-3 top-3.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or content" className={`${inputCls} pl-9`} /></label>
      <label><span className="sr-only">Filter by type</span><select value={kind} onChange={(e) => setKind(e.target.value as '' | ItemKind)} className={inputCls}><option value="">All types</option>{(Object.keys(kindLabel) as ItemKind[]).map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}</select></label>
      <label><span className="sr-only">Filter by project</span><select value={project} onChange={(e) => setProject(e.target.value)} className={inputCls}><option value="">All projects</option><option value="none">No project</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label><span className="sr-only">Sort</span><select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'name' | 'size')} className={inputCls}><option value="date">Newest</option><option value="name">Name</option><option value="size">Size</option></select></label>
    </div>
    {list.loading && !list.data && <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
    {list.error && <LoadError message={list.error} retry={list.refresh} />}
    {list.data && items.length === 0 && <EmptyPreview title={q || kind || project ? 'Nothing matches these filters' : 'Your library is empty'} detail={q || kind || project ? 'Adjust the search or filters.' : 'Add a file, or write a document or note. Everything you create appears here.'} />}
    {items.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[.07] bg-[#15171e] p-2 text-xs">
      <label className="flex items-center gap-2 px-2"><input type="checkbox" className="accent-violet-500" checked={chosen.length === items.length} onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} />Select all shown</label>
      <span aria-live="polite" className="text-slate-400">{chosen.length} selected</span>
      <span className="ml-auto flex gap-2"><Button variant="outline" disabled={!chosen.length} onClick={() => setBulk('move')}>Move</Button><Button variant="outline" disabled={!chosen.length} onClick={() => setBulk('delete')} data-testid="button-bulk-delete-items">Delete selected</Button></span></div>}
    {bulk === 'move' && <BulkMoveDialog items={chosen} onClose={() => setBulk(null)} onDone={() => setSel(new Set())} />}
    {bulk === 'delete' && <ConfirmDialog danger title={`Delete ${chosen.length} items`} confirmLabel={`Delete ${chosen.length}`} body={<>Permanently delete {kinds} from this browser, including stored file data? This cannot be undone. Copies already backed up to Google Drive are not affected.</>} onConfirm={async () => { try { await repository.deleteItems(chosen.map((i) => i.id)); setSel(new Set()); notify(`Deleted ${chosen.length} items.`); } catch (e) { notify(errMsg(e)); } setBulk(null); }} onClose={() => setBulk(null)} />}
    {(items.length > 0 || itemParam) && <ItemList selected={sel} onToggle={toggle} items={items} notify={notify} autoOpenId={itemParam} onOpenChange={(id) => { if (!id && itemParam) setLoc('/workspace/library'); }} />}
    {items.length >= limit && <Button variant="outline" className="mt-4" onClick={() => setLimit(limit + 100)}>Load more</Button>}
  </div>;
}
