import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { Button, Notice, Panel } from '@/components/Primitives';
import { cx } from '@/lib/cx';
import { PageHeading } from '@/components/PageHeading';

export function PresentationsPage({ notify }: { notify: (m: string) => void }) {
  const [slide, setSlide] = useState(0),
    [notes, setNotes] = useState('');
  return (
    <div className="mx-auto max-w-[1240px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Presentations · preview"
        title="Give the idea a sequence."
        description="A sample editor for slide structure. No AI generation or permanent saving is connected."
        actions={
          <Button
            variant="outline"
            onClick={() => notify('Presentation export is not connected.')}
          >
            <Download size={14} />
            Export
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[170px_1fr_250px]">
        <Panel className="p-3">
          <div className="mb-3 flex items-center justify-between px-1 text-[10px] text-slate-500">
            Slides{' '}
            <button
              onClick={() => setSlide(3)}
              aria-label="Add slide"
              className="rounded p-1 hover:bg-white/[.06]"
            >
              <Plus size={13} />
            </button>
          </div>
          {['Opening', 'The question', 'A direction'].map((t, i) => (
            <button
              key={t}
              onClick={() => setSlide(i)}
              className={cx(
                'mb-2 w-full rounded-lg border p-2 text-left',
                slide === i
                  ? 'border-violet-300/25 bg-violet-300/[.06]'
                  : 'border-white/[.06] hover:bg-white/[.03]',
              )}
            >
              <div className="mb-2 flex aspect-video items-center justify-center rounded bg-[#101116] text-[9px] text-slate-600">
                {i + 1}
              </div>
              <div className="text-[10px] text-slate-400">{t}</div>
            </button>
          ))}
          {slide === 3 && (
            <div className="rounded-lg border border-violet-300/20 bg-violet-300/[.04] p-3 text-[10px] text-violet-100">
              New slide · temporary
            </div>
          )}
        </Panel>
        <Panel className="flex min-h-[510px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-3">
            <span className="text-[10px] text-slate-500">
              Untitled direction · sample deck
            </span>
            <span className="text-[9px] text-slate-600">
              Slide {slide + 1} of {slide === 3 ? 4 : 3}
            </span>
          </div>
          <div className="grid flex-1 place-items-center bg-[#111319] p-5">
            <div className="relative aspect-video w-full max-w-[680px] overflow-hidden rounded-lg border border-white/[.08] bg-[radial-gradient(ellipse_at_80%_15%,rgba(117,102,217,.18),transparent_40%),linear-gradient(125deg,#191b25,#12141a)] p-7 sm:p-12">
              <div className="absolute right-[12%] top-[20%] h-[60%] w-[30%] rounded-full border border-violet-300/[.12]" />
              <div className="relative max-w-[65%]">
                <div className="text-[8px] uppercase tracking-[.2em] text-violet-200/70">
                  Fieldnotes · working narrative
                </div>
                <h2 className="display mt-5 text-[clamp(1.3rem,4vw,2.7rem)] font-semibold leading-tight tracking-[-.06em]">
                  {[
                    'A quieter way to notice.',
                    'Start with a better question.',
                    'Then make room for change.',
                    'A new page',
                  ][slide] || 'A new page'}
                </h2>
                <p className="mt-4 max-w-xs text-[clamp(8px,1.3vw,12px)] leading-6 text-slate-400">
                  A sample slide canvas—crafted to preview hierarchy, not
                  generated content.
                </p>
              </div>
              <div className="absolute bottom-5 left-7 text-[8px] text-slate-600">
                AYATRISYA · PRESENTATION PREVIEW
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-3">
            <Button
              variant="quiet"
              onClick={() => setSlide(Math.max(0, slide - 1))}
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button
              variant="quiet"
              onClick={() => setSlide(Math.min(3, slide + 1))}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="text-xs font-semibold">Speaker notes</div>
          <p className="mt-1 text-[10px] text-slate-600">
            Temporary preview notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for this slide…"
            className="mt-4 min-h-40 w-full resize-y rounded-lg border border-white/[.08] bg-[#101116] p-3 text-xs placeholder:text-slate-600"
          />
          <div className="mt-2 text-[9px] text-slate-600">
            {notes.length} characters · not saved
          </div>
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() =>
              notify('Slide content is a preview. Nothing has been saved.')
            }
          >
            <Check size={14} />
            Done
          </Button>
        </Panel>
      </div>
      <div className="mt-4">
        <Notice>
          Slide thumbnails and notes are illustrative UI state; no presentation
          file exists outside this session.
        </Notice>
      </div>
    </div>
  );
}
