import { useState } from 'react';
import { Link } from 'wouter';
import { Archive, Pin } from 'lucide-react';
import { Button, EmptyPreview, LoadError, Skeleton, inputCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { ActionMenu, useContextMenu } from '@/components/Menus';
import { useConvActions } from '@/hooks/use-conv-actions';
import { usePrefs } from '@/hooks/use-prefs';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { ago, errMsg } from '@/lib/format';
import { Switch } from '@/components/Primitives';

export function HistoryPage({ goto, notify }: { goto: (h: string) => void; notify: (m: string) => void }) {
  const { prefs, save } = usePrefs();
  const [archived, setArchived] = useState(false), [q, setQ] = useState(''), [sel, setSel] = useState<Set<string>>(new Set());
  const list = useLocalQuery(() => repository.listConversations({ archived, search: q || undefined, sort: prefs.historySort, pinnedFirst: prefs.historyPinnedFirst, limit: 1000 }), [archived, q, prefs.historySort, prefs.historyPinnedFirst]);
  const acts = useConvActions({ notify, goto, onDeleted: () => setSel(new Set()) });
  const ctx = useContextMenu();
  const rows = list.data ?? [];
  const chosen = rows.filter((c) => sel.has(c.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function bulkArchive() { try { await Promise.all(chosen.map((c) => repository.updateConversation(c.id, { archived: !archived }))); setSel(new Set()); notify(`${archived ? 'Restored' : 'Archived'} ${chosen.length}.`); } catch (e) { notify(errMsg(e)); } }
  return <div className="mx-auto max-w-[900px] p-4 sm:p-8">
    <PageHeading eyebrow="History" title="Every conversation, in order." description="Manage the conversations stored in this browser. Pin, archive, duplicate, export or delete them." actions={<Link href="/workspace" className="inline-flex h-10 items-center rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white">New chat</Link>} />
    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <label><span className="sr-only">Search conversations</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and messages" className={inputCls} /></label>
      <label><span className="sr-only">Sort</span><select value={prefs.historySort} onChange={(e) => void save({ historySort: e.target.value as 'newest' | 'oldest' | 'title' })} className={inputCls}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A to Z</option></select></label>
      <label><span className="sr-only">View</span><select value={archived ? 'a' : 'x'} onChange={(e) => { setArchived(e.target.value === 'a'); setSel(new Set()); }} className={inputCls}><option value="x">Active</option><option value="a">Archived</option></select></label>
    </div>
    <Switch label="Keep pinned conversations at the top" checked={prefs.historyPinnedFirst} onChange={(v) => void save({ historyPinnedFirst: v })} />
    {rows.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[.07] bg-[#15171e] p-2 text-xs">
      <label className="flex items-center gap-2 px-2"><input type="checkbox" className="accent-violet-500" checked={chosen.length === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((c) => c.id)) : new Set())} />Select all</label>
      <span aria-live="polite" className="text-slate-400">{chosen.length} selected</span>
      <span className="ml-auto flex gap-2"><Button variant="outline" disabled={!chosen.length} onClick={bulkArchive}>{archived ? 'Restore' : 'Archive'}</Button><Button variant="outline" disabled={!chosen.length} onClick={() => acts.askDelete(chosen)} data-testid="button-bulk-delete">Delete selected</Button></span>
    </div>}
    {list.loading && !list.data && <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
    {list.error && <LoadError message={list.error} retry={list.refresh} />}
    {list.data && rows.length === 0 && <EmptyPreview title={archived ? 'No archived conversations' : q ? 'No conversations match' : 'No conversations yet'} detail={archived ? 'Archived conversations appear here and can be restored.' : 'Start a chat. It is saved in this browser.'} />}
    <ul className="stagger divide-y divide-white/[.06] rounded-xl border border-white/[.075] bg-[#15171e]">
      {rows.map((c) => <li key={c.id} onContextMenu={ctx.open(acts.items(c))} className="flex items-center gap-3 p-3">
        <input type="checkbox" aria-label={`Select ${c.title}`} checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="accent-violet-500" />
        <Link href={`/workspace/chat/${c.id}`} className="min-w-0 flex-1"><span className="flex items-center gap-2 truncate text-sm font-medium">{c.pinned && <Pin size={12} className="text-violet-300" aria-label="Pinned" />}{c.archived && <Archive size={12} className="text-slate-500" aria-label="Archived" />}<span className="truncate">{c.title}</span></span><span className="text-[11px] text-slate-500">Updated {ago(c.updatedAt)}</span></Link>
        <ActionMenu label={`Actions for ${c.title}`} items={acts.items(c)} />
      </li>)}
    </ul>
    {acts.dialogs}{ctx.node}
  </div>;
}
