import React, { useState } from 'react';
import { Workflow, Copy, Check, Maximize2 } from 'lucide-react';
import type { DiagramBlock } from './types';

export function DiagramBlockRenderer({ block }: { block: DiagramBlock }) {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(block.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  // Convert simple diagram definitions into clean SVG flowchart nodes if applicable
  const lines = block.code.split('\n').map((l) => l.trim()).filter(Boolean);
  const nodeConnections: Array<{ from: string; to: string; label?: string }> = [];

  for (const line of lines) {
    const match = line.match(/(.+?)\s*-->\s*(?:\|(.+?)\|)?\s*(.+)/);
    if (match) {
      nodeConnections.push({
        from: match[1].replace(/[[()\]]/g, '').trim(),
        label: match[2]?.trim(),
        to: match[3].replace(/[[()\]]/g, '').trim(),
      });
    }
  }

  return (
    <div
      className="interactive-diagram my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-diagram-block"
      role="region"
      aria-label={block.title || 'Diagram'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-purple-500/15 text-purple-300">
            <Workflow size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-300">
            {block.title || (block.diagramType === 'mermaid' ? 'Mermaid Diagram' : 'Flowchart')}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRaw((p) => !p)}
            className="text-[11px] text-slate-400 hover:text-white"
          >
            {showRaw ? 'Show Visual' : 'View Code'}
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/[.08]"
            title="Copy diagram source"
          >
            {copied ? <Check size={11} className="text-teal-300" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {showRaw || nodeConnections.length === 0 ? (
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-slate-200">
          <code>{block.code}</code>
        </pre>
      ) : (
        /* Visual Node Representation */
        <div className="space-y-3 py-2">
          {nodeConnections.map((conn, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg border border-purple-500/30 bg-purple-950/20 px-3 py-1.5 font-medium text-purple-200">
                {conn.from}
              </span>
              <span className="font-mono text-slate-500 flex items-center gap-1">
                ──{conn.label ? `[${conn.label}]` : ''}──▶
              </span>
              <span className="rounded-lg border border-teal-500/30 bg-teal-950/20 px-3 py-1.5 font-medium text-teal-200">
                {conn.to}
              </span>
            </div>
          ))}
        </div>
      )}

      {block.caption && (
        <p className="mt-2.5 text-[11px] text-slate-500 text-center">{block.caption}</p>
      )}
    </div>
  );
}
