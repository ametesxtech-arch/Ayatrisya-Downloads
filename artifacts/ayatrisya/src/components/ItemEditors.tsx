import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  Plus,
  Save,
  Trash2,
  Sparkles,
  RefreshCw,
  FileText,
  Eye,
  Columns,
  Layers,
} from 'lucide-react';
import { Button, ConfirmDialog, Notice, inputCls, areaCls } from '@/components/Primitives';
import { pushNotice } from '@/lib/notify';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import type { ProjectItem } from '@/storage/types';
import { confirmDiscard, setDirty } from '@/lib/dirty';
import { downloadText, errMsg, safeName } from '@/lib/format';
import { downloadPdf } from '@/lib/pdf-export';
import { downloadDocx } from '@/lib/docx-export';
import { downloadPptx, type Slide, type SlideLayout } from '@/lib/pptx-export';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { parseMarkdownToAst } from '@/lib/document-engine/parser';
import { DocumentViewer } from '@/lib/document-engine/DocumentViewer';
import { regenerateSlide } from '@/ai/presentation-generator';

export type { Slide, SlideLayout };

function useSaver(
  item: ProjectItem,
  get: () => { title: string; content: string; tags: string; projectId: string | null }
) {
  const [saved, setSaved] = useState(() => JSON.stringify({ ...get() }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const now = JSON.stringify(get());
  const dirty = now !== saved;

  async function save() {
    const v = get();
    setSaving(true);
    setError('');
    try {
      await repository.saveItem({
        id: item.id,
        title: v.title.trim() || 'Untitled',
        kind: item.kind,
        content: v.content,
        projectId: v.projectId,
        tags: v.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        completed: item.completed,
      });
      setSaved(JSON.stringify(v));
    } catch (e) {
      setError(errMsg(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    setDirty(dirty);
  }, [dirty]);

  useEffect(() => () => setDirty(false), []);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  return { dirty, save, error, saving };
}

function Shell({
  item,
  title,
  setTitle,
  dirty,
  saving,
  error,
  onSave,
  onClose,
  onDelete,
  projectId,
  setProjectId,
  tags,
  setTags,
  exports,
  children,
}: {
  item: ProjectItem;
  title: string;
  setTitle: (s: string) => void;
  dirty: boolean;
  saving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
  projectId: string | null;
  setProjectId: (s: string | null) => void;
  tags: string;
  setTags: (s: string) => void;
  exports: Array<{ label: string; run: () => void }>;
  children: React.ReactNode;
}) {
  const projects = useLocalQuery(() => repository.listProjects({ limit: 200 }), []);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSave();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="quiet"
          onClick={() => {
            if (confirmDiscard()) onClose();
          }}
        >
          <ArrowLeft size={15} />
          Back
        </Button>
        <span aria-live="polite" className="text-xs text-slate-500" data-testid="status-save">
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved in this browser'}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          {exports.map((x) => (
            <Button key={x.label} variant="outline" onClick={x.run}>
              <Download size={14} />
              {x.label}
            </Button>
          ))}
          <Button onClick={onSave} disabled={!dirty || saving} data-testid="button-save">
            <Save size={14} />
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmDel(true)}
            aria-label={`Delete ${item.title}`}
          >
            <Trash2 size={14} />
          </Button>
          {confirmDel && (
            <ConfirmDialog
              danger
              title="Delete item"
              confirmLabel="Delete"
              body={
                <>
                  Delete <b>{item.title}</b> from this browser? This cannot be undone.
                </>
              }
              onConfirm={async () => {
                await onDelete();
                setConfirmDel(false);
              }}
              onClose={() => setConfirmDel(false)}
            />
          )}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-rose-400/10 p-3 text-xs text-rose-200">
          {error}
        </p>
      )}
      <label className="mt-4 block text-xs font-medium text-slate-400">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputCls} mt-1.5 text-base font-semibold`}
          data-testid="input-title"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-400">
          Project
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className={`${inputCls} mt-1.5`}
          >
            <option value="">No project</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Tags (comma separated)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={`${inputCls} mt-1.5`}
          />
        </label>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function ItemEditor({
  item,
  onClose,
  onDeleted,
}: {
  item: ProjectItem;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  return item.kind === 'presentation' ? (
    <SlideEditor item={item} onClose={onClose} onDeleted={onDeleted} />
  ) : (
    <TextEditor item={item} onClose={onClose} onDeleted={onDeleted} />
  );
}

function useDelete(item: ProjectItem, onClose: () => void, onDeleted?: () => void) {
  return async () => {
    try {
      await repository.deleteItem(item.id);
      (onDeleted ?? onClose)();
    } catch (e) {
      pushNotice(errMsg(e, 'Could not delete.'));
    }
  };
}

export function TextEditor({
  item,
  onClose,
  onDeleted,
}: {
  item: ProjectItem;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [tags, setTags] = useState(item.tags.join(', '));
  const [projectId, setProjectId] = useState(item.projectId);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split' | 'doc-preview'>('edit');
  const s = useSaver(item, () => ({ title, content, tags, projectId }));
  const del = useDelete(item, onClose, onDeleted);
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const base = safeName(title);

  const documentAst = useMemo(
    () => parseMarkdownToAst(content, { fallbackTitle: title }),
    [content, title]
  );

  return (
    <Shell
      item={item}
      title={title}
      setTitle={setTitle}
      dirty={s.dirty}
      saving={s.saving}
      error={s.error}
      onSave={s.save}
      onClose={onClose}
      onDelete={del}
      projectId={projectId}
      setProjectId={setProjectId}
      tags={tags}
      setTags={setTags}
      exports={[
        { label: 'PDF', run: () => downloadPdf(content, `${base}.pdf`, { title }) },
        { label: 'Word (.docx)', run: () => downloadDocx(content, `${base}.docx`, title) },
        {
          label: 'Markdown',
          run: () => downloadText(`# ${title}\n\n${content}`, `${base}.md`, 'text/markdown'),
        },
        { label: 'Plain text', run: () => downloadText(`${title}\n\n${content}`, `${base}.txt`) },
      ]}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between border-b border-white/[.08] pb-2 gap-2">
        <div className="flex items-center gap-1 bg-white/[.04] p-1 rounded-lg border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              viewMode === 'edit' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            data-testid="button-mode-edit"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              viewMode === 'preview' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            data-testid="button-mode-preview"
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => setViewMode('doc-preview')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              viewMode === 'doc-preview' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            data-testid="button-mode-doc"
          >
            Document Page
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden sm:inline-block px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              viewMode === 'split' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            data-testid="button-mode-split"
          >
            Split
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {words} words · {content.length} characters
        </p>
      </div>

      {viewMode === 'edit' && (
        <textarea
          id="editor-body"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing. Full Markdown formatting supported."
          className={`${areaCls} min-h-[48dvh] resize-y font-mono text-xs`}
          data-testid="input-content"
        />
      )}

      {viewMode === 'preview' && (
        <div
          className="min-h-[48dvh] rounded-xl border border-white/10 bg-[#0c0d12] p-5 sm:p-6 overflow-y-auto"
          data-testid="document-markdown-preview"
        >
          <MarkdownRenderer content={content} />
        </div>
      )}

      {viewMode === 'doc-preview' && (
        <div
          className="min-h-[48dvh] overflow-y-auto rounded-xl bg-black/40 p-2 sm:p-6"
          data-testid="document-ast-preview-container"
        >
          <DocumentViewer ast={documentAst} />
        </div>
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <textarea
            id="editor-body"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing. Full Markdown formatting supported."
            className={`${areaCls} min-h-[48dvh] resize-y font-mono text-xs`}
            data-testid="input-content"
          />
          <div
            className="min-h-[48dvh] rounded-xl border border-white/10 bg-[#0c0d12] p-5 sm:p-6 overflow-y-auto"
            data-testid="document-markdown-split-preview"
          >
            <MarkdownRenderer content={content} />
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Ctrl or Cmd + S saves · Export as PDF, Word (.docx), Markdown, or Plain Text anytime
      </p>
    </Shell>
  );
}

const newSlide = (): Slide => ({
  id: crypto.randomUUID(),
  title: 'Untitled slide',
  body: '',
  layout: 'card-grid',
});

const ALL_LAYOUTS: Array<{ value: SlideLayout; label: string }> = [
  { value: 'title', label: 'Title Slide' },
  { value: 'section-header', label: 'Section Divider' },
  { value: 'two-column', label: 'Two-Column Split' },
  { value: 'metrics', label: 'KPI / Metrics Callouts' },
  { value: 'timeline', label: 'Timeline Sequence' },
  { value: 'process', label: 'Process Steps Flow' },
  { value: 'comparison', label: 'Comparison (Pros / Cons)' },
  { value: 'table', label: 'Data Table' },
  { value: 'image-focus', label: 'Visual Hero + Narrative' },
  { value: 'card-grid', label: 'SmartArt Card Grid' },
  { value: 'conclusion', label: 'Conclusion & Next Steps' },
  { value: 'references', label: 'References & Appendix' },
];

export function parseSlides(raw: string): Slide[] {
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j?.slides) && j.slides.length) {
      return j.slides.map((x: any) => {
        let layout: SlideLayout = 'card-grid';
        if (x.layout === 'bullets') layout = 'card-grid';
        else if (x.layout === 'quote') layout = 'section-header';
        else if (ALL_LAYOUTS.some((l) => l.value === x.layout)) layout = x.layout;

        return {
          id: String(x.id ?? crypto.randomUUID()),
          title: String(x.title ?? ''),
          subtitle: x.subtitle ? String(x.subtitle) : undefined,
          body: String(x.body ?? ''),
          layout,
          category: x.category,
          metrics: x.metrics,
          timeline: x.timeline,
          columns: x.columns,
          table: x.table,
          notes: x.notes,
        };
      });
    }
  } catch {}
  return [newSlide()];
}

export const slidesToJson = (slides: Slide[]) =>
  JSON.stringify({ version: 2, slides }, null, 2);

export function SlideEditor({
  item,
  onClose,
  onDeleted,
}: {
  item: ProjectItem;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [tags, setTags] = useState(item.tags.join(', '));
  const [projectId, setProjectId] = useState(item.projectId);
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(item.content));
  const [sel, setSel] = useState(0);
  const [theme, setTheme] = useState<'dark-cinematic' | 'clean-light' | 'emerald-minimal' | 'cyber-neon'>('dark-cinematic');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegenBox, setShowRegenBox] = useState(false);

  const content = useMemo(() => slidesToJson(slides), [slides]);
  const s = useSaver(item, () => ({ title, content, tags, projectId }));
  const del = useDelete(item, onClose, onDeleted);
  const cur = slides[Math.min(sel, slides.length - 1)];
  const idx = slides.indexOf(cur);

  const patch = (p: Partial<Slide>) =>
    setSlides((all) => all.map((x) => (x === cur ? { ...x, ...p } : x)));

  const move = (d: number) => {
    const j = idx + d;
    if (j < 0 || j >= slides.length) return;
    const a = [...slides];
    [a[idx], a[j]] = [a[j], a[idx]];
    setSlides(a);
    setSel(j);
  };

  const handleRegenerateCurrentSlide = async () => {
    if (!cur) return;
    setIsRegenerating(true);
    try {
      const instruction = regenPrompt.trim() || 'Polish, make punchy and enhance this slide structure.';
      const updated = await regenerateSlide(cur, instruction, title);
      patch(updated);
      pushNotice('Slide regenerated successfully');
      setShowRegenBox(false);
      setRegenPrompt('');
    } catch (e) {
      pushNotice(errMsg(e, 'Failed to regenerate slide'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const base = safeName(title);
  const outline = slides.map((x, i) => `Slide ${i + 1} (${x.layout}): ${x.title}\n${x.body}`).join('\n\n');

  return (
    <Shell
      item={item}
      title={title}
      setTitle={setTitle}
      dirty={s.dirty}
      saving={s.saving}
      error={s.error}
      onSave={s.save}
      onClose={onClose}
      onDelete={del}
      projectId={projectId}
      setProjectId={setProjectId}
      tags={tags}
      setTags={setTags}
      exports={[
        {
          label: 'PowerPoint (.pptx)',
          run: () => downloadPptx(title, slides, `${base}.pptx`, { theme }),
        },
        {
          label: 'JSON',
          run: () => downloadText(content, `${base}.slides.json`, 'application/json'),
        },
        { label: 'Text outline', run: () => downloadText(outline, `${base}.txt`) },
      ]}
    >
      <Notice>
        Ayatrisya Presentation Suite: 12 distinct professional slide layouts, custom themes, and
        genuine Office OpenXML (.pptx) export.
      </Notice>

      <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
        {/* Slide List Sidebar */}
        <div className="space-y-1.5" role="listbox" aria-label="Slides">
          {slides.map((x, i) => (
            <button
              key={x.id}
              role="option"
              aria-selected={x === cur}
              onClick={() => setSel(i)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition cursor-pointer ${
                x === cur
                  ? 'border-violet-400/40 bg-violet-400/10 text-white'
                  : 'border-white/[.07] text-slate-400 hover:bg-white/[.04]'
              }`}
            >
              <span className="text-slate-500 font-mono text-[10px] w-4">{i + 1}</span>
              <span className="truncate flex-1">{x.title || 'Untitled'}</span>
              <span className="text-[10px] text-slate-600 uppercase font-mono">
                {x.layout.slice(0, 4)}
              </span>
            </button>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSlides([...slides, newSlide()]);
              setSel(slides.length);
            }}
          >
            <Plus size={14} />
            Add slide
          </Button>
        </div>

        {/* Slide Content & Inspector */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => move(-1)} disabled={idx === 0}>
              <ArrowUp size={14} />
              Up
            </Button>
            <Button variant="outline" onClick={() => move(1)} disabled={idx === slides.length - 1}>
              <ArrowDown size={14} />
              Down
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const c = { ...cur, id: crypto.randomUUID() };
                const a = [...slides];
                a.splice(idx + 1, 0, c);
                setSlides(a);
                setSel(idx + 1);
              }}
            >
              <Copy size={14} />
              Duplicate
            </Button>
            <Button
              variant="outline"
              disabled={slides.length === 1}
              onClick={() => {
                setSlides(slides.filter((x) => x !== cur));
                setSel(Math.max(0, idx - 1));
              }}
            >
              <Trash2 size={14} />
              Remove
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowRegenBox(!showRegenBox)}
              className="text-violet-300 border-violet-500/30"
              data-testid="button-regen-slide"
            >
              <Sparkles size={14} />
              AI Polish Slide
            </Button>

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

          {/* AI Single Slide Regeneration Box */}
          {showRegenBox && (
            <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 flex flex-wrap gap-2 items-center">
              <input
                value={regenPrompt}
                onChange={(e) => setRegenPrompt(e.target.value)}
                placeholder="How would you like to improve this slide? (e.g. Add 3 metrics, make it punchier)"
                className="flex-1 rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-white placeholder-slate-500"
              />
              <Button
                onClick={handleRegenerateCurrentSlide}
                disabled={isRegenerating}
                className="bg-violet-600 text-white"
              >
                <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                {isRegenerating ? 'Regenerating…' : 'Apply AI'}
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <label className="block text-xs font-medium text-slate-400">
              Slide title
              <input
                value={cur.title}
                onChange={(e) => patch({ title: e.target.value })}
                className={`${inputCls} mt-1.5`}
                data-testid="input-slide-title"
              />
            </label>

            <label className="block text-xs font-medium text-slate-400">
              Layout (12 Architectures)
              <select
                value={cur.layout}
                onChange={(e) => patch({ layout: e.target.value as SlideLayout })}
                className={`${inputCls} mt-1.5`}
                data-testid="select-slide-layout"
              >
                {ALL_LAYOUTS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block text-xs font-medium text-slate-400">
            Slide content / Points
            <textarea
              value={cur.body}
              onChange={(e) => patch({ body: e.target.value })}
              className={`${areaCls} mt-1.5 min-h-24`}
              placeholder="Enter slide content. Points can be separated by newlines."
              data-testid="input-slide-body"
            />
          </label>

          {/* Visual Presentation Live Preview */}
          <div
            aria-label="Slide preview"
            data-testid="presentation-slide-preview"
            className={`mt-4 aspect-video rounded-xl border p-6 sm:p-10 transition-colors flex flex-col justify-between ${
              theme === 'clean-light'
                ? 'bg-slate-50 border-slate-200 text-slate-900'
                : theme === 'emerald-minimal'
                ? 'bg-[#061A14] border-emerald-900/40 text-emerald-100'
                : theme === 'cyber-neon'
                ? 'bg-[#0F051D] border-fuchsia-900/40 text-fuchsia-100'
                : 'bg-[#0B0F19] border-white/10 text-slate-100'
            }`}
          >
            {cur.layout === 'title' ? (
              <div className="flex h-full flex-col justify-center">
                <span
                  className={`inline-block w-fit rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase mb-3 ${
                    theme === 'clean-light'
                      ? 'bg-blue-100 text-blue-700'
                      : theme === 'emerald-minimal'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : theme === 'cyber-neon'
                      ? 'bg-fuchsia-500/20 text-fuchsia-300'
                      : 'bg-violet-500/20 text-violet-300'
                  }`}
                >
                  {cur.category || 'AYATRISYA DECK'}
                </span>
                <h3 className="display font-extrabold text-2xl sm:text-4xl md:text-5xl tracking-tight">
                  {cur.title}
                </h3>
                <p className="mt-4 text-sm sm:text-base opacity-80 max-w-xl">
                  {cur.body || cur.subtitle}
                </p>
              </div>
            ) : cur.layout === 'section-header' ? (
              <div className="flex h-full flex-col justify-center items-center text-center">
                <span className="text-xs uppercase tracking-widest text-violet-400 font-bold mb-2">
                  {cur.category || 'SECTION BREAK'}
                </span>
                <h3 className="display font-extrabold text-2xl sm:text-4xl tracking-tight max-w-xl">
                  {cur.title}
                </h3>
                <p className="mt-3 text-sm opacity-70 max-w-lg">{cur.body}</p>
              </div>
            ) : cur.layout === 'metrics' ? (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-violet-400" />
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{cur.title}</h3>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {(cur.metrics || [
                    { value: '99.98%', label: 'System Reliability', trend: '+4.2%' },
                    { value: '<15ms', label: 'Processing Latency', trend: 'Sub-second' },
                    { value: '10x', label: 'Developer Velocity', trend: 'Accelerated' },
                  ]).map((m, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-center"
                    >
                      <div className="text-2xl sm:text-3xl font-bold text-violet-400">
                        {m.value}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-200">{m.label}</div>
                      {m.trend && (
                        <div className="mt-1 text-[11px] text-emerald-400">{m.trend}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : cur.layout === 'two-column' ? (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-violet-400" />
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{cur.title}</h3>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs">
                    <h4 className="font-semibold text-sm text-white mb-2">
                      {cur.columns?.leftTitle || 'Left Dimension'}
                    </h4>
                    <p className="opacity-80 leading-relaxed">
                      {cur.columns?.leftBody || cur.body.split('\n')[0] || ''}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs">
                    <h4 className="font-semibold text-sm text-white mb-2">
                      {cur.columns?.rightTitle || 'Right Dimension'}
                    </h4>
                    <p className="opacity-80 leading-relaxed">
                      {cur.columns?.rightBody || cur.body.split('\n').slice(1).join('\n') || ''}
                    </p>
                  </div>
                </div>
              </div>
            ) : cur.layout === 'timeline' || cur.layout === 'process' ? (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-violet-400" />
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{cur.title}</h3>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {(cur.timeline || [
                    { step: '01', title: 'Phase 1: Foundation', description: 'Core architecture and models' },
                    { step: '02', title: 'Phase 2: Validation', description: 'OpenXML compatibility testing' },
                    { step: '03', title: 'Phase 3: Scale', description: 'Global multi-region release' },
                  ]).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs"
                    >
                      <span className="font-mono text-xs font-bold text-violet-400 block mb-1">
                        {s.step || `0${i + 1}`}
                      </span>
                      <h4 className="font-semibold text-sm text-white mb-1">{s.title}</h4>
                      <p className="opacity-70 leading-relaxed text-[11px]">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-violet-400" />
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{cur.title}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {cur.body
                    .split('\n')
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((l, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 text-xs ${
                          theme === 'clean-light'
                            ? 'bg-white border-slate-200 text-slate-700 shadow-sm'
                            : theme === 'emerald-minimal'
                            ? 'bg-[#0D281E] border-emerald-800/40 text-emerald-200'
                            : theme === 'cyber-neon'
                            ? 'bg-[#1B0B33] border-fuchsia-800/40 text-fuchsia-200'
                            : 'bg-[#161F30] border-slate-700/50 text-slate-300'
                        }`}
                      >
                        <span className="block font-mono text-[10px] font-bold mb-1.5 opacity-60 uppercase">
                          Point 0{i + 1}
                        </span>
                        <p className="leading-relaxed font-medium">
                          {l.replace(/^[•\-*]\s*/, '')}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Slide Footer Info */}
            <div className="mt-4 pt-3 border-t border-white/[.08] flex items-center justify-between text-[11px] opacity-60">
              <span>Ayatrisya Presentation Suite</span>
              <span>
                Slide {idx + 1} of {slides.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
