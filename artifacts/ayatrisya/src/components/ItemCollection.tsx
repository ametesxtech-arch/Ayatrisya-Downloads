import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button, EmptyPreview, LoadError, Modal, Skeleton, inputCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { ItemEditor } from '@/components/ItemEditors';
import { ItemList } from '@/components/ItemList';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import type { ItemKind } from '@/storage/types';
import { errMsg } from '@/lib/format';

export type Template = { name: string; description: string; content: string };

export function ItemCollection({ kind, tag, eyebrow, heading, description, noun, templates, openId, onOpen, notify }: {
  kind: ItemKind; tag?: string; eyebrow: string; heading: string; description: string; noun: string; templates: Template[];
  openId?: string | null; onOpen?: (id: string | null) => void; notify: (m: string) => void;
}) {
  const [q, setQ] = useState(''), [creating, setCreating] = useState(false), [title, setTitle] = useState(''), [tpl, setTpl] = useState(0), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [localOpen, setLocalOpen] = useState<string | null>(null);
  const current = openId !== undefined ? openId : localOpen;
  const setOpen = (id: string | null) => (onOpen ? onOpen(id) : setLocalOpen(id));
  const list = useLocalQuery(async () => {
    const all = await repository.listItems({ kind, search: q || undefined, sort: 'date', limit: 300 });
    return tag ? all.filter((i) => i.tags.includes(tag)) : all;
  }, [kind, q, tag]);
  const item = useLocalQuery(() => (current ? repository.getItem(current) : Promise.resolve(undefined)), [current]);
  async function create() {
    setBusy(true); setErr('');
    try {
      const it = await repository.saveItem({ title: title.trim() || `Untitled ${noun}`, kind, content: templates[tpl]?.content ?? '', tags: tag ? [tag] : [] });
      setCreating(false); setTitle(''); setOpen(it.id);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  if (current) {
    if (item.loading && !item.data) return <div className="mx-auto max-w-[1000px] p-4 sm:p-8"><Skeleton className="h-64" /></div>;
    if (!item.data) return <div className="mx-auto max-w-[1000px] p-4 sm:p-8"><EmptyPreview title={`This ${noun} was not found`} detail="It may have been deleted or belongs to a different account in this browser." /><Button className="mt-4" onClick={() => setOpen(null)}>Back to list</Button></div>;
    return <div className="mx-auto max-w-[1000px] p-4 sm:p-8"><ItemEditor key={item.data.id} item={item.data} onClose={() => setOpen(null)} /></div>;
  }
  const items = list.data ?? [];
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8">
    <PageHeading eyebrow={eyebrow} title={heading} description={description} actions={<Button onClick={() => setCreating(true)} data-testid="button-new"><Plus size={15} />New {noun}</Button>} />
    <label className="relative mb-4 block"><span className="sr-only">Search {noun}s</span><Search size={15} className="absolute left-3 top-3.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${noun}s`} className={`${inputCls} pl-9`} /></label>
    {list.loading && !list.data && <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
    {list.error && <LoadError message={list.error} retry={list.refresh} />}
    {list.data && items.length === 0 && <EmptyPreview title={q ? `No ${noun}s match` : `No ${noun}s yet`} detail={q ? 'Try a different search.' : `Create your first ${noun}. It is saved in this browser and survives a refresh.`} />}
    {items.length > 0 && <ItemList items={items.map((i) => i)} notify={notify} />}
    {creating && <Modal title={`New ${noun}`} onClose={() => setCreating(false)}>
      <form onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <label className="block text-xs font-medium text-slate-400">Title<input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Untitled ${noun}`} className={`${inputCls} mt-1.5`} /></label>
        <fieldset className="mt-4"><legend className="text-xs font-medium text-slate-400">Starting point</legend><div className="mt-2 space-y-2">
          {templates.map((t, i) => <label key={t.name} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${tpl === i ? 'border-violet-400/40 bg-violet-400/[.07]' : 'border-white/[.08]'}`}><input type="radio" name="tpl" checked={tpl === i} onChange={() => setTpl(i)} className="mt-1 accent-violet-500" /><span><span className="block text-sm font-medium">{t.name}</span><span className="text-xs text-slate-500">{t.description}</span></span></label>)}
        </div></fieldset>
        {err && <p role="alert" className="mt-3 text-xs text-rose-300">{err}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : `Create ${noun}`}</Button></div>
      </form>
    </Modal>}
  </div>;
}
