import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Button, EmptyPreview, Panel } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';

export function ResearchPage({ notify }: { notify: (m: string) => void }) {
  const [prompt, setPrompt] = useState(''),
    [scope, setScope] = useState('Broad overview'),
    [started, setStarted] = useState(false);
  return (
    <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Research canvas · UI preview"
        title="Make room for a better question."
        description="Define an objective and scope. Search, sources and research synthesis are not connected, so this canvas will not invent findings or citations."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              notify('There is no research output to export in this preview.')
            }
          >
            <Download size={14} />
            Export
          </Button>
        }
      />
      <Panel className="p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <label className="block text-xs font-medium text-slate-300">
            Research objective
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="What do you want to understand?"
              className="mt-2 w-full resize-y rounded-lg border border-white/[.09] bg-[#101116] p-3 text-sm placeholder:text-slate-600"
            />
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-white/[.09] bg-[#101116] px-3 text-xs"
            >
              <option>Broad overview</option>
              <option>Focused question</option>
              <option>Compare perspectives</option>
              <option>Learning path</option>
            </select>
            <span className="mt-2 block text-[10px] text-slate-600">
              Adjusts only this preview.
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[10px] text-slate-600">
            Objective is not saved beyond this session.
          </div>
          <Button
            onClick={() => {
              if (!prompt.trim()) {
                notify('Add an objective before previewing progress.');
                return;
              }
              setStarted(true);
            }}
          >
            <Search size={15} />
            Preview research workflow
          </Button>
        </div>
        {started && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-violet-300/10 bg-violet-300/[.04] p-3 text-xs text-violet-100"
          >
            Workflow preview started for “{prompt}” · {scope}. No search was
            performed.
          </div>
        )}
      </Panel>
      <div className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sources</h2>
              <span className="rounded border border-white/[.07] px-2 py-1 text-[9px] text-slate-600">
                0 sources
              </span>
            </div>
            <div className="mt-4">
              <EmptyPreview
                title="Sources will appear here"
                detail="Search is not connected. No sources or citations have been generated."
              />
            </div>
          </Panel>
          <Panel className="p-5">
            <h2 className="font-semibold">Notes</h2>
            <textarea
              onChange={() => {}}
              placeholder="Notes are available in this temporary view only…"
              className="mt-3 min-h-28 w-full resize-y rounded-lg border border-white/[.08] bg-[#101116] p-3 text-xs placeholder:text-slate-600"
            />
          </Panel>
        </div>
        <Panel className="p-5">
          <h2 className="font-semibold">Findings & summary</h2>
          <p className="mt-1 text-[10px] text-slate-600">
            No generated research · preview only
          </p>
          <div className="mt-4">
            <EmptyPreview
              title="No findings yet"
              detail="A research engine will populate evidence and a summary here when Ayatrisya’s own services are available."
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
