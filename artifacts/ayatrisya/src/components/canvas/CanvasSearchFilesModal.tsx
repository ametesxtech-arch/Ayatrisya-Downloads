import React, { useState, useMemo } from 'react';
import { Search, X, FileCode, ArrowRight } from 'lucide-react';
import type { CanvasFile } from './types';

interface CanvasSearchFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: CanvasFile[];
  onSelectResult: (fileId: string, line: number) => void;
}

export function CanvasSearchFilesModal({
  isOpen,
  onClose,
  files,
  onSelectResult,
}: CanvasSearchFilesModalProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const matches: Array<{
      file: CanvasFile;
      line: number;
      text: string;
      matchIndex: number;
    }> = [];

    const lowerQuery = query.toLowerCase();

    for (const file of files) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const matchIdx = lineText.toLowerCase().indexOf(lowerQuery);
        if (matchIdx !== -1) {
          matches.push({
            file,
            line: i + 1,
            text: lineText.trim(),
            matchIndex: matchIdx,
          });
          if (matches.length >= 80) break; // performance limit
        }
      }
      if (matches.length >= 80) break;
    }

    return matches;
  }, [query, files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-16 backdrop-blur-sm">
      <div className="flex h-full max-h-[70vh] w-full max-w-2xl flex-col rounded-2xl border border-violet-500/30 bg-[#141320] shadow-2xl overflow-hidden font-mono text-xs">
        {/* Search Input Bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#181628] px-3">
          <div className="flex flex-1 items-center gap-2">
            <Search size={15} className="text-violet-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all project files (Ctrl+Shift+F)..."
              className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {query.trim().length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic">
              No matches found for "{query}".
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="p-8 text-center text-slate-500">
              Type at least 2 characters to search across all files.
            </div>
          )}

          {results.map((res, idx) => (
            <div
              key={`${res.file.id}-${res.line}-${idx}`}
              onClick={() => {
                onSelectResult(res.file.id, res.line);
                onClose();
              }}
              className="group flex items-center justify-between p-2 rounded-lg bg-white/[.02] hover:bg-violet-500/15 border border-white/[.04] hover:border-violet-500/30 cursor-pointer transition"
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                <FileCode size={13} className="text-violet-400 shrink-0" />
                <span className="font-semibold text-slate-200 shrink-0">{res.file.name}</span>
                <span className="text-[10px] text-violet-300 font-bold bg-violet-500/20 px-1.5 py-0.5 rounded shrink-0">
                  :{res.line}
                </span>
                <span className="text-slate-400 truncate text-[11px] font-mono ml-2">
                  {res.text}
                </span>
              </div>
              <ArrowRight size={13} className="text-slate-500 group-hover:text-violet-300 opacity-0 group-hover:opacity-100 shrink-0 transition" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex h-9 shrink-0 items-center justify-between border-t border-white/[.08] bg-[#100f1a] px-3 text-[11px] text-slate-500">
          <span>{results.length} match{results.length === 1 ? '' : 'es'} found</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
