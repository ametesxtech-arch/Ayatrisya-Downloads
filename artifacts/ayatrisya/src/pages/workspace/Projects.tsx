import { useEffect, useRef, useState } from 'react';
import { BookOpen, Code2, LayoutGrid, List, Music2, Orbit, Pin, ArrowLeft, Download, FilePlus2, FolderKanban, Pencil, Plus, Search, StickyNote, Trash2, Upload } from 'lucide-react';
import { Button, ConfirmDialog, EmptyPreview, IconButton, LoadError, Modal, Skeleton, inputCls, areaCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { ItemList } from '@/components/ItemList';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import type { Project } from '@/storage/types';
import { MAX_UPLOAD, ago, downloadText, errMsg, formatBytes, safeName } from '@/lib/format';
import { Link, useSearch } from 'wouter';
import { exportProject as exportProjectBlob, downloadBlob } from '@/storage/backup';
import { DeleteProjectDialog, DriveBadge, DriveDialog } from '@/components/ItemDialogs';
import { usePrefs } from '@/hooks/use-prefs';
import { pushNotice } from '@/lib/notify';
import { ActionMenu, useContextMenu, type MenuItem } from '@/components/Menus';

const colors = { violet: 'text-violet-200 bg-violet-400/15', cyan: 'text-cyan-200 bg-cyan-400/15', rose: 'text-rose-200 bg-rose-400/15', amber: 'text-amber-200 bg-amber-400/15', emerald: 'text-emerald-200 bg-emerald-400/15' } as const;
const icons = { folder: FolderKanban, code: Code2, book: BookOpen, music: Music2, orbit: Orbit } as const;


function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved?: (p?: Project) => void }) {
  const [title, setTitle] = useState(project?.title ?? ''), [description, setDescription] = useState(project?.description ?? ''), [tags, setTags] = useState(project?.tags.join(', ') ?? ''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [color, setColor] = useState<Project['color']>(project?.color ?? 'violet'), [icon, setIcon] = useState<Project['icon']>(project?.icon ?? 'folder'), [pinned, setPinned] = useState(project?.pinned ?? false);
  async function submit() {
    if (!title.trim()) { setErr('Give the project a title.'); return; }
    setBusy(true); setErr('');
    const t = tags.split(',').map((x) => x.trim()).filter(Boolean);
    try {
      if (project) { await repository.updateProject(project.id, { title: title.trim(), description, tags: t, color, icon, pinned }); onSaved?.(); }
      else onSaved?.(await repository.createProject({ title: title.trim(), description, tags: t, color, icon, pinned }));
      onClose();
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
    <label className="block text-xs font-medium text-slate-400">Title<input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} mt-1.5`} data-testid="input-project-title" /></label>
    <label className="block text-xs font-medium text-slate-400">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${areaCls} mt-1.5 min-h-24`} /></label>
    <label className="block text-xs font-medium text-slate-400">Tags (comma separated)<input value={tags} onChange={(e) => setTags(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-slate-400">Color<select value={color} onChange={(e) => setColor(e.target.value as Project['color'])} className={`${inputCls} mt-1.5`}>{Object.keys(colors).map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="block text-xs font-medium text-slate-400">Icon<select value={icon} onChange={(e) => setIcon(e.target.value as Project['icon'])} className={`${inputCls} mt-1.5`}>{Object.keys(icons).map((c) => <option key={c}>{c}</option>)}</select></label>
    </div>
    <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-violet-500" />Pin to the top of the list</label>
    {err && <p role="alert" className="text-xs text-rose-300">{err}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy} data-testid="button-save-project">{project ? 'Save' : 'Create project'}</Button></div>
  </form></Modal>;
}

async function exportProject(p: Project) { downloadBlob(await exportProjectBlob(p.id), `${safeName(p.title)}.project.json`); }

export function ProjectsPage({ id, goto, notify }: { id: string | null; goto: (h: string) => void; notify: (m: string) => void }) {
  return id ? <ProjectDetail id={id} goto={goto} notify={notify} /> : <ProjectList goto={goto} notify={notify} />;
}

function ProjectList({ goto, notify }: { goto: (h: string) => void; notify: (m: string) => void }) {
  const { prefs, save } = usePrefs(), search = useSearch(), ctx = useContextMenu();
  const [archived, setArchived] = useState(false), [q, setQ] = useState(''), [sort, setSort] = useState<'date' | 'name'>('date');
  const [form, setForm] = useState<'new' | Project | null>(null), [del, setDel] = useState<Project | null>(null), [drive, setDrive] = useState<Project | null>(null);
  const list = useLocalQuery(() => repository.listProjects({ archived, search: q || undefined, limit: 200 }), [archived, q]);
  const rows = [...(list.data ?? [])].sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)));
  useEffect(() => { if (new URLSearchParams(search).get('new') === '1') setForm('new'); }, [search]);
  const rows2 = [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const undoable = (p: Project, patch: Partial<Project>, inverse: Partial<Project>, msg: string) => act(async () => { await repository.updateProject(p.id, patch); pushNotice(msg, { label: 'Undo', run: () => repository.updateProject(p.id, inverse).catch((e) => notify(errMsg(e))) }); }, '');
  const menu = (p: Project): MenuItem[] => [
    { label: 'Open', onSelect: () => goto(`/workspace/projects/${p.id}`) },
    { label: 'Edit details', onSelect: () => setForm(p) },
    { label: p.pinned ? 'Unpin' : 'Pin', onSelect: () => void act(() => repository.updateProject(p.id, { pinned: !p.pinned }), '') },
    { label: p.archived ? 'Restore' : 'Archive', onSelect: () => void undoable(p, { archived: !p.archived }, { archived: p.archived }, p.archived ? 'Project restored.' : 'Project archived.') },
    { label: 'Duplicate', onSelect: () => void act(async () => { await repository.duplicateProject(p.id); }, 'Project duplicated.') },
    { label: 'Export', onSelect: () => void act(() => exportProject(p), 'Project exported.') },
    { label: 'Google Drive…', onSelect: () => setDrive(p) },
    { label: 'Delete', danger: true, onSelect: () => setDel(p) },
  ];
  const act = async (fn: () => Promise<void>, ok: string) => { try { await fn(); if (ok) notify(ok); } catch (e) { notify(errMsg(e)); } };
  return <div className="mx-auto max-w-[1100px] p-4 sm:p-8">
    <PageHeading eyebrow="Projects" title="Keep the work in one place." description="Projects group notes, documents and files stored in this browser. Backups are manual from Storage." actions={<Button onClick={() => setForm('new')} data-testid="button-new-project"><Plus size={15} />New project</Button>} />
    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
      <label className="relative block"><span className="sr-only">Search projects</span><Search size={15} className="absolute left-3 top-3.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className={`${inputCls} pl-9`} /></label>
      <label><span className="sr-only">Sort projects</span><select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'name')} className={inputCls}><option value="date">Recently updated</option><option value="name">Name</option></select></label>
      <div className="flex gap-1" role="group" aria-label="View"><IconButton label="Grid view" onClick={() => void save({ projectView: 'grid' })} className={prefs.projectView === 'grid' ? 'bg-white/10' : ''}><LayoutGrid size={15} /></IconButton><IconButton label="List view" onClick={() => void save({ projectView: 'list' })} className={prefs.projectView === 'list' ? 'bg-white/10' : ''}><List size={15} /></IconButton></div>
      <label><span className="sr-only">Show</span><select value={archived ? 'a' : 'x'} onChange={(e) => setArchived(e.target.value === 'a')} className={inputCls}><option value="x">Active</option><option value="a">Archived</option></select></label>
    </div>
    {list.loading && !list.data && <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>}
    {list.error && <LoadError message={list.error} retry={list.refresh} />}
    {list.data && rows.length === 0 && <EmptyPreview title={archived ? 'No archived projects' : q ? 'No projects match' : 'No projects yet'} detail={archived ? 'Archived projects appear here.' : 'Create a project to gather related notes and files. It is saved in this browser.'} />}
    <div className={prefs.projectView === 'list' ? 'stagger grid gap-2' : 'stagger grid gap-3 sm:grid-cols-2'}>{rows2.map((p) => { const PI = icons[p.icon ?? 'folder']; return <article key={p.id} onContextMenu={ctx.open(menu(p))} className="rounded-xl transition hover:-translate-y-0.5 hover:border-white/20 border border-white/[.075] bg-[#15171e] p-5" data-testid={`card-project-${p.id}`}>
      <Link href={`/workspace/projects/${p.id}`} className="flex items-start gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${colors[p.color ?? 'violet']}`}><PI size={16} /></span><span className="min-w-0"><span className="flex items-center gap-1.5 truncate font-semibold">{p.pinned && <Pin size={11} aria-label="Pinned" className="text-violet-300" />}{p.title}</span><span className="line-clamp-2 text-xs text-slate-400">{p.description || 'No description'}</span></span></Link>
      {p.tags.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>)}</p>}
      <div className="mt-4 flex items-center justify-between"><span className="text-[11px] text-slate-500">Updated {ago(p.updatedAt)} </span><DriveBadge target={{ kind: 'project', id: p.id, title: p.title }} /><span className="flex-1" />
        <ActionMenu label={`Actions for ${p.title}`} items={menu(p)} /></div>
    </article>; })}</div>
    {form && <ProjectForm project={form === 'new' ? undefined : form} onClose={() => setForm(null)} onSaved={(p) => { if (p) goto(`/workspace/projects/${p.id}`); }} />}
    {del && <DeleteProjectDialog project={del} onDone={() => notify('Project deleted.')} onClose={() => setDel(null)} />}
    {ctx.node}{drive && <DriveDialog target={{ kind: 'project', id: drive.id, title: drive.title }} onClose={() => setDrive(null)} />}
  </div>;
}

function ProjectDetail({ id, goto, notify }: { id: string; goto: (h: string) => void; notify: (m: string) => void }) {
  const proj = useLocalQuery(() => repository.getProject(id), [id]);
  const items = useLocalQuery(() => repository.listItems({ projectId: id, limit: 1000 }), [id]);
  const atts = useLocalQuery(() => repository.listAttachments(), []);
  const [edit, setEdit] = useState(false), [del, setDel] = useState(false), [driveOpen, setDriveOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (proj.loading && !proj.data) return <div className="mx-auto max-w-[1000px] space-y-3 p-8"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (proj.error) return <div className="mx-auto max-w-[1000px] p-8"><LoadError message={proj.error} retry={proj.refresh} /></div>;
  const p = proj.data;
  if (!p) return <div className="mx-auto max-w-[1000px] p-8"><EmptyPreview title="Project not found" detail="It may have been deleted." /><Button className="mt-4" onClick={() => goto('/workspace/projects')}>All projects</Button></div>;
  const size = (atts.data ?? []).filter((a) => a.projectId === id).reduce((n, a) => n + a.size, 0);
  async function upload(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      if (f.size > MAX_UPLOAD) { notify(`${f.name} exceeds ${formatBytes(MAX_UPLOAD)}.`); continue; }
      try { await repository.addFile(f, id); notify(`Saved ${f.name}.`); } catch (e) { notify(errMsg(e)); }
    }
    if (input.current) input.current.value = '';
  }
  const list = items.data ?? [];
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8">
    <Link href="/workspace/projects" className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><ArrowLeft size={14} />All projects</Link>
    <PageHeading eyebrow={p.archived ? 'Archived project' : 'Project'} title={p.title} description={p.description || 'No description yet.'} actions={<><Button variant="outline" onClick={() => setEdit(true)}><Pencil size={14} />Edit</Button><Button variant="outline" onClick={() => exportProject(p).then(() => notify('Project exported.'), (e) => notify(errMsg(e)))}><Download size={14} />Export</Button><Button variant="outline" onClick={() => repository.duplicateProject(id).then((d) => { pushNotice('Project duplicated.', { label: 'Open', run: () => goto(`/workspace/projects/${d.id}`) }); }, (e) => notify(errMsg(e)))}>Duplicate</Button><Button variant="outline" onClick={() => setDriveOpen(true)}>Drive backup</Button><Button variant="outline" onClick={() => setDel(true)}><Trash2 size={14} />Delete</Button></>} />
    <p className="-mt-3 mb-4"><DriveBadge target={{ kind: 'project', id, title: p.title }} /></p>
    {driveOpen && <DriveDialog target={{ kind: 'project', id, title: p.title }} onClose={() => setDriveOpen(false)} />}
    <p className="mb-4 text-xs text-slate-500">{list.length} items · {formatBytes(size)} of files · updated {ago(p.updatedAt)} · stored in this browser only</p>
    <div className="mb-4 flex flex-wrap gap-2">
      <Button onClick={async () => { try { await repository.saveItem({ title: 'Untitled note', kind: 'note', projectId: id }); } catch (e) { notify(errMsg(e)); } }}><StickyNote size={14} />Add note</Button>
      <Button variant="outline" onClick={async () => { try { await repository.saveItem({ title: 'Untitled task', kind: 'task', projectId: id }); } catch (e) { notify(errMsg(e)); } }}><FilePlus2 size={14} />Add task</Button>
      <input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} /><Button variant="outline" onClick={() => input.current?.click()}><Upload size={14} />Attach files</Button>
    </div>
    {items.loading && !items.data && <Skeleton className="h-32" />}
    {items.error && <LoadError message={items.error} retry={items.refresh} />}
    {items.data && list.length === 0 && <EmptyPreview title="This project is empty" detail="Add a note, a task, or attach a file. Open an item to edit it." />}
    {list.length > 0 && <ItemList items={list} notify={notify} />}
    {edit && <ProjectForm project={p} onClose={() => setEdit(false)} />}
    {del && <DeleteProjectDialog project={p} count={list.length} onDone={() => goto('/workspace/projects')} onClose={() => setDel(false)} />}
  </div>;
}
