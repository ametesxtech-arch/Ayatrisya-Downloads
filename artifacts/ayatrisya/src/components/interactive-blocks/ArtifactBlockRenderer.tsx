import React, { useState } from 'react';
import {
  Globe,
  FileText,
  Table as TableIcon,
  Presentation,
  Code2,
  ExternalLink,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Search,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { useOptionalCanvas } from '../canvas/CanvasContext';
import { downloadText } from '@/lib/format';
import { downloadZip } from '@/lib/zip-export';
import { downloadPdf } from '@/lib/pdf-export';
import { downloadDocx } from '@/lib/docx-export';
import { downloadPptx } from '@/lib/pptx-export';

export interface ArtifactBlockData {
  version?: string;
  type: 'artifact';
  artifactKind: 'website' | 'document' | 'spreadsheet' | 'presentation' | 'code';
  title: string;
  description?: string;
  content: string; // HTML, markdown, CSV, JSON slides, or code
  fileName?: string;
  language?: string;
  url?: string;
}

export function ArtifactBlockRenderer({ block }: { block: ArtifactBlockData }) {
  const canvas = useOptionalCanvas();
  const [copied, setCopied] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sheetSearch, setSheetSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');

  const kind = block.artifactKind || 'document';
  const title = block.title || 'Interactive Artifact';
  const fileName = block.fileName || `${title.toLowerCase().replace(/[^\w-]/g, '_')}`;

  const copy = () => {
    navigator.clipboard.writeText(block.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openInCanvas = () => {
    if (canvas) {
      canvas.openCanvas({
        name: fileName.includes('.') ? fileName : `${fileName}.${kind === 'website' ? 'html' : kind === 'presentation' ? 'json' : 'md'}`,
        content: block.content,
        language: kind === 'website' ? 'html' : kind === 'code' ? block.language || 'typescript' : 'markdown',
      });
      window.open('/workspace/canvas', '_blank');
    }
  };

  // 1. Website / HTML Sandbox Preview
  if (kind === 'website') {
    const previewHtml = block.content.includes('<html')
      ? block.content
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;background:#f8fafc;}</style></head><body>${block.content}</body></html>`;

    return (
      <div className="my-4 overflow-hidden rounded-2xl border border-teal-500/30 bg-[#0d0e12] shadow-xl" data-testid="artifact-website">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.03] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-teal-500/15 text-teal-300">
              <Globe size={13} />
            </span>
            <span className="font-heading font-semibold text-white">{title}</span>
            <span className="rounded bg-teal-500/10 px-1.5 py-0.5 font-mono text-[10px] text-teal-300">Website Preview</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'preview' ? 'source' : 'preview')}
              className="rounded px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[.08] hover:text-white"
            >
              {activeTab === 'preview' ? 'Source' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={openInCanvas}
              title="Open full interactive preview in Canvas IDE"
              className="flex items-center gap-1 rounded bg-teal-500/20 px-2.5 py-1 text-[11px] font-medium text-teal-300 hover:bg-teal-500/30"
            >
              <Maximize2 size={11} /> Canvas
            </button>
            <button
              type="button"
              onClick={() => downloadText(`${fileName}.html`, block.content)}
              title="Download HTML file"
              className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            >
              <Download size={13} />
            </button>
          </div>
        </div>

        {activeTab === 'preview' ? (
          <div className="relative h-72 w-full bg-white">
            <iframe
              srcDoc={previewHtml}
              title={title}
              sandbox="allow-scripts allow-forms allow-popups"
              className="size-full border-0"
            />
          </div>
        ) : (
          <pre className="max-h-72 overflow-auto p-4 font-mono text-xs text-slate-300 bg-[#08090c]">
            <code>{block.content}</code>
          </pre>
        )}
      </div>
    );
  }

  // 2. Spreadsheet / Data Table Preview
  if (kind === 'spreadsheet') {
    // Parse CSV or Markdown table into rows
    const lines = block.content.trim().split('\n').filter(Boolean);
    const isCsv = block.content.includes(',') && !block.content.includes('|');
    const rows = lines.map((l) => (isCsv ? l.split(',').map((c) => c.trim().replace(/^["']|["']$/g, '')) : l.split('|').map((c) => c.trim()).filter(Boolean)));
    const headers = rows[0] || [];
    const bodyRows = rows.slice(rows[1] && rows[1][0]?.includes('---') ? 2 : 1);

    const filtered = bodyRows.filter((r) =>
      !sheetSearch ? true : r.some((cell) => cell.toLowerCase().includes(sheetSearch.toLowerCase()))
    );

    return (
      <div className="my-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0d0e12] shadow-xl" data-testid="artifact-spreadsheet">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.03] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
              <FileSpreadsheet size={13} />
            </span>
            <span className="font-heading font-semibold text-white">{title}</span>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
              Spreadsheet ({bodyRows.length} rows)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-2 text-slate-500" />
              <input
                type="text"
                value={sheetSearch}
                onChange={(e) => setSheetSearch(e.target.value)}
                placeholder="Filter rows..."
                className="h-7 w-32 rounded-lg border border-white/10 bg-black/40 pl-6 pr-2 text-[11px] text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => downloadText(`${fileName}.csv`, block.content)}
              title="Download CSV"
              className="flex items-center gap-1 rounded bg-white/[.06] px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/[.12]"
            >
              <Download size={11} /> CSV
            </button>
          </div>
        </div>

        <div className="max-h-64 overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#161821] text-slate-200">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="border-b border-white/10 px-3.5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.04] text-slate-300">
              {filtered.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[.02]">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 3. Presentation / Slide Deck Preview
  if (kind === 'presentation') {
    let slides: Array<{ title: string; bullets?: string[]; content?: string }> = [];
    try {
      if (block.content.trim().startsWith('{')) {
        const parsed = JSON.parse(block.content);
        slides = parsed.slides || [];
      } else {
        // Markdown headers as slides
        const parts = block.content.split(/(?=^# )/m).filter(Boolean);
        slides = parts.map((part) => {
          const lines = part.trim().split('\n');
          const slideTitle = lines[0].replace(/^#+\s*/, '');
          const bullets = lines.slice(1).map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
          return { title: slideTitle, bullets };
        });
      }
    } catch {
      slides = [{ title, content: block.content }];
    }

    if (slides.length === 0) {
      slides = [{ title, content: block.content }];
    }

    const activeSlide = slides[currentSlide] || slides[0];

    return (
      <div className="my-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0d0e12] shadow-xl" data-testid="artifact-presentation">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.03] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
              <Presentation size={13} />
            </span>
            <span className="font-heading font-semibold text-white">{title}</span>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
              Deck ({slides.length} slides)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const pptxSlides = slides.map((s, idx) => ({
                  id: `slide-${idx + 1}`,
                  title: s.title,
                  body: (s.bullets || []).join('\n') || (s.content || ''),
                  layout: 'bullets' as const,
                }));
                void downloadPptx(fileName, pptxSlides);
              }}
              className="flex items-center gap-1 rounded bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30"
              title="Download PowerPoint Presentation (.pptx)"
            >
              <Download size={11} /> .PPTX
            </button>
          </div>
        </div>

        {/* Slide viewport */}
        <div className="relative flex aspect-video w-full flex-col justify-center rounded-b-xl bg-gradient-to-br from-[#181a24] to-[#0f1017] p-8 text-center sm:p-12">
          <span className="mb-2 font-mono text-[11px] uppercase tracking-widest text-amber-400/80">
            Slide {currentSlide + 1} of {slides.length}
          </span>
          <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">{activeSlide.title}</h2>
          {activeSlide.bullets && activeSlide.bullets.length > 0 && (
            <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-xs sm:text-sm text-slate-300">
              {activeSlide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {activeSlide.content && (
            <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-slate-300">{activeSlide.content}</p>
          )}

          {/* Navigation Controls */}
          <div className="absolute inset-x-4 bottom-3 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              disabled={currentSlide === 0}
              onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
              className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              disabled={currentSlide === slides.length - 1}
              onClick={() => setCurrentSlide((p) => Math.min(slides.length - 1, p + 1))}
              className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Document / Report Preview
  const wordsCount = block.content.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-violet-500/30 bg-[#0d0e12] shadow-xl" data-testid="artifact-document">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.03] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
            <FileText size={13} />
          </span>
          <span className="font-heading font-semibold text-white">{title}</span>
          <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
            Document ({wordsCount} words)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void downloadPdf(title, block.content)}
            className="flex items-center gap-1 rounded bg-white/[.06] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[.12]"
            title="Export PDF"
          >
            <Download size={11} /> PDF
          </button>
          <button
            type="button"
            onClick={() => void downloadDocx(title, block.content)}
            className="flex items-center gap-1 rounded bg-white/[.06] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[.12]"
            title="Export DOCX"
          >
            <Download size={11} /> DOCX
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            title="Copy document text"
          >
            {copied ? <Check size={13} className="text-teal-300" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-4 sm:p-5 font-reading text-sm leading-relaxed text-slate-200 bg-[#12141a]">
        <div className="prose prose-invert prose-sm max-w-none">
          {block.content}
        </div>
      </div>
    </div>
  );
}
