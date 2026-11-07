import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Minimize2,
  Search,
  Eye,
  FileSpreadsheet,
  TrendingUp,
  Layers,
  ArrowRight,
  Quote,
  Grid,
  ImageIcon,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useOptionalCanvas } from '../canvas/CanvasContext';
import { downloadText } from '@/lib/format';
import { downloadZip } from '@/lib/zip-export';
import { downloadPdf } from '@/lib/pdf-export';
import { downloadDocx } from '@/lib/docx-export';
import { downloadPptx } from '@/lib/pptx-export';

export interface SlideSmartArtItem {
  label: string;
  description?: string;
  value?: string;
  badge?: string;
  icon?: string;
}

export interface SlideSmartArt {
  type: 'steps' | 'cycle' | 'pyramid' | 'matrix' | 'kpi' | 'callout' | 'comparison';
  title?: string;
  items: SlideSmartArtItem[];
}

export interface SlideImage {
  url: string;
  caption?: string;
  alt?: string;
  source?: string;
}

export interface ParsedSlide {
  id?: string;
  title: string;
  subtitle?: string;
  tag?: string;
  content?: string;
  bullets?: string[];
  smartArt?: SlideSmartArt;
  image?: SlideImage | string;
  speakerNotes?: string;
}

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

/**
 * SmartArt Visual Component Renderer for In-Chat Presentations
 */
function SmartArtRenderer({ smartArt }: { smartArt?: SlideSmartArt }) {
  if (!smartArt || !Array.isArray(smartArt.items) || smartArt.items.length === 0) {
    return null;
  }

  const { type = 'kpi', items } = smartArt;

  // 1. KPI / Stat Cards
  if (type === 'kpi') {
    return (
      <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col rounded-xl border border-amber-500/20 bg-gradient-to-b from-white/[.06] to-white/[.02] p-2.5 text-left shadow-md backdrop-blur-sm"
          >
            {item.value && (
              <span className="font-heading text-lg sm:text-xl font-bold tracking-tight text-amber-300">
                {item.value}
              </span>
            )}
            <span className="font-reading text-[11px] sm:text-xs font-semibold text-white">
              {item.label}
            </span>
            {item.description && (
              <span className="mt-0.5 text-[10px] text-slate-400 leading-tight">
                {item.description}
              </span>
            )}
            {item.badge && (
              <span className="mt-1.5 self-start rounded bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-amber-300">
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 2. Sequential Process / Steps Flow
  if (type === 'steps' || type === 'cycle') {
    return (
      <div className="my-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <div className="flex max-w-[140px] flex-col rounded-xl border border-white/10 bg-white/[.04] p-2 text-left sm:max-w-[170px]">
              <div className="flex items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-amber-400/20 font-mono text-[10px] font-bold text-amber-300">
                  {idx + 1}
                </span>
                <span className="font-heading text-[11px] sm:text-xs font-semibold text-white truncate">
                  {item.label}
                </span>
              </div>
              {item.description && (
                <p className="mt-1 text-[10px] text-slate-300 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
            {idx < items.length - 1 && (
              <ArrowRight size={14} className="text-amber-400/60 shrink-0 hidden sm:block" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // 3. Matrix / Grid Cards
  if (type === 'matrix' || type === 'comparison') {
    return (
      <div className="my-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-white/10 bg-white/[.03] p-2.5 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-xs font-semibold text-white">
                {item.label}
              </span>
              {item.badge && (
                <span className="rounded bg-teal-500/10 px-1.5 py-0.5 font-mono text-[9px] text-teal-300">
                  {item.badge}
                </span>
              )}
            </div>
            {item.description && (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                {item.description}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 4. Highlight Callout Card
  return (
    <div className="my-3 rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-3 text-left">
      <div className="flex items-start gap-2">
        <Quote size={16} className="text-amber-300 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-heading text-xs font-semibold text-amber-200">
            {items[0]?.label}
          </h4>
          {items[0]?.description && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-200">
              {items[0].description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Curated Picture Display Component for Slides
 */
function SlideImageViewer({ image }: { image?: SlideImage | string }) {
  if (!image) return null;

  const url = typeof image === 'string' ? image : image.url;
  const caption = typeof image === 'object' ? image.caption : undefined;
  const source = typeof image === 'object' ? image.source || 'Curated CDN' : 'Web Resource';

  if (!url) return null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-lg transition-all hover:border-amber-400/40">
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        <img
          src={url}
          alt={caption || 'Slide Visual'}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      </div>
      {(caption || source) && (
        <div className="flex items-center justify-between gap-2 bg-[#12141c] px-2.5 py-1.5 text-[10px] text-slate-300">
          <span className="truncate">{caption || 'Curated Visual Graphic'}</span>
          <span className="shrink-0 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-slate-400">
            {source}
          </span>
        </div>
      )}
    </div>
  );
}

export function ArtifactBlockRenderer({ block }: { block: ArtifactBlockData }) {
  const canvas = useOptionalCanvas();
  const [copied, setCopied] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sheetSearch, setSheetSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
              onClick={() => downloadText(`${fileName}.html`, previewHtml)}
              title="Download HTML file"
              className="flex items-center gap-1 rounded bg-white/[.06] px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/[.12]"
            >
              <Download size={11} /> HTML
            </button>
            <button
              type="button"
              onClick={copy}
              className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
              title="Copy code"
            >
              {copied ? <Check size={13} className="text-teal-300" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {activeTab === 'preview' ? (
          <div className="relative aspect-video w-full bg-white">
            <iframe
              srcDoc={previewHtml}
              title={title}
              sandbox="allow-scripts allow-modals"
              className="size-full border-0"
            />
          </div>
        ) : (
          <pre className="max-h-80 overflow-auto bg-[#0a0b0e] p-4 font-mono text-xs text-slate-300">
            <code>{block.content}</code>
          </pre>
        )}
      </div>
    );
  }

  // 2. Spreadsheet / CSV Table Preview
  if (kind === 'spreadsheet') {
    const rows = block.content
      .trim()
      .split('\n')
      .map((r) => r.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));
    const headers = rows[0] || [];
    const bodyRows = rows.slice(1);
    const filtered = sheetSearch
      ? bodyRows.filter((r) => r.some((c) => c.toLowerCase().includes(sheetSearch.toLowerCase())))
      : bodyRows;

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

  // 3. Presentation / Slide Deck Preview (with SmartArt, Curated Pictures & Dual PPTX/PDF Export)
  if (kind === 'presentation') {
    let slides: ParsedSlide[] = [];
    try {
      if (block.content.trim().startsWith('{')) {
        const parsed = JSON.parse(block.content);
        slides = parsed.slides || [];
      } else {
        // Markdown headers as slides with image and bullet extraction
        const parts = block.content.split(/(?=^# )/m).filter(Boolean);
        slides = parts.map((part) => {
          const lines = part.trim().split('\n');
          const slideTitle = lines[0].replace(/^#+\s*/, '');
          const bullets: string[] = [];
          const textLines: string[] = [];
          let image: SlideImage | undefined;

          for (const line of lines.slice(1)) {
            const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
            if (imgMatch) {
              image = { caption: imgMatch[1], url: imgMatch[2] };
            } else if (/^[-*]\s+/.test(line)) {
              bullets.push(line.replace(/^[-*]\s*/, '').trim());
            } else if (line.trim()) {
              textLines.push(line.trim());
            }
          }

          return {
            title: slideTitle,
            bullets: bullets.length > 0 ? bullets : undefined,
            content: textLines.join(' '),
            image,
          };
        });
      }
    } catch {
      slides = [{ title, content: block.content }];
    }

    if (slides.length === 0) {
      slides = [{ title, content: block.content }];
    }

    const activeSlide = slides[currentSlide] || slides[0];

    // Download PDF version of presentation deck
    const handleDownloadPdfSlides = () => {
      const markdownDoc = slides
        .map((s, idx) => {
          const bullets = (s.bullets || []).map((b) => `• ${b}`).join('\n');
          const smartArtText = s.smartArt
            ? `\n\n[SmartArt: ${s.smartArt.type.toUpperCase()}]\n` +
              s.smartArt.items.map((it) => `- ${it.label}: ${it.description || it.value || ''}`).join('\n')
            : '';
          const imgText = s.image
            ? `\n\n[Visual: ${typeof s.image === 'string' ? s.image : s.image.caption || s.image.url}]`
            : '';
          return `# Slide ${idx + 1}: ${s.title}\n\n${s.content || ''}\n\n${bullets}${smartArtText}${imgText}`;
        })
        .join('\n\n---\n\n');

      void downloadPdf(`${fileName}-deck`, markdownDoc);
    };

    return (
      <div
        className={`my-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0d0e12] shadow-2xl transition-all ${isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#0b0d14]' : ''}`}
        data-testid="artifact-presentation"
      >
        {/* Slide Deck Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.03] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
              <Presentation size={13} />
            </span>
            <span className="font-heading font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{title}</span>
            <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/20">
              Deck ({slides.length} slides)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speaker Notes Toggle */}
            {activeSlide.speakerNotes && (
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${showNotes ? 'bg-amber-400/20 text-amber-300' : 'text-slate-300 hover:bg-white/[.08] hover:text-white'}`}
                title="Toggle Speaker Notes"
              >
                <MessageSquare size={12} /> Notes
              </button>
            )}

            {/* PowerPoint PPTX Download */}
            <button
              type="button"
              onClick={() => {
                const pptxSlides = slides.map((s, idx) => ({
                  id: `slide-${idx + 1}`,
                  title: s.title,
                  body: [
                    s.content || '',
                    ...(s.bullets || []).map((b) => `• ${b}`),
                    s.smartArt ? `[${s.smartArt.type.toUpperCase()}] ${s.smartArt.items.map((it) => it.label).join(' | ')}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                  layout: s.smartArt ? ('cards' as const) : ('bullets' as const),
                }));
                void downloadPptx(fileName, pptxSlides);
              }}
              className="flex items-center gap-1 rounded bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
              title="Download Genuine PowerPoint Presentation (.pptx)"
            >
              <Download size={11} /> .PPTX
            </button>

            {/* Presentation PDF Download */}
            <button
              type="button"
              onClick={handleDownloadPdfSlides}
              className="flex items-center gap-1 rounded bg-white/[.06] px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/[.12] border border-white/10"
              title="Download Presentation Deck as PDF"
            >
              <Download size={11} /> .PDF
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* Slide Viewport */}
        <div className={`relative flex flex-col justify-between overflow-y-auto bg-gradient-to-br from-[#161822] via-[#10121a] to-[#0a0b10] p-6 sm:p-8 ${isFullscreen ? 'flex-1' : 'min-h-[340px]'}`}>
          {/* Slide Top Badge & Category */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-amber-400/90 font-semibold">
              Slide {currentSlide + 1} of {slides.length}
            </span>
            {activeSlide.subtitle && (
              <span className="rounded-full bg-white/[.06] px-2.5 py-0.5 font-reading text-[10px] text-slate-300 border border-white/10">
                {activeSlide.subtitle}
              </span>
            )}
          </div>

          {/* Main Slide Content Grid */}
          <div className="my-auto py-4">
            <div className={`grid gap-5 items-center ${activeSlide.image ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1'}`}>
              {/* Text & SmartArt Column */}
              <div className={activeSlide.image ? 'md:col-span-7' : 'max-w-2xl mx-auto text-left w-full'}>
                <h2 className="font-heading text-lg sm:text-2xl font-bold tracking-tight text-white mb-2.5">
                  {activeSlide.title}
                </h2>

                {activeSlide.content && (
                  <p className="font-reading text-xs sm:text-sm leading-relaxed text-slate-200 mb-3">
                    {activeSlide.content}
                  </p>
                )}

                {/* Bullets */}
                {activeSlide.bullets && activeSlide.bullets.length > 0 && (
                  <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 mb-3">
                    {activeSlide.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Embedded SmartArt */}
                <SmartArtRenderer smartArt={activeSlide.smartArt} />
              </div>

              {/* Curated Picture Column */}
              {activeSlide.image && (
                <div className="md:col-span-5 flex flex-col justify-center">
                  <SlideImageViewer image={activeSlide.image} />
                </div>
              )}
            </div>
          </div>

          {/* Speaker Notes Drawer */}
          {showNotes && activeSlide.speakerNotes && (
            <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-left animate-in fade-in-50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                <MessageSquare size={12} /> Speaker Notes (Script):
              </div>
              <p className="mt-1 font-reading text-xs text-slate-200 leading-relaxed italic">
                "{activeSlide.speakerNotes}"
              </p>
            </div>
          )}

          {/* Slide Navigation Bar */}
          <div className="flex items-center justify-between border-t border-white/[.06] pt-3 text-xs text-slate-400">
            <button
              type="button"
              disabled={currentSlide === 0}
              onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} /> Previous Slide
            </button>

            {/* Quick jump dots */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] px-2 py-1 scrollbar-none">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`size-2 rounded-full transition-all ${idx === currentSlide ? 'w-5 bg-amber-400' : 'bg-white/20 hover:bg-white/40'}`}
                  aria-label={`Jump to slide ${idx + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={currentSlide === slides.length - 1}
              onClick={() => setCurrentSlide((p) => Math.min(slides.length - 1, p + 1))}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
            >
              Next Slide <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Structured Document / Report Preview (PDF & DOCX Export)
  const wordsCount = block.content.trim().split(/\s+/).filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.ceil(wordsCount / 200));

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-violet-500/30 bg-[#0d0e12] shadow-xl" data-testid="artifact-document">
      {/* Document Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] bg-white/[.03] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
            <FileText size={13} />
          </span>
          <span className="font-heading font-semibold text-white truncate max-w-xs">{title}</span>
          <span className="rounded bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-300 border border-violet-500/20">
            Document ({wordsCount} words · {readingTimeMin} min read)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* PDF Export */}
          <button
            type="button"
            onClick={() => void downloadPdf(title, block.content)}
            className="flex items-center gap-1 rounded bg-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 transition-colors"
            title="Download formatted PDF Document"
          >
            <Download size={11} /> .PDF
          </button>

          {/* DOCX Export */}
          <button
            type="button"
            onClick={() => void downloadDocx(title, block.content)}
            className="flex items-center gap-1 rounded bg-white/[.06] px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/[.12] border border-white/10 transition-colors"
            title="Download Word Document (.docx)"
          >
            <Download size={11} /> .DOCX
          </button>

          {/* Open in Canvas */}
          <button
            type="button"
            onClick={openInCanvas}
            title="Open in Canvas IDE"
            className="flex items-center gap-1 rounded bg-white/[.06] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/[.12] border border-white/10"
          >
            <Maximize2 size={11} /> Canvas
          </button>

          {/* Copy Text */}
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

      {/* Formatted Human-Like Editorial Document Content */}
      <div className="max-h-96 overflow-y-auto p-5 sm:p-6 font-reading text-sm leading-relaxed text-slate-200 bg-[#12141a]">
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="mt-4 mb-2 text-xl font-bold font-heading text-white border-b border-white/10 pb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="mt-4 mb-2 text-base font-semibold font-heading text-white">{children}</h2>,
              h3: ({ children }) => <h3 className="mt-3 mb-1 text-sm font-semibold font-heading text-slate-200">{children}</h3>,
              p: ({ children }) => <p className="my-2 leading-relaxed text-slate-300">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1 text-slate-300">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1 text-slate-300">{children}</ol>,
              blockquote: ({ children }) => (
                <blockquote className="my-3 border-l-2 border-violet-400/80 bg-violet-500/[.05] p-3 text-slate-200 rounded-r-lg italic">
                  {children}
                </blockquote>
              ),
              img: ({ src, alt }) => (
                <div className="my-4 overflow-hidden rounded-xl border border-white/15 bg-black/40">
                  <img src={src} alt={alt || 'Document Illustration'} className="w-full max-h-72 object-cover" loading="lazy" />
                  {alt && <div className="bg-[#10121a] px-3 py-1.5 text-xs text-slate-400 italic text-center">{alt}</div>}
                </div>
              ),
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full border-collapse text-xs text-slate-300">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border-b border-white/10 bg-white/[.05] px-3 py-2 text-left font-medium text-white">{children}</th>,
              td: ({ children }) => <td className="border-b border-white/[.04] px-3 py-1.5">{children}</td>,
            }}
          >
            {block.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
