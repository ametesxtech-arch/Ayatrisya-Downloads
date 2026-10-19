import {
  Activity,
  ArrowRight,
  Check,
  Code2,
  Download,
  FolderKanban,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, Notice, Panel } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';

export function CodingPage({
  detailed,
  notify,
  goto,
}: {
  detailed: boolean;
  notify: (m: string) => void;
  goto: (href: string) => void;
}) {
  if (!detailed)
    return (
      <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
        <PageHeading
          eyebrow="Coding companion · desktop required"
          title="Work with code where it lives."
          description="The browser cannot access local project folders. Real project analysis, edits and tests require the future Ayatrisya desktop app."
          actions={
            <Button
              variant="outline"
              onClick={() =>
                notify(
                  'Ayatrisya Desktop is not available yet. No download started.',
                )
              }
            >
              <Download size={14} />
              Download for Windows
            </Button>
          }
        />
        <Notice>
          Desktop access is not available in this preview. The project below is
          sample UI only—no shell or filesystem operations are possible.
        </Notice>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [FolderKanban, 'Local analysis', 'Explore files on your machine.'],
            [Code2, 'Proposed edits', 'Review changes before they happen.'],
            [Activity, 'Testing', 'See test output and inspect failures.'],
            [
              ShieldCheck,
              'You approve',
              'Commands and changes need your review.',
            ],
          ].map(([I, t, d]) => {
            const Icon = I as typeof FolderKanban;
            return (
              <Panel className="p-5" key={String(t)}>
                <Icon size={18} className="mb-5 text-violet-200" />
                <h3 className="text-sm font-semibold">{String(t)}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {String(d)}
                </p>
              </Panel>
            );
          })}
        </div>
        <Panel className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[.06] p-4">
            <div>
              <div className="text-xs font-semibold">
                Desktop workflow preview
              </div>
              <div className="mt-1 text-[10px] text-slate-600">
                Sample project: fieldnotes-web · illustrative only
              </div>
            </div>
            <span className="rounded border border-amber-300/10 bg-amber-300/[.04] px-2 py-1 text-[9px] text-amber-100/70">
              NOT CONNECTED
            </span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[.06] p-4">
              <div className="mb-3 text-[9px] uppercase tracking-widest text-slate-600">
                Project picker
              </div>
              <div className="rounded bg-white/[.03] p-3 text-xs">
                <FolderKanban
                  size={14}
                  className="mr-2 inline text-violet-200"
                />
                fieldnotes-web
              </div>
              <div className="mt-2 text-[10px] text-slate-600">
                src · docs · package.json
              </div>
            </div>
            <div className="rounded-lg border border-white/[.06] p-4">
              <div className="mb-3 text-[9px] uppercase tracking-widest text-slate-600">
                Proposed action
              </div>
              <p className="text-xs leading-5 text-slate-400">
                Review a suggested update to the workspace navigation.
              </p>
              <button
                onClick={() =>
                  notify('No changes can be applied in this sample project.')
                }
                className="mt-3 rounded-md border border-white/10 px-3 py-2 text-[10px] text-slate-300 hover:bg-white/5"
              >
                Review sample changes
              </button>
            </div>
            <div className="rounded-lg border border-white/[.06] p-4">
              <div className="mb-3 text-[9px] uppercase tracking-widest text-slate-600">
                Terminal preview
              </div>
              <div className="mono text-[10px] leading-5 text-slate-500">
                $ pnpm test
                <br />
                [sample output]
                <br />
                No command executed.
              </div>
            </div>
          </div>
          <div className="border-t border-white/[.06] p-4 text-center">
            <Button
              variant="outline"
              onClick={() => goto('/workspace/coding/desktop-preview')}
            >
              Open detailed desktop preview <ArrowRight size={14} />
            </Button>
          </div>
        </Panel>
      </div>
    );
  return (
    <div className="mx-auto max-w-[1350px] p-4 sm:p-7">
      <PageHeading
        eyebrow="Desktop companion · sample only"
        title="Fieldnotes workspace"
        description="Sample files and output. No local files, shell, tests or changes are connected."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              notify(
                'No command executed. Local filesystem access is not available.',
              )
            }
          >
            <Activity size={14} />
            Run tests
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3 text-[10px] text-slate-500">
          <span>
            fieldnotes-web{' '}
            <span className="ml-2 text-amber-200/70">
              Demo project · no Git connection
            </span>
          </span>
          <button
            onClick={() =>
              notify(
                'This is a sample preview; there are no unsaved file changes.',
              )
            }
            className="hover:text-white"
          >
            Unsaved changes: none
          </button>
        </div>
        <div className="grid min-h-[550px] lg:grid-cols-[190px_1fr_290px]">
          <aside className="border-b border-white/[.06] p-3 lg:border-b-0 lg:border-r">
            <div className="mb-3 px-2 text-[9px] uppercase tracking-widest text-slate-600">
              Explorer · sample
            </div>
            {[
              '▾ src',
              '  ▾ components',
              '    Sidebar.tsx',
              '    Workspace.tsx',
              '  main.tsx',
              '▾ docs',
              '  brief.md',
              'package.json',
            ].map((t) => (
              <button
                key={t}
                onClick={() => notify(`${t.trim()} is sample project content.`)}
                className="block w-full rounded px-2 py-1.5 text-left font-mono text-[10px] text-slate-500 hover:bg-white/[.04] hover:text-slate-200"
              >
                {t}
              </button>
            ))}
          </aside>
          <div className="flex flex-col border-b border-white/[.06] lg:border-b-0 lg:border-r">
            <div className="flex h-10 items-center justify-between border-b border-white/[.06] px-4 text-[10px] text-slate-500">
              src/components/Sidebar.tsx{' '}
              <span className="text-slate-700">sample file</span>
            </div>
            <pre className="flex-1 overflow-auto bg-[#111318] p-4 font-mono text-[11px] leading-7 text-slate-400">
              <span className="text-violet-300">type</span> NavigationItem ={' '}
              {'{'}
              <br /> label: <span className="text-teal-200">string</span>;<br />{' '}
              href: <span className="text-teal-200">string</span>;<br />
              {'}'};<br />
              <br />
              <span className="text-violet-300">export function</span> Sidebar(
              {'{'} items {'}'}) {'{'}
              <br />{' '}
              <span className="text-slate-600">
                // illustrative sample code
              </span>
              <br /> <span className="text-violet-300">return</span>{' '}
              items.map(item =&gt; ...);
              <br />
              {'}'}
            </pre>
            <div className="h-36 border-t border-white/[.06] p-4">
              <div className="mb-2 flex justify-between text-[9px] uppercase tracking-widest text-slate-600">
                Terminal <span>Sample only</span>
              </div>
              <div className="mono text-[10px] leading-5 text-slate-500">
                › pnpm test
                <br />
                Preview only. No shell is connected.
              </div>
            </div>
          </div>
          <aside className="p-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles size={14} className="text-violet-200" />
              Coding assistant{' '}
              <span className="rounded border border-violet-300/15 px-1.5 py-0.5 text-[8px] text-violet-200">
                DEMO
              </span>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Sample code review panel. Future coding assistance will require
              Ayatrisya Desktop.
            </p>
            <div className="mt-5 rounded-lg border border-white/[.07] p-3">
              <div className="text-[10px] font-semibold">Proposed diff</div>
              <div className="mt-2 mono text-[9px] leading-5">
                <div className="text-rose-200/70">− old sidebar spacing</div>
                <div className="text-teal-200/70">
                  + refined sidebar spacing
                </div>
                <div className="mt-2 text-slate-600">
                  Sample only, not applied.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() =>
                notify(
                  'Approval is unavailable: no files or commands are connected.',
                )
              }
            >
              <Check size={14} />
              Approve changes
            </Button>
            <Button
              variant="quiet"
              className="mt-2 w-full"
              onClick={() =>
                notify('Command approval is a preview; no command executed.')
              }
            >
              <ShieldCheck size={14} />
              Review command approval
            </Button>
            <Button
              variant="quiet"
              className="mt-4 w-full"
              onClick={() => goto('/workspace/coding')}
            >
              Back to coding overview
            </Button>
          </aside>
        </div>
      </Panel>
    </div>
  );
}
