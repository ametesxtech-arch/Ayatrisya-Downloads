import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileText,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Button,
  EmptyPreview,
  Modal,
  Notice,
  Panel,
} from '@/components/Primitives';
import { sampleProjects } from '@/data/fixtures';
import { cx } from '@/lib/cx';
import { PageHeading } from '@/components/PageHeading';

export function ProjectsPage({
  detail,
  notify,
  goto,
}: {
  detail: boolean;
  notify: (m: string) => void;
  goto: (href: string) => void;
}) {
  const [projects, setProjects] = useState(sampleProjects),
    [create, setCreate] = useState(false),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [view, setView] = useState('Cards'),
    [filter, setFilter] = useState('All');
  const [completed, setCompleted] = useState<string[]>([]);
  const addProject = () => {
    if (name.trim().length < 3) {
      setError('Project name must be at least 3 characters.');
      return;
    }
    setProjects((prev) => [
      {
        name: name.trim(),
        desc: description.trim() || 'A new project in your demo workspace.',
        phase: 'Planning',
        tasks: 0,
        color: 'violet',
      },
      ...prev,
    ]);
    setCreate(false);
    setName('');
    setDescription('');
    setError('');
    notify('Project added to this session only.');
  };
  if (detail)
    return (
      <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
        <PageHeading
          eyebrow="Project · sample data"
          title="Fieldnotes"
          description="A thoughtful research journal for the web. Sample project overview; edits and task state are session-only."
          actions={
            <Button
              variant="outline"
              onClick={() => notify('Project options are only a UI preview.')}
            >
              <MoreHorizontal size={14} />
              Options
            </Button>
          }
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
          <div className="space-y-4">
            <Panel className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Goal</h2>
                <button
                  onClick={() =>
                    notify('Goal editing is not saved in this preview.')
                  }
                  className="text-[10px] text-violet-200"
                >
                  Edit
                </button>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
                Create a calm, useful space for people to notice patterns while
                doing field research.
              </p>
            </Panel>
            <Panel className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  Tasks{' '}
                  <span className="ml-1 text-xs font-normal text-slate-600">
                    3 sample items
                  </span>
                </h2>
                <Button
                  variant="quiet"
                  onClick={() =>
                    notify(
                      'Tasks can be previewed, but new tasks are not saved.',
                    )
                  }
                >
                  <Plus size={14} />
                  Add task
                </Button>
              </div>
              <div className="mt-3 space-y-1">
                {[
                  'Map the first-run experience',
                  'Review the research note structure',
                  'Sketch a responsive workspace',
                ].map((t, i) => (
                  <label
                    key={t}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-xs text-slate-400 hover:bg-white/[.03]"
                  >
                    <input
                      type="checkbox"
                      checked={completed.includes(t)}
                      onChange={() =>
                        setCompleted((prev) =>
                          prev.includes(t)
                            ? prev.filter((v) => v !== t)
                            : [...prev, t],
                        )
                      }
                      className="accent-violet-400"
                    />
                    <span
                      className={
                        completed.includes(t)
                          ? 'text-slate-600 line-through'
                          : ''
                      }
                    >
                      {t}
                    </span>
                    <span className="ml-auto text-[9px] text-slate-600">
                      {i === 0 ? 'In progress' : 'Planned'}
                    </span>
                  </label>
                ))}
              </div>
            </Panel>
            <Panel className="p-5">
              <h2 className="font-semibold">Milestones</h2>
              <div className="mt-4 space-y-3">
                {[
                  ['Discovery', 'Complete'],
                  ['First prototype', 'In progress'],
                  ['Small user review', 'Planned'],
                ].map(([t, s]) => (
                  <div key={t} className="flex items-center gap-3 text-xs">
                    <span className="size-2 rounded-full bg-violet-300/70" />
                    <span className="flex-1 text-slate-300">{t}</span>
                    <span className="text-[10px] text-slate-600">{s}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="p-5">
              <h2 className="font-semibold">Related work</h2>
              <button
                onClick={() => goto('/workspace/chat/fieldnotes')}
                className="mt-3 flex w-full items-center gap-3 rounded-lg border border-white/[.06] p-3 text-left text-xs text-slate-400 hover:bg-white/[.03]"
              >
                <MessageSquare size={15} className="text-violet-200" />A clearer
                product narrative <ArrowRight size={13} className="ml-auto" />
              </button>
            </Panel>
          </div>
          <div className="space-y-4">
            <Panel className="p-5">
              <h2 className="text-xs font-semibold">Activity</h2>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Project initialized with sample activity.
              </p>
              <div className="mt-4 border-l border-white/[.08] pl-4 text-[10px] leading-5 text-slate-600">
                Today · Sample project viewed
                <br />
                This week · Prototype milestone added
              </div>
            </Panel>
            <Panel className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold">Assets</h2>
                <button
                  onClick={() => notify('Asset uploads are not available.')}
                  className="text-[10px] text-slate-500 hover:text-white"
                >
                  Add
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/[.06] p-3">
                <FileText size={15} className="text-blue-200" />
                <span className="text-[10px] text-slate-400">
                  Project brief{' '}
                  <span className="block text-slate-600">Sample document</span>
                </span>
              </div>
            </Panel>
          </div>
        </div>
        <Button
          variant="quiet"
          className="mt-4"
          onClick={() => goto('/workspace/projects')}
        >
          <ArrowLeft size={14} />
          Back to projects
        </Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Projects · demo workspace"
        title="Keep the pieces in view."
        description="Sample projects show how goals, conversations and tasks could live together. New projects exist only in memory for this session."
        actions={
          <>
            <div className="flex rounded-lg border border-white/[.08] p-1">
              {['Cards', 'List'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cx(
                    'rounded-md px-3 py-1.5 text-[10px]',
                    view === v ? 'bg-white/[.08] text-white' : 'text-slate-500',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button onClick={() => setCreate(true)}>
              <Plus size={15} />
              New project
            </Button>
          </>
        }
      />
      <div className="mb-5 flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-slate-600" />
        {['All', 'In progress', 'Planning'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              'rounded-full border px-3 py-1.5 text-[10px]',
              filter === f
                ? 'border-violet-300/20 bg-violet-300/[.06] text-violet-100'
                : 'border-white/[.07] text-slate-500 hover:text-white',
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-600">
          {projects.length} projects · illustrative
        </span>
      </div>
      <div
        className={
          view === 'Cards'
            ? 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'
            : 'space-y-2'
        }
      >
        {projects
          .filter((p) => filter === 'All' || p.phase === filter)
          .map((p, i) => (
            <button
              key={`${p.name}-${i}`}
              onClick={() => goto('/workspace/projects/fieldnotes')}
              className={cx(
                'group text-left transition hover:border-white/[.15] hover:bg-[#191b23]',
                view === 'Cards'
                  ? 'min-h-[210px] rounded-xl border border-white/[.07] bg-[#15171e] p-5'
                  : 'flex items-center gap-5 rounded-xl border border-white/[.07] bg-[#15171e] p-4',
              )}
            >
              <div
                className={cx(
                  'grid place-items-center rounded-xl border border-violet-300/10 bg-violet-300/[.06] text-violet-200',
                  view === 'Cards' ? 'mb-7 size-10' : 'size-10',
                )}
              >
                <FolderKanban size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">{p.name}</h2>
                  {i < sampleProjects.length && (
                    <span className="rounded border border-white/[.06] px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-600">
                      sample
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {p.desc}
                </p>
                <div className="mt-5 flex items-center gap-3 text-[10px] text-slate-600">
                  <span className="rounded-full border border-white/[.08] px-2 py-1">
                    {p.phase}
                  </span>
                  <span>{p.tasks} tasks</span>
                  <ArrowUpRight
                    size={13}
                    className="ml-auto transition group-hover:text-violet-200"
                  />
                </div>
              </div>
            </button>
          ))}
      </div>
      {projects.filter((p) => filter === 'All' || p.phase === filter).length ===
        0 && (
        <EmptyPreview
          title="No projects in this view"
          detail="Choose another status filter or create a project."
        />
      )}
      {create && (
        <Modal title="Create a project" onClose={() => setCreate(false)}>
          <label className="block text-xs font-medium text-slate-300">
            Project name
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoFocus
              placeholder="e.g. Field research"
              className="mt-2 h-11 w-full rounded-lg border border-white/[.09] bg-[#101116] px-3 text-sm"
            />
          </label>
          <label className="mt-4 block text-xs font-medium text-slate-300">
            Description <span className="text-slate-600">optional</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What are you working toward?"
              className="mt-2 w-full rounded-lg border border-white/[.09] bg-[#101116] p-3 text-sm placeholder:text-slate-600"
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-xs text-rose-200">
              {error}
            </p>
          )}
          <Notice>
            Project is created in session memory only and will not persist after
            leaving.
          </Notice>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button onClick={addProject}>
              <Plus size={14} />
              Create project
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
