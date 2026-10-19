import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Plus, Save, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, Notice, inputCls, areaCls } from '@/components/Primitives';
import { pushNotice } from '@/lib/notify';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import type { ProjectItem } from '@/storage/types';
import { confirmDiscard, setDirty } from '@/lib/dirty';
import { downloadText, errMsg, safeName } from '@/lib/format';

function useSaver(item: ProjectItem, get: () => { title: string; content: string; tags: string; projectId: string | null }) {
  const [saved, setSaved] = useState(() => JSON.stringify({ ...get() }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const now = JSON.stringify(get());
  const dirty = now !== saved;
  async function save() {
    const v = get();
    setSaving(true); setError('');
    try {
      await repository.saveItem({ id: item.id, title: v.title.trim() || 'Untitled', kind: item.kind, content: v.content, projectId: v.projectId, tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean), completed: item.completed });
      setSaved(JSON.stringify(v));
    } catch (e) { setError(errMsg(e, 'Could not save.')); } finally { setSaving(false); }
  }
  useEffect(() => { setDirty(dirty); }, [dirty]);
  useEffect(() => () => setDirty(false), []);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  return { dirty, save, error, saving };
}

function Shell({ item, title, setTitle, dirty, saving, error, onSave, onClose, onDelete, projectId, setProjectId, tags, setTags, exports, children }: {
  item: ProjectItem; title: string; setTitle: (s: string) => void; dirty: boolean; saving: boolean; error: string; onSave: () => void; onClose: () => void; onDelete: () => void | Promise<void>;
  projectId: string | null; setProjectId: (s: string | null) => void; tags: string; setTags: (s: string) => void; exports: Array<{ label: string; run: () => void }>; children: React.ReactNode;
}) {
  const projects = useLocalQuery(() => repository.listProjects({ limit: 200 }), []);
  const [confirmDel, setConfirmDel] = useState(false);
  return <div onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave(); } }}>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="quiet" onClick={() => { if (confirmDiscard()) onClose(); }}><ArrowLeft size={15} />Back</Button>
      <span aria-live="polite" className="text-xs text-slate-500" data-testid="status-save">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved in this browser'}</span>
      <span className="ml-auto flex flex-wrap gap-2">
        {exports.map((x) => <Button key={x.label} variant="outline" onClick={x.run}><Download size={14} />{x.label}</Button>)}
        <Button onClick={onSave} disabled={!dirty || saving} data-testid="button-save"><Save size={14} />Save</Button>
        <Button variant="outline" onClick={() => setConfirmDel(true)} aria-label={`Delete ${item.title}`}><Trash2 size={14} /></Button>{confirmDel && <ConfirmDialog danger title="Delete item" confirmLabel="Delete" body={<>Delete <b>{item.title}</b> from this browser? This cannot be undone. Copies already backed up to Google Drive are not affected.</>} onConfirm={async () => { await onDelete(); setConfirmDel(false); }} onClose={() => setConfirmDel(false)} />}
      </span>
    </div>
    {error && <p role="alert" className="mt-3 rounded-md bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
    <label className="mt-4 block text-xs font-medium text-slate-400">Title<input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} mt-1.5 text-base font-semibold`} data-testid="input-title" /></label>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-400">Project<select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || null)} className={`${inputCls} mt-1.5`}><option value="">No project</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label className="block text-xs font-medium text-slate-400">Tags (comma separated)<input value={tags} onChange={(e) => setTags(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
    </div>
    <div className="mt-4">{children}</div>
  </div>;
}

export function ItemEditor({ item, onClose, onDeleted }: { item: ProjectItem; onClose: () => void; onDeleted?: () => void }) {
  return item.kind === 'presentation' ? <SlideEditor item={item} onClose={onClose} onDeleted={onDeleted} /> : <TextEditor item={item} onClose={onClose} onDeleted={onDeleted} />;
}

function useDelete(item: ProjectItem, onClose: () => void, onDeleted?: () => void) {
  return async () => {
    try { await repository.deleteItem(item.id); (onDeleted ?? onClose)(); } catch (e) { pushNotice(errMsg(e, 'Could not delete.')); }
  };
}

export function TextEditor({ item, onClose, onDeleted }: { item: ProjectItem; onClose: () => void; onDeleted?: () => void }) {
  const [title, setTitle] = useState(item.title), [content, setContent] = useState(item.content), [tags, setTags] = useState(item.tags.join(', ')), [projectId, setProjectId] = useState(item.projectId);
  const s = useSaver(item, () => ({ title, content, tags, projectId }));
  const del = useDelete(item, onClose, onDeleted);
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const base = safeName(title);
  return <Shell item={item} title={title} setTitle={setTitle} dirty={s.dirty} saving={s.saving} error={s.error} onSave={s.save} onClose={onClose} onDelete={del} projectId={projectId} setProjectId={setProjectId} tags={tags} setTags={setTags}
    exports={[{ label: 'Markdown', run: () => downloadText(`# ${title}\n\n${content}`, `${base}.md`, 'text/markdown') }, { label: 'Plain text', run: () => downloadText(`${title}\n\n${content}`, `${base}.txt`) }]}>
    <label className="sr-only" htmlFor="editor-body">Content</label>
    <textarea id="editor-body" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Start writing. Markdown is kept as plain text." className={`${areaCls} min-h-[48dvh] resize-y`} data-testid="input-content" />
    <p className="mt-2 text-xs text-slate-500">{words} words · {content.length} characters · Ctrl or Cmd + S saves</p>
  </Shell>;
}

export type Slide = { id: string; title: string; body: string; layout: 'title' | 'bullets' | 'quote' };
const newSlide = (): Slide => ({ id: crypto.randomUUID(), title: 'Untitled slide', body: '', layout: 'bullets' });
export function parseSlides(raw: string): Slide[] {
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j?.slides) && j.slides.length)
      return j.slides.map((x: Partial<Slide>) => ({ id: String(x.id ?? crypto.randomUUID()), title: String(x.title ?? ''), body: String(x.body ?? ''), layout: (['title', 'bullets', 'quote'] as const).includes(x.layout as Slide['layout']) ? (x.layout as Slide['layout']) : 'bullets' }));
  } catch { /* empty or not JSON */ }
  return [newSlide()];
}
export const slidesToJson = (slides: Slide[]) => JSON.stringify({ version: 1, slides }, null, 2);

export function SlideEditor({ item, onClose, onDeleted }: { item: ProjectItem; onClose: () => void; onDeleted?: () => void }) {
  const [title, setTitle] = useState(item.title), [tags, setTags] = useState(item.tags.join(', ')), [projectId, setProjectId] = useState(item.projectId);
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(item.content)), [sel, setSel] = useState(0);
  const content = useMemo(() => slidesToJson(slides), [slides]);
  const s = useSaver(item, () => ({ title, content, tags, projectId }));
  const del = useDelete(item, onClose, onDeleted);
  const cur = slides[Math.min(sel, slides.length - 1)];
  const idx = slides.indexOf(cur);
  const patch = (p: Partial<Slide>) => setSlides((all) => all.map((x) => (x === cur ? { ...x, ...p } : x)));
  const move = (d: number) => { const j = idx + d; if (j < 0 || j >= slides.length) return; const a = [...slides]; [a[idx], a[j]] = [a[j], a[idx]]; setSlides(a); setSel(j); };
  const base = safeName(title);
  const outline = slides.map((x, i) => `Slide ${i + 1}: ${x.title}\n${x.body}`).join('\n\n');
  return <Shell item={item} title={title} setTitle={setTitle} dirty={s.dirty} saving={s.saving} error={s.error} onSave={s.save} onClose={onClose} onDelete={del} projectId={projectId} setProjectId={setProjectId} tags={tags} setTags={setTags}
    exports={[{ label: 'JSON', run: () => downloadText(content, `${base}.slides.json`, 'application/json') }, { label: 'Text outline', run: () => downloadText(outline, `${base}.txt`) }]}>
    <Notice>Slides are saved as JSON in this browser. PowerPoint export is not available; export JSON or a text outline.</Notice>
    <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
      <div className="space-y-1.5" role="listbox" aria-label="Slides">
        {slides.map((x, i) => <button key={x.id} role="option" aria-selected={x === cur} onClick={() => setSel(i)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${x === cur ? 'border-violet-400/40 bg-violet-400/10 text-white' : 'border-white/[.07] text-slate-400 hover:bg-white/[.04]'}`}><span className="text-slate-500">{i + 1}</span><span className="truncate">{x.title || 'Untitled'}</span></button>)}
        <Button variant="outline" className="w-full" onClick={() => { setSlides([...slides, newSlide()]); setSel(slides.length); }}><Plus size={14} />Add slide</Button>
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => move(-1)} disabled={idx === 0}><ArrowUp size={14} />Up</Button>
          <Button variant="outline" onClick={() => move(1)} disabled={idx === slides.length - 1}><ArrowDown size={14} />Down</Button>
          <Button variant="outline" onClick={() => { const c = { ...cur, id: crypto.randomUUID() }; const a = [...slides]; a.splice(idx + 1, 0, c); setSlides(a); setSel(idx + 1); }}><Copy size={14} />Duplicate</Button>
          <Button variant="outline" disabled={slides.length === 1} onClick={() => { setSlides(slides.filter((x) => x !== cur)); setSel(Math.max(0, idx - 1)); }}><Trash2 size={14} />Remove</Button>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-400">Slide title<input value={cur.title} onChange={(e) => patch({ title: e.target.value })} className={`${inputCls} mt-1.5`} /></label>
        <label className="mt-3 block text-xs font-medium text-slate-400">Layout<select value={cur.layout} onChange={(e) => patch({ layout: e.target.value as Slide['layout'] })} className={`${inputCls} mt-1.5`}><option value="title">Title</option><option value="bullets">Bulleted (one point per line)</option><option value="quote">Quote</option></select></label>
        <label className="mt-3 block text-xs font-medium text-slate-400">Body<textarea value={cur.body} onChange={(e) => patch({ body: e.target.value })} className={`${areaCls} mt-1.5 min-h-28`} /></label>
        <div aria-label="Slide preview" className="mt-4 aspect-video rounded-xl border border-white/10 bg-[#101116] p-6 sm:p-10">
          <h3 className={`display font-bold ${cur.layout === 'title' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{cur.title}</h3>
          {cur.layout === 'bullets' && <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-300">{cur.body.split('\n').filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul>}
          {cur.layout === 'quote' && <blockquote className="mt-4 border-l-2 border-violet-400 pl-4 text-lg italic text-slate-300">{cur.body}</blockquote>}
          {cur.layout === 'title' && <p className="mt-3 text-slate-400">{cur.body}</p>}
        </div>
      </div>
    </div>
  </Shell>;
}
