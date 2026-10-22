import { useRef, useState } from 'react';
import { Archive, Code2, Download, MoreHorizontal, Plus } from 'lucide-react';
import { Button, EmptyPreview, LoadError, Modal, Notice, Skeleton, inputCls, areaCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { ItemList } from '@/components/ItemList';
import { DesktopButton } from '@/components/DesktopButton';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { downloadText, errMsg, formatBytes, MAX_UPLOAD, safeName } from '@/lib/format';
import { DesktopProjectManager } from '@/components/DesktopProjectManager';
import { CodingPlanner } from '@/components/CodingPlanner';
import { ActionMenu } from '@/components/Menus';

export function CodingPage({ notify }: { notify: (m: string) => void }) {
  const list = useLocalQuery(() => repository.listItems({ kind: 'code', sort: 'date', limit: 300 }), []);
  const [open, setOpen] = useState(false), [title, setTitle] = useState(''), [spec, setSpec] = useState('## Goal\n\n## Files and constraints\n\n## Acceptance checks\n'), [err, setErr] = useState('');
  const zipInput = useRef<HTMLInputElement>(null);
  async function create() {
    try { await repository.saveItem({ title: title.trim() || 'Untitled coding task', kind: 'code', content: spec, tags: ['coding'] }); setOpen(false); setTitle(''); } catch (e) { setErr(errMsg(e)); }
  }
  const items = list.data ?? [];
  async function uploadZip(file?: File) {
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      notify(`${file.name} is larger than the ${formatBytes(MAX_UPLOAD)} upload limit.`);
      if (zipInput.current) zipInput.current.value = '';
      return;
    }
    let attachmentId: string | undefined;
    try {
      const attachment = await repository.addFile(file);
      attachmentId = attachment.id;
      await repository.saveItem({
        title: `Review ${file.name}`,
        kind: 'code',
        attachmentId: attachment.id,
        tags: ['coding', 'zip-archive'],
        content: `## Goal\nReview the attached project archive: ${file.name}\n\n## Files and constraints\nThe ZIP is stored in this browser's Library and has not been extracted or executed. Open a local project folder in Ayatrisya Desktop to work directly with files.\n\n## Acceptance checks\n- Review the archive contents safely before using them.\n- Do not run files from the archive without reviewing them first.`,
      });
      notify(`Saved ${file.name} in this browser and created a coding task. The ZIP was not extracted or sent to a model.`);
    } catch (error) {
      if (attachmentId) await repository.deleteAttachment(attachmentId).catch(() => undefined);
      notify(errMsg(error, 'Could not save this ZIP archive.'));
    } finally {
      if (zipInput.current) zipInput.current.value = '';
    }
  }
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8">
    <PageHeading eyebrow="Coding" title="Build with an AI coding agent." description="Create coding specifications in the browser, or open a local project in Ayatrisya Desktop for an approval-based coding agent." actions={<><input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={(event) => void uploadZip(event.target.files?.[0])} data-testid="input-coding-zip" /><DesktopButton /><Button variant="outline" onClick={() => zipInput.current?.click()}><Archive size={15} />Upload ZIP</Button><Button onClick={() => setOpen(true)}><Plus size={15} />New task</Button><ActionMenu label="Other coding actions" items={[{ label: 'Upload ZIP archive', hint: '10 MB max', onSelect: () => zipInput.current?.click() }, { label: 'Export all tasks as Markdown', disabled: !items.length, onSelect: () => downloadText(items.map((i) => `# ${i.title}\n\n${i.content}`).join('\n\n---\n\n'), `${safeName('coding-tasks')}.md`, 'text/markdown') }, { label: 'Create a coding task', onSelect: () => setOpen(true) }]}><MoreHorizontal size={17} /></ActionMenu></>} />
    <DesktopProjectManager />
    <CodingPlanner notify={notify} />
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
