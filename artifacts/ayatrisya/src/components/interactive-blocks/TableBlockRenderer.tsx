import React, { useState, useMemo } from 'react';
import { Table, Search, ArrowUpDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { TableBlock } from './types';

export function TableBlockRenderer({ block }: { block: TableBlock }) {
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filteredRows = useMemo(() => {
    let rows = block.rows;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      rows = rows.filter((row) =>
        row.some((cell) => String(cell).toLowerCase().includes(q))
      );
    }
    if (sortCol !== null && sortCol < block.headers.length) {
      rows = [...rows].sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return rows;
  }, [block.rows, block.headers.length, filter, sortCol, sortAsc]);

  const handleHeaderClick = (colIdx: number) => {
    if (!block.sortable) return;
    if (sortCol === colIdx) {
      setSortAsc((p) => !p);
    } else {
      setSortCol(colIdx);
      setSortAsc(true);
    }
  };

  return (
    <div
      className="interactive-table my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-table-block"
      role="region"
      aria-label={block.title || 'Data Table'}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
            <Table size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-300">
            {block.title || 'Data Table'}
          </h4>
        </div>

        {block.filterable && (
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search rows..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-7 rounded-md border border-white/10 bg-black/40 pl-7 pr-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[.04]">
              {block.headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleHeaderClick(i)}
                  className={`p-3 font-semibold text-slate-200 ${
                    block.sortable ? 'cursor-pointer hover:bg-white/[.04] transition-colors select-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{h}</span>
                    {block.sortable && <ArrowUpDown size={11} className="text-slate-500" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.06]">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[.02] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-3 text-slate-300">
                      {typeof cell === 'string' && (cell.includes('$') || cell.includes('\\')) ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                          components={{
                            p: ({ children }) => <span>{children}</span>,
                          }}
                        >
                          {cell}
                        </ReactMarkdown>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={block.headers.length} className="p-4 text-center text-slate-500">
                  No matching rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
