import { useMemo, type ReactNode } from 'react';
import {
  ArrowDownRight, ArrowRight, AudioLines, BookOpen, CheckSquare2, ChevronDown, ChevronRight,
  Code2, File, FileText, FolderKanban, Image, Library, MessageSquare,
  Pin, Plus, Presentation, Search, Sparkles, StickyNote, Waves,
} from 'lucide-react';
import { Emblem } from '@/components/Brand';
import type { Conversation, Project, ProjectItem, StorageStats } from '@/storage/types';

type Action = 'new-chat' | 'new-project' | 'create-document' | 'library' | 'projects' | 'image-studio' | 'voice-studio' | 'coding' | 'search';
type Section = 'projects' | 'conversations' | 'items';

export interface WorkspaceHomeProps {
  displayName: string;
  projects: Project[];
  conversations: Conversation[];
  items: ProjectItem[];
  stats: StorageStats | null;
  loading: boolean;
  error: string | null;
  modelAvailable: boolean;
  sections: { projects: boolean; conversations: boolean; items: boolean };
  density: 'comfortable' | 'compact';
  onAction: (action: Action) => void;
  onOpenProject: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onOpenItem: (id: string) => void;
  onToggleSection: (section: Section) => void;
  onChangeDensity: (density: 'comfortable' | 'compact') => void;
  onRetry: () => void;
}

const kindIcon = {
  note: StickyNote,
  document: FileText,
  presentation: Presentation,
  file: File,
  task: CheckSquare2,
  code: Code2,
};

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SectionHeading({
  title, count, open, onToggle, action,
}: {
  title: string; count: number; open: boolean; onToggle: () => void; action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="group inline-flex min-h-9 items-center gap-2 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">
        {open ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
        <span id={`section-${title.toLowerCase().replaceAll(' ', '-')}`} className="text-[13px] font-semibold tracking-[-.01em] text-slate-200">{title}</span>
        <span className="mono text-[10px] text-slate-500">{count}</span>
      </button>
      {action}
    </div>
  );
}

function EmptyState({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex min-h-[132px] items-center justify-between gap-4 rounded-xl border border-dashed border-white/[.1] bg-white/[.012] px-4 py-5 sm:px-5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-300">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      <button type="button" onClick={onAction} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[.07] px-3 text-xs font-semibold text-violet-100 hover:border-violet-300/35 hover:bg-violet-300/[.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
        <Plus size={14} />{actionLabel}
      </button>
    </div>
  );
}

function ActionTile({ icon: Icon, label, hint, onClick, accent = false, testId }: { icon: typeof MessageSquare; label: string; hint: string; onClick: () => void; accent?: boolean; testId?: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className={`group flex min-h-[74px] items-center gap-3 rounded-xl border px-3.5 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${accent ? 'border-violet-300/20 bg-violet-300/[.075] hover:border-violet-300/40 hover:bg-violet-300/[.11]' : 'border-white/[.075] bg-[#15171e]/80 hover:border-white/[.14] hover:bg-[#1b1d26]'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${accent ? 'border-violet-200/15 bg-violet-200/[.08] text-violet-100' : 'border-white/[.07] bg-white/[.035] text-slate-300 group-hover:text-cyan-100'}`}><Icon size={16} strokeWidth={1.8} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-slate-200">{label}</span>
        <span className="mt-0.5 block text-[10px] text-slate-500">{hint}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
    </button>
  );
}

export function WorkspaceHome({
  displayName, projects, conversations, items, stats, loading, error, modelAvailable, sections, density,
  onAction, onOpenProject, onOpenConversation, onOpenItem, onToggleSection, onChangeDensity, onRetry,
}: WorkspaceHomeProps) {
  const recentProjects = useMemo(() => projects.filter((p) => !p.archived).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4), [projects]);
  const recentConversations = useMemo(() => conversations.filter((c) => !c.archived).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5), [conversations]);
  const recentItems = useMemo(() => items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5), [items]);
  const compact = density === 'compact';

  return (
    <div className="workspace-home relative isolate min-h-full overflow-hidden bg-[#101116] text-slate-100">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-52 h-[500px] w-[500px] rounded-full border border-violet-300/[.055]" />
        <div className="absolute -right-24 -top-36 h-[340px] w-[340px] rounded-full border border-cyan-200/[.045]" />
        <div className="absolute right-[11%] top-12 h-1 w-1 rounded-full bg-cyan-100/60 shadow-[0_0_16px_rgba(130,220,245,.5)]" />
        <div className="absolute left-0 top-[335px] h-px w-full bg-gradient-to-r from-transparent via-white/[.035] to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-7 sm:px-7 sm:pt-10 lg:px-10">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">
            <span className="h-px w-5 bg-violet-300/65" /> Personal workspace
            <span className="text-slate-700">/</span><span className="text-slate-400">Overview</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-white/[.07] bg-[#15171e]/75 p-1" aria-label="Dashboard density">
              <button type="button" onClick={() => onChangeDensity('comfortable')} aria-pressed={!compact} className={`min-h-8 rounded-md px-2.5 text-[10px] font-medium ${!compact ? 'bg-white/[.09] text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>Comfortable</button>
              <button type="button" onClick={() => onChangeDensity('compact')} aria-pressed={compact} className={`min-h-8 rounded-md px-2.5 text-[10px] font-medium ${compact ? 'bg-white/[.09] text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>Compact</button>
            </div>
            <button type="button" onClick={() => onAction('search')} aria-label="Search workspace" className="grid size-10 place-items-center rounded-lg border border-white/[.07] bg-[#15171e]/75 text-slate-400 hover:border-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
              <Search size={16} />
            </button>
          </div>
        </div>

        <section className="relative mb-7 overflow-hidden rounded-2xl border border-white/[.08] bg-[#14161d]/90 px-5 py-6 shadow-[0_20px_80px_rgba(0,0,0,.2)] sm:px-8 sm:py-8">
          <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden md:block">
            <div className="absolute right-[12%] top-1/2 size-64 -translate-y-1/2 rounded-full border border-violet-200/[.08]" />
            <div className="absolute right-[19%] top-1/2 size-48 -translate-y-1/2 rounded-full border border-indigo-200/[.08]" />
            <div className="absolute right-[26%] top-1/2 size-32 -translate-y-1/2 rounded-full border border-cyan-100/[.12]" />
            <div className="absolute right-[calc(26%+60px)] top-1/2 size-2 -translate-y-1/2 rounded-full bg-cyan-100/70 shadow-[0_0_18px_rgba(117,220,238,.45)]" />
            <div className="absolute right-[17%] top-[22%] h-16 w-px rotate-[42deg] bg-gradient-to-b from-transparent via-violet-100/20 to-transparent" />
          </div>
          <div className="relative z-10 max-w-[660px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200/[.12] bg-violet-200/[.045] px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-violet-100/80">
              <Emblem size={18} mode="subtle" />
              {modelAvailable ? 'Model connection available' : 'Workspace ready · model unavailable'}
            </div>
            <h1 className="display text-[clamp(1.8rem,4vw,2.65rem)] font-semibold leading-[1.08] tracking-[-.055em] text-slate-100">
              {displayName.trim() ? <>Good to see you, <span className="text-violet-200">{displayName.trim()}</span>.</> : <>A clear space<br className="hidden sm:block" /> for what comes next.</>}
            </h1>
            <p className="mt-3 max-w-lg text-[13px] leading-6 text-slate-400">
              Your conversations, research, and projects stay together here—saved locally in this browser.
            </p>
            {!modelAvailable && <p className="mt-2 text-[11px] text-slate-500">AI responses are unavailable right now. Your workspace and saved content remain accessible.</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" data-testid="button-new-chat" onClick={() => onAction('new-chat')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-300 px-4 text-xs font-bold text-[#171523] hover:bg-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200">
                <Plus size={15} /> New conversation <span className="ml-1 hidden border-l border-black/15 pl-2 font-mono text-[9px] opacity-65 sm:inline">Ctrl / ⌘ N</span>
              </button>
              <button type="button" onClick={() => onAction('new-project')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/[.1] bg-white/[.025] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
                <FolderKanban size={15} /> New project
              </button>
              <button type="button" onClick={() => onAction('library')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-400 hover:bg-white/[.04] hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
                <Library size={15} /> Browse library <ArrowDownRight size={13} />
              </button>
            </div>
          </div>
          <div className="relative z-10 mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 md:max-w-[760px]">
            <ActionTile icon={FileText} label="Create document" hint="Start with a blank page" testId="button-create-document" onClick={() => onAction('create-document')} />
            <ActionTile icon={Image} label="Image studio" hint="Open your visual tools" onClick={() => onAction('image-studio')} />
            <ActionTile icon={Waves} label="Voice studio" hint="Work with audio" onClick={() => onAction('voice-studio')} />
            <ActionTile icon={Code2} label="Coding workspace" hint="Open a development space" onClick={() => onAction('coding')} />
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[.055] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-rose-100">Your local workspace could not be loaded</p>
              <p className="mt-1 text-[11px] text-rose-100/65">{error}</p>
            </div>
            <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-rose-200/20 px-3 text-xs font-medium text-rose-100 hover:bg-rose-100/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div aria-label="Loading workspace content" role="status" className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
            {[0, 1].map((col) => <div key={col} className="space-y-4 rounded-xl border border-white/[.06] bg-[#14161d]/60 p-5">
              <div className="h-4 w-32 animate-pulse rounded bg-white/[.07]" />
              {[0, 1, 2].map((row) => <div key={row} className="h-[62px] animate-pulse rounded-lg bg-white/[.035]" />)}
            </div>)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-white/[.07] bg-[#14161d]/65 p-5 text-xs text-slate-500">Saved sections will appear here after the local workspace becomes available.</div>
        ) : (
          <div className={`grid ${compact ? 'gap-4 lg:grid-cols-[1.1fr_.9fr]' : 'gap-6 lg:grid-cols-[1.05fr_.95fr]'}`}>
            <div className="space-y-7">
              <section aria-labelledby="section-recent-projects">
                <SectionHeading title="Recent projects" count={recentProjects.length} open={sections.projects} onToggle={() => onToggleSection('projects')} action={<button type="button" onClick={() => onAction('new-project')} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] text-slate-400 hover:bg-white/[.05] hover:text-slate-200"><Plus size={13} />New</button>} />
                {sections.projects && (recentProjects.length ? <div className="stagger grid gap-2 sm:grid-cols-2">
                  {recentProjects.map((project) => <button key={project.id} type="button" onClick={() => onOpenProject(project.id)} className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[.075] bg-[#15171e]/85 p-4 text-left hover:border-white/[.15] hover:bg-[#191b24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${compact ? 'min-h-[102px]' : 'min-h-[122px]'}`}>
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-[2px] ${project.color === 'cyan' ? 'bg-cyan-200/70' : project.color === 'rose' ? 'bg-rose-300/70' : project.color === 'amber' ? 'bg-amber-200/70' : project.color === 'emerald' ? 'bg-emerald-200/70' : 'bg-violet-300/75'}`} />
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[.07] bg-white/[.035] text-slate-300"><FolderKanban size={15} /></span>
                        <span className="truncate text-[13px] font-semibold text-slate-200">{project.title}</span>
                      </span>
                      {project.pinned && <Pin size={12} className="mt-1 shrink-0 text-violet-200/75" aria-label="Pinned project" />}
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2">
                      <span className="line-clamp-1 text-[11px] text-slate-500">{project.description || 'No description'}</span>
                      <span className="shrink-0 text-[10px] text-slate-600">{dateLabel(project.updatedAt)}</span>
                    </span>
                  </button>)}
                </div> : <EmptyState title="Start a project space" detail="Bring related conversations and working files together in one place." actionLabel="Create project" onAction={() => onAction('new-project')} />)}
                {sections.projects && projects.filter((p) => !p.archived).length > recentProjects.length && <button type="button" onClick={() => onAction('projects')} className="mt-2 inline-flex min-h-8 items-center gap-1.5 px-1 text-[11px] text-slate-500 hover:text-slate-300">Explore all projects <ArrowRight size={12} /></button>}
              </section>

              <section aria-labelledby="section-recent-conversations">
                <SectionHeading title="Recent conversations" count={recentConversations.length} open={sections.conversations} onToggle={() => onToggleSection('conversations')} action={<button type="button" onClick={() => onAction('new-chat')} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] text-slate-400 hover:bg-white/[.05] hover:text-slate-200"><Plus size={13} />New</button>} />
                {sections.conversations && (recentConversations.length ? <div className="stagger divide-y divide-white/[.055] rounded-xl border border-white/[.07] bg-[#15171e]/75">
                  {recentConversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => onOpenConversation(conversation.id)} className={`group flex w-full items-center gap-3 px-3.5 text-left hover:bg-white/[.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-300 ${compact ? 'min-h-12' : 'min-h-[58px]'}`}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-300/[.065] text-violet-200/80"><MessageSquare size={14} /></span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-300 group-hover:text-slate-100">{conversation.title}</span>
                    {conversation.pinned && <Pin size={12} className="shrink-0 text-violet-200/70" aria-label="Pinned conversation" />}
                    <span className="shrink-0 text-[10px] text-slate-600">{dateLabel(conversation.updatedAt)}</span>
                    <ArrowRight size={13} className="shrink-0 text-slate-600 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>)}
                </div> : <EmptyState title="No conversations yet" detail="Start a conversation when you are ready. Replies appear only when a model connection is available." actionLabel="New conversation" onAction={() => onAction('new-chat')} />)}
              </section>
            </div>

            <div className="space-y-7">
              <section aria-labelledby="section-recently-updated">
                <SectionHeading title="Recently updated" count={recentItems.length} open={sections.items} onToggle={() => onToggleSection('items')} action={<button type="button" onClick={() => onAction('library')} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] text-slate-400 hover:bg-white/[.05] hover:text-slate-200">Library <ArrowRight size={12} /></button>} />
                {sections.items && (recentItems.length ? <div className="stagger divide-y divide-white/[.055] rounded-xl border border-white/[.07] bg-[#15171e]/75">
                  {recentItems.map((item) => {
                    const Icon = kindIcon[item.kind];
                    return <button key={item.id} type="button" onClick={() => onOpenItem(item.id)} className={`group flex w-full items-center gap-3 px-3.5 text-left hover:bg-white/[.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-300 ${compact ? 'min-h-12' : 'min-h-[58px]'}`}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[.06] bg-white/[.025] text-slate-400 group-hover:text-cyan-100"><Icon size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-300 group-hover:text-slate-100">{item.title}</span>
                        <span className="mt-0.5 block text-[10px] capitalize text-slate-600">{item.kind}{item.completed ? ' · completed' : ''}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-600">{dateLabel(item.updatedAt)}</span>
                      <ArrowRight size={13} className="shrink-0 text-slate-600 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </button>;
                  })}
                </div> : <EmptyState title="Your library is ready" detail="Notes, documents, files, and other saved work will appear here." actionLabel="Open library" onAction={() => onAction('library')} />)}
              </section>

              <section aria-label="Local workspace status" className="overflow-hidden rounded-xl border border-white/[.075] bg-[#14161d]/80">
                <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg border border-cyan-200/[.1] bg-cyan-200/[.045] text-cyan-100/75"><BookOpen size={15} /></span>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-200">Local workspace</p>
                      <p className="text-[10px] text-slate-500">Saved on this device</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400"><span className="size-1.5 rounded-full bg-cyan-200/70" /> Browser storage</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-white/[.06]">
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[.13em] text-slate-600">Workspace records</p>
                    <p className="mono mt-1.5 text-[17px] tracking-[-.04em] text-slate-200">{stats ? (stats.conversations + stats.projects + stats.items).toLocaleString() : '—'}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{stats ? `${stats.conversations} conversations · ${stats.projects} projects · ${stats.items} items` : 'Usage details unavailable'}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[.13em] text-slate-600">Attachments</p>
                    <p className="mono mt-1.5 text-[17px] tracking-[-.04em] text-slate-200">{stats ? stats.attachments.toLocaleString() : '—'}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{stats?.persistent === true ? 'Persistent storage enabled' : stats?.persistent === false ? 'Browser-managed persistence' : 'Persistence status unavailable'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => onAction('library')} className="flex min-h-9 w-full items-center justify-between border-t border-white/[.06] px-4 text-[10px] text-slate-500 hover:bg-white/[.025] hover:text-slate-300">
                  Content stays in this browser <span className="inline-flex items-center gap-1">View library <ArrowRight size={11} /></span>
                </button>
              </section>

              {!sections.projects && !sections.conversations && !sections.items && (
                <div className="rounded-xl border border-dashed border-white/[.09] bg-white/[.012] p-5">
                  <p className="text-[12px] font-medium text-slate-300">A quieter home, by choice.</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">Your content sections are hidden. Use the controls above each section when you want them back.</p>
                </div>
              )}
              <div className="flex items-center gap-2 px-1 text-[10px] text-slate-600">
                <Sparkles size={12} className="text-violet-300/60" /> A focused space for work in progress
                <span className="ml-auto inline-flex items-center gap-1"><AudioLines size={12} /> Ayatrisya</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkspaceHome;
