import { useState } from 'react';
import { Activity, Download, Sparkles } from 'lucide-react';
import { Button, Modal, Panel } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';

export function ImagesPage({ notify }: { notify: (m: string) => void }) {
  const [prompt, setPrompt] = useState(''),
    [style, setStyle] = useState('Editorial'),
    [ratio, setRatio] = useState('1:1'),
    [count, setCount] = useState('1'),
    [lightbox, setLightbox] = useState(false),
    [history, setHistory] = useState(false);
  return (
    <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Image studio · model unavailable"
        title="Give a visual idea a little space."
        description="Prompt and composition controls are a UI preview. Image generation is unavailable until Ayatrisya’s own image model is ready."
        actions={
          <Button variant="outline" onClick={() => setHistory(!history)}>
            <Activity size={14} />
            Prompt history
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[350px_1fr]">
        <Panel className="p-5">
          <label className="block text-xs font-semibold">
            Describe the image
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="A still life, a place, a visual mood…"
              className="mt-2 w-full resize-y rounded-lg border border-white/[.09] bg-[#101116] p-3 text-sm placeholder:text-slate-600"
            />
          </label>
          <label className="mt-4 block text-xs font-medium text-slate-400">
            Visual direction
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-white/[.09] bg-[#101116] px-3 text-xs"
            >
              {[
                'Editorial',
                'Architectural',
                'Film still',
                'Abstract',
                'Ink and paper',
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-400">
              Aspect ratio
              <select
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-white/[.09] bg-[#101116] px-3 text-xs"
              >
                {['1:1', '4:3', '3:2', '16:9', '9:16'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-400">
              Outputs
              <select
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-white/[.09] bg-[#101116] px-3 text-xs"
              >
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4</option>
              </select>
            </label>
          </div>
          <Button
            className="mt-5 w-full"
            onClick={() =>
              notify(
                'Image generation is unavailable. Your prompt was not sent to any service.',
              )
            }
          >
            <Sparkles size={15} />
            Generate preview
          </Button>
          <p className="mt-3 text-center text-[10px] text-slate-600">
            Generation unavailable · no API connected
          </p>
          {history && (
            <div className="mt-5 rounded-lg border border-white/[.07] p-3">
              <div className="text-xs font-semibold">Prompt history</div>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">
                History is empty. Prompts are not stored between sessions.
              </p>
            </div>
          )}
        </Panel>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-300">
              Gallery{' '}
              <span className="ml-1 font-normal text-slate-600">
                · 0 generated
              </span>
            </h2>
            <Button
              variant="quiet"
              onClick={() => notify('There are no images to export.')}
            >
              <Download size={14} />
              Export
            </Button>
          </div>
          <button
            onClick={() => setLightbox(true)}
            aria-label="Open image studio placeholder preview"
            className="group block w-full overflow-hidden rounded-xl border border-white/[.07] text-left"
          >
            <div className="relative grid min-h-[360px] place-items-center overflow-hidden bg-[#13151b] p-6">
              <div className="absolute left-[20%] top-[15%] h-44 w-44 rounded-full bg-violet-400/[.09] blur-[70px]" />
              <div className="absolute bottom-[8%] right-[14%] h-52 w-52 rounded-full bg-blue-400/[.07] blur-[80px]" />
              <div className="relative grid h-[190px] w-[min(78%,360px)] place-items-center overflow-hidden rounded-xl border border-white/[.08] bg-[linear-gradient(135deg,#1b1c26,#151923_55%,#1c202a)]">
                <div className="absolute left-[14%] top-[19%] h-[62%] w-[34%] rounded-t-[45%] border border-violet-200/10 bg-violet-300/[.035]" />
                <div className="absolute bottom-[14%] right-[15%] h-[44%] w-[42%] rounded-[48%_48%_8%_8%] border border-blue-200/10 bg-blue-200/[.035]" />
                <span className="relative rounded-full border border-white/10 bg-[#111318]/70 px-3 py-1.5 text-[9px] uppercase tracking-[.16em] text-slate-400">
                  Canvas placeholder
                </span>
              </div>
              <span className="absolute bottom-4 left-4 rounded border border-white/[.08] bg-[#101116]/70 px-2 py-1 text-[9px] text-slate-500">
                {style} · {ratio}
              </span>
              <span className="absolute bottom-4 right-4 text-[9px] text-slate-600">
                Not a generated image
              </span>
            </div>
          </button>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[.06] px-4 py-3 text-[10px] text-slate-500">
            <span>
              {prompt || 'No prompt submitted'} · {count} output
            </span>
            <button
              onClick={() =>
                notify(
                  'Image export will be available when generation is implemented.',
                )
              }
              className="hover:text-white"
            >
              Save / export
            </button>
          </div>
        </div>
      </div>
      {lightbox && (
        <Modal
          title="Image studio · canvas placeholder"
          onClose={() => setLightbox(false)}
        >
          <p className="text-sm leading-6 text-slate-400">
            This visual is an original CSS composition used to preview the
            gallery layout. It is not model output and cannot be downloaded as
            generated artwork.
          </p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => setLightbox(false)}
          >
            Close preview
          </Button>
        </Modal>
      )}
    </div>
  );
}
