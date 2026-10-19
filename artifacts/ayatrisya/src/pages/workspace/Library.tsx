import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Download,
  FileImage,
  FileText,
  FolderKanban,
  Globe2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button, EmptyPreview, Panel } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';

export function LibraryPage({ notify }: { notify: (m: string) => void }) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('All items'),
    [sort, setSort] = useState('Recently used');
  const items = [
    {
      title: 'Product principles',
      type: 'Document',
      category: 'Documents',
      icon: <FileText size={16} />,
    },
    {
      title: 'Fieldnotes',
      type: 'Project',
      category: 'Projects',
      icon: <FolderKanban size={16} />,
    },
    {
      title: 'A clearer product narrative',
      type: 'Conversation',
      category: 'Conversations',
      icon: <MessageSquare size={16} />,
    },
    {
      title: 'Image studio canvas',
      type: 'Canvas',
      category: 'Images',
      icon: <FileImage size={16} />,
    },
    {
      title: 'Desktop workflow sample',
      type: 'Code project',
      category: 'Code projects',
      icon: <Code2 size={16} />,
    },
    {
      title: 'Research outline',
      type: 'Saved plan',
      category: 'Plans',
      icon: <BookOpen size={16} />,
    },
  ];
  const visible = items.filter(
    (i) =>
      (category === 'All items' || i.category === category) &&
      (i.title + i.type).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-[1160px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Library · storage preview"
        title="Your work, gathered in one place."
        description="A mock local library. Nothing is stored persistently; importing, exporting and cloud sync are not implemented."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                notify('Import is a UI preview. No file was read.')
              }
            >
              <Plus size={14} />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                notify('Export is a UI preview. No archive was created.')
              }
            >
              <Download size={14} />
              Export all
            </Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-3 text-slate-600"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your library…"
                className="h-10 w-full rounded-lg border border-white/[.08] bg-[#15171e] pl-9 pr-3 text-xs placeholder:text-slate-600"
              />
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter library category"
              className="h-10 rounded-lg border border-white/[.08] bg-[#15171e] px-3 text-xs text-slate-300"
            >
              {[
                'All items',
                'Documents',
                'Projects',
                'Conversations',
                'Images',
                'Code projects',
                'Plans',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort library"
              className="h-10 rounded-lg border border-white/[.08] bg-[#15171e] px-3 text-xs text-slate-300"
            >
              <option>Recently used</option>
              <option>Name A–Z</option>
              <option>Type</option>
            </select>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[.07]">
            {visible.map((i, n) => (
              <button
                key={i.title}
                onClick={() =>
                  notify(`${i.title} is an illustrative library item.`)
                }
                className="flex min-h-[62px] w-full items-center gap-3 border-b border-white/[.05] bg-[#15171e] px-4 text-left last:border-0 hover:bg-white/[.025]"
              >
                <span className="grid size-8 place-items-center rounded-lg border border-white/[.07] text-violet-200">
                  {i.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-300">
                    {i.title}
                  </span>
                  <span className="mt-1 block text-[9px] text-slate-600">
                    {i.type} · {n < 3 ? 'Sample' : 'Preview item'}
                  </span>
                </span>
                <span className="text-[9px] text-slate-600">
                  {n === 0 ? 'Today' : 'This week'}
                </span>
                <MoreHorizontal size={15} className="ml-3 text-slate-600" />
              </button>
            ))}
            {visible.length === 0 && (
              <div className="p-4">
                <EmptyPreview
                  title="Nothing matches that search"
                  detail="Try another term or clear the category filter."
                />
              </div>
            )}
          </div>
          <div className="mt-3 text-[10px] text-slate-600">
            Sorted by {sort} · {visible.length} illustrative items
          </div>
        </div>
        <aside className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-violet-200" />
              <h2 className="text-xs font-semibold">Memory summary</h2>
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-500">
              No workspace memory has been created. This panel previews where a
              user-controlled summary could appear.
            </p>
            <button
              onClick={() => notify('Memory controls are a future feature.')}
              className="mt-3 text-[10px] text-violet-200 hover:text-white"
            >
              Review memory controls{' '}
              <ArrowRight size={12} className="ml-1 inline" />
            </button>
          </Panel>
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold">Storage</h2>
              <span className="text-[9px] text-amber-200/70">Illustrative</span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <span className="display text-xl font-semibold">1.8 GB</span>
              <span className="text-[10px] text-slate-600">
                of 10 GB example
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.07]">
              <div className="h-full w-[18%] rounded-full bg-violet-300/60" />
            </div>
            <p className="mt-3 text-[10px] leading-5 text-slate-600">
              Example values only. No storage usage is measured.
            </p>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-xs font-semibold">Connections</h2>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <Globe2 size={14} />
              Google Drive{' '}
              <span className="ml-auto text-[9px] text-slate-600">
                Not connected
              </span>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() =>
                notify('Google Drive integration is planned, not connected.')
              }
            >
              Connection preview
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
