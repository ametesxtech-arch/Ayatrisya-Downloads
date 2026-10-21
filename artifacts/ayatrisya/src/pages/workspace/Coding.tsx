import { useState } from 'react';
import { Code2, Download, Plus } from 'lucide-react';
import { Button, EmptyPreview, LoadError, Modal, Notice, Skeleton, inputCls, areaCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { ItemList } from '@/components/ItemList';
import { DesktopButton } from '@/components/DesktopButton';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { downloadText, errMsg, safeName } from '@/lib/format';
import { DesktopProjectManager } from '@/components/DesktopProjectManager';
import { CodingPlanner } from '@/components/CodingPlanner';

export function CodingPage({ notify }: { notify: (m: string) => void }) {
  const list = useLocalQuery(() => repository.listItems({ kind: 'code', sort: 'date', limit: 300 }), []);
  const [open, setOpen] = useState(false), [title, setTitle] = useState(''), [spec, setSpec] = useState('## Goal\n\n## Files and constraints\n\n## Acceptance checks\n'), [err, setErr] = useState('');
  async function create() {
    try { await repository.saveItem({ title: title.trim() || 'Untitled coding task', kind: 'code', content: spec, tags: ['coding'] }); setOpen(false); setTitle(''); } catch (e) { setErr(errMsg(e)); }
  }
  const items = list.data ?? [];
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8">
    <PageHeading eyebrow="Coding" title="Build with an AI coding agent." description="Create coding specifications in the browser, or open a local project in Ayatrisya Desktop for an approval-based coding agent." actions={<><DesktopButton /><Button onClick={() => setOpen(true)}><Plus size={15} />New task</Button></>} />
    <CodingPlanner notify={notify} />
    <DesktopProjectManager />
    <Notice>Coding specifications are stored in this browser and exported as Markdown. Desktop project folders remain local and are never exposed to the website.</Notice>
    <div className="mt-6">
      {list.loading && !list.data && <Skeleton className="h-24" />}
      {list.error && <LoadError message={list.error} retry={list.refresh} />}
      {list.data && items.length === 0 && <EmptyPreview title="No coding tasks yet" detail="Create a task specification: the goal, constraints and acceptance checks." />}
      {items.length > 0 && <><ItemList items={items} notify={notify} />
        <Button variant="outline" className="mt-4" onClick={() => downloadText(items.map((i) => `# ${i.title}\n\n${i.content}`).join('\n\n---\n\n'), `${safeName('coding-tasks')}.md`, 'text/markdown')}><Download size={14} />Export all as Markdown</Button></>}
    </div>
    <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><Code2 size={14} />Use Ayatrisya Desktop for local folders and approved commands. The browser remains limited to browser storage.</p>
    {open && <Modal title="New coding task" onClose={() => setOpen(false)}><form onSubmit={(e) => { e.preventDefault(); void create(); }} className="space-y-4">
      <label className="block text-xs font-medium text-slate-400">Title<input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
      <label className="block text-xs font-medium text-slate-400">Specification<textarea value={spec} onChange={(e) => setSpec(e.target.value)} className={`${areaCls} mono mt-1.5 min-h-40`} /></label>
      {err && <p role="alert" className="text-xs text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Create task</Button></div></form></Modal>}
  </div>;
}
