import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Plus, Save, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, Notice, inputCls, areaCls } from '@/components/Primitives';
import { pushNotice } from '@/lib/notify';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import type { ProjectItem } from '@/storage/types';
import { confirmDiscard, setDirty } from '@/lib/dirty';
import { downloadText, errMsg, safeName } from '@/lib/format';
import { downloadPdf } from '@/lib/pdf-export';
import { downloadPptx } from '@/lib/pptx-export';

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
    exports={[{ label: 'PDF', run: () => downloadPdf(content, `${base}.pdf`, { title }) }, { label: 'Markdown', run: () => downloadText(`# ${title}\n\n${content}`, `${base}.md`, 'text/markdown') }, { label: 'Plain text', run: () => downloadText(`${title}\n\n${content}`, `${base}.txt`) }]}>
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
  const [theme, setTheme] = useState<'dark-cinematic' | 'clean-light' | 'emerald-minimal' | 'cyber-neon'>('dark-cinematic');
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
    exports={[{ label: 'PowerPoint (.pptx)', run: () => downloadPptx(title, slides, `${base}.pptx`, { theme }) }, { label: 'JSON', run: () => downloadText(content, `${base}.slides.json`, 'application/json') }, { label: 'Text outline', run: () => downloadText(outline, `${base}.txt`) }]}>
    <Notice>Slides are saved as JSON in this browser. Export PowerPoint (.pptx) presentation decks with custom styles and SmartArt layout.</Notice>
    <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
      <div className="space-y-1.5" role="listbox" aria-label="Slides">
        {slides.map((x, i) => <button key={x.id} role="option" aria-selected={x === cur} onClick={() => setSel(i)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${x === cur ? 'border-violet-400/40 bg-violet-400/10 text-white' : 'border-white/[.07] text-slate-400 hover:bg-white/[.04]'}`}><span className="text-slate-500">{i + 1}</span><span className="truncate">{x.title || 'Untitled'}</span></button>)}
        <Button variant="outline" className="w-full" onClick={() => { setSlides([...slides, newSlide()]); setSel(slides.length); }}><Plus size={14} />Add slide</Button>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => move(-1)} disabled={idx === 0}><ArrowUp size={14} />Up</Button>
          <Button variant="outline" onClick={() => move(1)} disabled={idx === slides.length - 1}><ArrowDown size={14} />Down</Button>
          <Button variant="outline" onClick={() => { const c = { ...cur, id: crypto.randomUUID() }; const a = [...slides]; a.splice(idx + 1, 0, c); setSlides(a); setSel(idx + 1); }}><Copy size={14} />Duplicate</Button>
          <Button variant="outline" disabled={slides.length === 1} onClick={() => { setSlides(slides.filter((x) => x !== cur)); setSel(Math.max(0, idx - 1)); }}><Trash2 size={14} />Remove</Button>
          
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Palette:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="rounded-md border border-white/10 bg-[#161820] px-2 py-1 text-xs text-slate-200"
            >
              <option value="dark-cinematic">Dark Cinematic</option>
              <option value="clean-light">Clean Light</option>
              <option value="emerald-minimal">Emerald Minimal</option>
              <option value="cyber-neon">Cyber Neon</option>
            </select>
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-400">Slide title<input value={cur.title} onChange={(e) => patch({ title: e.target.value })} className={`${inputCls} mt-1.5`} /></label>
        <label className="mt-3 block text-xs font-medium text-slate-400">Layout<select value={cur.layout} onChange={(e) => patch({ layout: e.target.value as Slide['layout'] })} className={`${inputCls} mt-1.5`}><option value="title">Title Deck</option><option value="bullets">SmartArt Cards (one per line)</option><option value="quote">Quote / Manifesto</option></select></label>
        <label className="mt-3 block text-xs font-medium text-slate-400">Body<textarea value={cur.body} onChange={(e) => patch({ body: e.target.value })} className={`${areaCls} mt-1.5 min-h-28`} /></label>
        
        {/* Visual Gamma-style live preview */}
        <div aria-label="Slide preview" className={`mt-4 aspect-video rounded-xl border p-6 sm:p-10 transition-colors ${
          theme === 'clean-light' ? 'bg-slate-50 border-slate-200 text-slate-900' :
          theme === 'emerald-minimal' ? 'bg-[#061A14] border-emerald-900/40 text-emerald-100' :
          theme === 'cyber-neon' ? 'bg-[#0F051D] border-fuchsia-900/40 text-fuchsia-100' :
          'bg-[#0B0F19] border-white/10 text-slate-100'
        }`}>
          {cur.layout === 'title' ? (
            <div className="flex h-full flex-col justify-center">
              <span className={`inline-block w-fit rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase mb-3 ${
                theme === 'clean-light' ? 'bg-blue-100 text-blue-700' :
                theme === 'emerald-minimal' ? 'bg-emerald-500/20 text-emerald-300' :
                theme === 'cyber-neon' ? 'bg-fuchsia-500/20 text-fuchsia-300' :
                'bg-violet-500/20 text-violet-300'
              }`}>Presentation Deck</span>
              <h3 className="display font-extrabold text-3xl sm:text-5xl tracking-tight">{cur.title}</h3>
              <p className="mt-4 text-base opacity-80 max-w-xl">{cur.body}</p>
            </div>
          ) : cur.layout === 'quote' ? (
            <div className="flex h-full flex-col justify-center">
              <h4 className="text-sm font-semibold uppercase tracking-widest opacity-60 mb-2">{cur.title}</h4>
              <blockquote className={`border-l-4 pl-6 text-xl sm:text-2xl font-medium italic ${
                theme === 'clean-light' ? 'border-blue-600 text-slate-800' :
                theme === 'emerald-minimal' ? 'border-emerald-400 text-emerald-100' :
                theme === 'cyber-neon' ? 'border-cyan-400 text-cyan-100' :
                'border-violet-400 text-white'
              }`}>
                “{cur.body.replace(/^"|"$/g, '')}”
              </blockquote>
            </div>
          ) : (
            <div>
              <div className="mb-6 flex items-center gap-2">
                <span className={`size-2 rounded-full ${
                  theme === 'clean-light' ? 'bg-blue-600' :
                  theme === 'emerald-minimal' ? 'bg-emerald-400' :
                  theme === 'cyber-neon' ? 'bg-cyan-400' :
                  'bg-violet-400'
                }`} />
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{cur.title}</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {cur.body.split('\n').filter(Boolean).slice(0, 3).map((l, i) => (
                  <div key={i} className={`rounded-lg border p-4 text-xs ${
                    theme === 'clean-light' ? 'bg-white border-slate-200 text-slate-700 shadow-sm' :
                    theme === 'emerald-minimal' ? 'bg-[#0D281E] border-emerald-800/40 text-emerald-200' :
                    theme === 'cyber-neon' ? 'bg-[#1B0B33] border-fuchsia-800/40 text-fuchsia-200' :
                    'bg-[#161F30] border-slate-700/50 text-slate-300'
                  }`}>
                    <span className={`block font-mono text-[10px] font-bold mb-1.5 opacity-60 uppercase`}>Point 0{i + 1}</span>
                    <p className="leading-relaxed font-medium">{l.replace(/^[•\-\*]\s*/, '')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </Shell>;
}
