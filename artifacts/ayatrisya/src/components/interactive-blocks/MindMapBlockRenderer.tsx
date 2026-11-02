import React, { useState } from 'react';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { MindMapBlock, MindMapNode } from './types';

export function MindMapBlockRenderer({ block }: { block: MindMapBlock }) {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    function walk(node: MindMapNode) {
      if (node.collapsed) initial[node.id] = true;
      node.children?.forEach(walk);
    }
    if (block.root) walk(block.root);
    return initial;
  });
  const [fullscreen, setFullscreen] = useState(false);

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleCopyJson = () => {
    navigator.clipboard
      .writeText(JSON.stringify(block, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  const handleExportText = () => {
    function toIndentedText(node: MindMapNode, depth = 0): string {
      const indent = '  '.repeat(depth);
      const prefix = depth === 0 ? '# ' : depth === 1 ? '## ' : '- ';
      const line = `${indent}${prefix}${node.label}\n`;
      const childrenText = (node.children || [])
        .map((child) => toIndentedText(child, depth + 1))
        .join('');
      return line + childrenText;
    }
    const text = toIndentedText(block.root);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(block.title || block.root.label || 'mindmap')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!block.root || !block.root.label) {
    return (
      <div className="my-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300">
        <p className="font-semibold">Invalid Mind Map Data</p>
        <p className="mt-1 text-slate-400">The mind map does not contain a valid central topic.</p>
      </div>
    );
  }

  return (
    <div
      className={`interactive-mindmap my-4 overflow-hidden rounded-xl border border-white/10 bg-[#101218]/95 shadow-xl backdrop-blur-md transition-all ${
        fullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#0d0f14]' : ''
      }`}
      data-testid="interactive-mindmap-block"
      role="region"
      aria-label={block.title || 'Mind Map'}
    >
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
            <GitFork size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            {block.title || 'Interactive Mind Map'}
          </h4>
        </div>

        {/* Toolbar: Zoom, Reset, Export, Copy, Fullscreen */}
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="font-mono text-[11px] text-slate-400 min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Math.round((z + 0.15) * 100) / 100))}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw size={13} />
          </button>

          <span className="h-3.5 w-px bg-white/10 mx-1" />

          <button
            type="button"
            onClick={handleExportText}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/[.08]"
            title="Export Mind Map as Markdown"
          >
            <Download size={11} />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/[.08]"
            title="Copy JSON"
          >
            {copied ? <Check size={11} className="text-teal-300" /> : <Copy size={11} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Visual Canvas Area */}
      <div
        className={`relative overflow-auto p-6 select-none ${
          fullscreen ? 'flex-1' : 'max-h-[500px]'
        }`}
        style={{ cursor: 'grab' }}
      >
        <div
          className="flex min-w-max justify-center transition-transform duration-150 origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          <TreeNode
            node={block.root}
            depth={0}
            collapsedMap={collapsedNodes}
            onToggleCollapse={toggleCollapse}
            theme={block.theme || 'violet'}
          />
        </div>
      </div>

      {block.caption && (
        <div className="border-t border-white/[.06] bg-black/20 px-4 py-2 text-center text-[11px] text-slate-400">
          {block.caption}
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  collapsedMap,
  onToggleCollapse,
  theme,
}: {
  node: MindMapNode;
  depth: number;
  collapsedMap: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  theme: string;
}) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isCollapsed = Boolean(collapsedMap[node.id]);

  // Color styling based on depth & theme
  const getBadgeStyle = () => {
    if (depth === 0) {
      return 'border-violet-400/50 bg-gradient-to-r from-violet-600/30 to-purple-600/30 text-white font-semibold shadow-violet-500/10 shadow-lg px-4 py-2 text-sm';
    }
    if (depth === 1) {
      return 'border-teal-400/40 bg-teal-950/30 text-teal-200 font-medium px-3 py-1.5 text-xs';
    }
    if (depth === 2) {
      return 'border-amber-400/40 bg-amber-950/20 text-amber-200 px-2.5 py-1 text-xs';
    }
    return 'border-white/20 bg-white/[.04] text-slate-200 px-2 py-1 text-xs';
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Node Pill */}
      <div
        className={`group relative flex items-center gap-2 rounded-xl border backdrop-blur transition-all ${getBadgeStyle()}`}
      >
        <span>{node.label}</span>

        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            className="ml-1 rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white"
            title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
            aria-label={isCollapsed ? 'Expand branch' : 'Collapse branch'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Children Branches */}
      {hasChildren && !isCollapsed && (
        <div className="relative flex flex-col border-l border-white/20 pl-4 space-y-2">
          {node.children!.map((child) => (
            <div key={child.id} className="relative flex items-center">
              {/* Connector line */}
              <span className="absolute -left-4 top-1/2 h-px w-4 bg-white/20" />
              <TreeNode
                node={child}
                depth={depth + 1}
                collapsedMap={collapsedMap}
                onToggleCollapse={onToggleCollapse}
                theme={theme}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
