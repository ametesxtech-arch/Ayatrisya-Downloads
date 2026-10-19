import { useState } from 'react';
import {
  ChevronDown,
  Download,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Button, Notice, Panel } from '@/components/Primitives';
import { sampleDocs } from '@/data/fixtures';
import { cx } from '@/lib/cx';
import { PageHeading } from '@/components/PageHeading';

export function DocumentsPage({
  detail,
  notify,
  goto,
}: {
  detail: boolean;
  notify: (m: string) => void;
  goto: (href: string) => void;
}) {
  const [doc, setDoc] = useState(sampleDocs[0]),
    [text, setText] = useState(sampleDocs[0].text),
    [outline, setOutline] = useState(true),
    [exportMenu, setExportMenu] = useState(false),
    [format, setFormat] = useState('Paragraph');
  if (detail) {
    return (
      <div className="mx-auto max-w-[1200px] p-4 sm:p-8">
        <PageHeading
          eyebrow="Document editor · session preview"
          title={doc.title}
          description="A local mock document. Changes live only in this page session and are not permanently saved."
          actions={
            <>
              <button
                onClick={() => setOutline(!outline)}
                className="rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5"
              >
                Outline
              </button>
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setExportMenu(!exportMenu)}
                >
                  <Download size={14} />
                  Export <ChevronDown size={13} />
                </Button>
                {exportMenu && (
                  <div className="absolute right-0 top-12 z-20 w-40 rounded-lg border border-white/10 bg-[#1b1d25] p-1 shadow-xl">
                    {['PDF', 'Markdown', 'Plain text'].map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          notify(
                            `${f} export is a preview; no file was created.`,
                          );
                          setExportMenu(false);
                        }}
                        className="block w-full rounded px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[.06]"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          }
        />
        <div
          className={cx(
            'grid gap-5',
            outline ? 'lg:grid-cols-[190px_1fr]' : 'grid-cols-1',
          )}
        >
          <Panel className="flex min-h-[620px] flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-white/[.06] p-2">
              <select
                aria-label="Text style"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="h-8 rounded-md border border-white/[.08] bg-[#101116] px-2 text-[10px]"
              >
                {['Paragraph', 'Heading 1', 'Heading 2', 'Quote', 'Code'].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
              {['B', 'I', 'U', '• List', '↔ Align'].map((x, i) => (
                <button
                  key={x}
                  onClick={() =>
                    notify(`${x} formatting is a toolbar preview.`)
                  }
                  className="h-8 rounded px-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[.06]"
                >
                  {x}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-slate-600">
                Preview · unsaved
              </span>
            </div>
            <div className="mx-auto w-full max-w-[720px] flex-1 px-7 py-10 sm:px-14">
              <div className="mb-7 text-[9px] uppercase tracking-[.18em] text-slate-600">
                {format} · {doc.kind}
              </div>
              <input
                aria-label="Document title"
                value={doc.title}
                onChange={(e) => setDoc({ ...doc, title: e.target.value })}
                className="display w-full bg-transparent text-3xl font-semibold tracking-[-.05em] outline-none"
              />
              <textarea
                aria-label="Document content"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-7 min-h-[360px] w-full resize-y bg-transparent text-[14px] leading-8 text-slate-300 outline-none"
              />
              <div className="mt-6 border-t border-white/[.06] pt-3 text-[10px] text-slate-600">
                Changes are temporary. No permanent save is active.
              </div>
            </div>
          </Panel>
          {outline && (
            <aside>
              <Panel className="p-4">
                <h2 className="text-xs font-semibold">Outline</h2>
                <button className="mt-4 block text-left text-xs text-slate-400 hover:text-white">
                  {doc.title}
                </button>
                <button
                  onClick={() =>
                    notify('No heading structure has been defined.')
                  }
                  className="mt-3 block text-xs text-slate-600 hover:text-slate-300"
                >
                  Add section
                </button>
              </Panel>
            </aside>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              notify('New document created in this page session.');
              setDoc({
                title: 'Untitled document',
                kind: 'Document',
                updated: 'Just now',
                text: '',
              });
              setText('');
            }}
          >
            <FilePlus2 size={14} />
            New document
          </Button>
          <Button variant="quiet" onClick={() => goto('/workspace/documents')}>
            Back to documents
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Documents · mock workspace"
        title="A place for words to become work."
        description="Sample documents are illustrative. Open and edit them in temporary page state; permanent storage is not implemented."
        actions={
          <Button
            onClick={() => {
              setDoc({
                title: 'Untitled document',
                kind: 'Document',
                updated: 'Just now',
                text: '',
              });
              setText('');
              goto('/workspace/documents/new');
            }}
          >
            <Plus size={15} />
            New document
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <button className="rounded-full bg-violet-300/[.1] px-3 py-1.5 text-[10px] text-violet-100">
          All files · 3
        </button>
        <button
          onClick={() => notify('Showing recent sample documents.')}
          className="rounded-full border border-white/[.07] px-3 py-1.5 text-[10px] text-slate-500 hover:text-white"
        >
          Recent
        </button>
        <button
          onClick={() => goto('/workspace/presentations')}
          className="rounded-full border border-white/[.07] px-3 py-1.5 text-[10px] text-slate-500 hover:text-white"
        >
          Presentations
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sampleDocs.map((d, i) => (
          <button
            key={d.title}
            onClick={() => {
              setDoc(d);
              setText(d.text);
              goto(`/workspace/documents/${i + 1}`);
            }}
            className="group rounded-xl border border-white/[.07] bg-[#15171e] p-5 text-left transition hover:border-white/[.14] hover:bg-[#191b23]"
          >
            <div className="mb-7 flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg border border-violet-300/10 bg-violet-300/[.05] text-violet-200">
                <FileText size={16} />
              </span>
              <MoreHorizontal
                size={16}
                className="text-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  notify('Document options are a preview.');
                }}
              />
            </div>
            <h2 className="text-sm font-semibold text-slate-200">{d.title}</h2>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
              {d.text}
            </p>
            <div className="mt-5 flex justify-between text-[9px] text-slate-600">
              <span>{d.kind} · sample</span>
              <span>{d.updated}</span>
            </div>
          </button>
        ))}
      </div>
      <Notice>
        New documents and edits are temporary session state. No file is
        permanently saved or exported.
      </Notice>
    </div>
  );
}
