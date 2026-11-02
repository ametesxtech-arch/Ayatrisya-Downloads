import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  BookOpen,
  FileText,
  ExternalLink,
  Download,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Database,
  StickyNote,
} from 'lucide-react';
import { ItemCollection } from '@/components/ItemCollection';
import { KnowledgeBaseManager } from '@/components/KnowledgeBaseManager';
import { executeDeepResearch, type ResearchReport, type ResearchProgress } from '@/ai/research-engine';
import { downloadPdf } from '@/lib/pdf-export';
import { usePrefs } from '@/hooks/use-prefs';

export function ResearchPage({ notify }: { notify: (m: string) => void }) {
  const [tab, setTab] = useState<'agent' | 'knowledge' | 'notes'>('agent');
  const { prefs } = usePrefs();

  // Research Agent State
  const [researchTopic, setResearchTopic] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [progressState, setProgressState] = useState<ResearchProgress | null>(null);
  const [activeReport, setActiveReport] = useState<ResearchReport | null>(null);

  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = researchTopic.trim();
    if (!query || isResearching) return;

    setIsResearching(true);
    setActiveReport(null);
    setProgressState({ step: 'planning', message: 'Initiating Autonomous Research Engine…' });

    try {
      const report = await executeDeepResearch(query, {
        model: prefs.model,
        mode: prefs.mode,
        onProgress: (p) => setProgressState(p),
        saveToWorkspace: true,
      });

      setActiveReport(report);
      notify(`Research complete: "${report.topic}" saved to Documents.`);
    } catch (err: any) {
      notify(`Research failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsResearching(false);
    }
  };

  const handleExportPdf = () => {
    if (!activeReport) return;
    try {
      downloadPdf(
        activeReport.markdown,
        `Research-${activeReport.topic.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        { title: `Research: ${activeReport.topic}` }
      );
      notify('Exported research report as PDF.');
    } catch (e: any) {
      notify(`PDF export error: ${e?.message || 'Failed'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-white/[.08] pb-3 text-xs font-medium">
        <button
          type="button"
          onClick={() => setTab('agent')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
            tab === 'agent'
              ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          data-testid="tab-research-agent"
        >
          <Sparkles size={13} className="text-teal-400" />
          <span>Autonomous Research Agent</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('knowledge')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
            tab === 'knowledge'
              ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          data-testid="tab-knowledge-bases"
        >
          <Database size={13} />
          <span>Knowledge Bases & Seeds</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('notes')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
            tab === 'notes'
              ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          data-testid="tab-research-notes"
        >
          <StickyNote size={13} />
          <span>Research Notes</span>
        </button>
      </div>

      {tab === 'agent' && (
        <div className="space-y-6">
          {/* Hero Form Card */}
          <div className="rounded-xl border border-white/10 bg-[#12141c]/90 p-5 sm:p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} />
              <span>Multi-Step Deep Research</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white tracking-tight">
              Investigate Any Topic with Corroborated Evidence
            </h2>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Plans sub-questions, searches literature databases, extracts corroborated findings, identifies contradictions, and synthesizes structured reports with verified citations.
            </p>

            <form onSubmit={handleStartResearch} className="mt-5 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                  disabled={isResearching}
                  placeholder="e.g. Solid-state battery breakthroughs and commercialization bottlenecks in 2026..."
                  className="w-full rounded-lg border border-white/10 bg-black/50 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                />
              </div>
              <button
                type="submit"
                disabled={isResearching || !researchTopic.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-40 transition shadow"
              >
                <Sparkles size={13} />
                <span>{isResearching ? 'Investigating…' : 'Start Research'}</span>
              </button>
            </form>

            {/* In-Flight Progress */}
            {isResearching && progressState && (
              <div className="mt-4 rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 text-xs text-teal-300 flex items-center gap-3">
                <RotateCcw size={14} className="animate-spin text-teal-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold uppercase tracking-wide text-[10px] text-teal-400">
                    Step: {progressState.step}
                  </div>
                  <div>{progressState.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Active Report View */}
          {activeReport && (
            <div className="rounded-xl border border-white/10 bg-[#0f111a] p-5 sm:p-7 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Verified Research Report</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">{activeReport.topic}</h3>
                  <p className="text-xs text-slate-400 mt-1">Generated {new Date(activeReport.generatedAt).toLocaleString()} · Saved to local Documents</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[.08] transition"
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="rounded-lg bg-white/[.02] border border-white/[.06] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Executive Summary</h4>
                <p className="text-xs leading-relaxed text-slate-300">{activeReport.summary}</p>
              </div>

              {/* Key Findings */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300 mb-2.5 flex items-center gap-1.5">
                  <CheckCircle size={14} />
                  <span>Key Findings</span>
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeReport.keyFindings.map((finding, idx) => (
                    <div key={idx} className="rounded-lg border border-teal-500/20 bg-teal-500/[.03] p-3 text-xs text-slate-200">
                      {finding}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contradictions & Debates */}
              {activeReport.contradictionsAndDebates.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2.5 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Open Contradictions & Methodological Debates</span>
                  </h4>
                  <div className="space-y-2">
                    {activeReport.contradictionsAndDebates.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-amber-500/20 bg-amber-500/[.03] p-3 text-xs text-amber-100">
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Sections */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Detailed Section Analysis</h4>
                {activeReport.detailedSections.map((sec, idx) => (
                  <div key={idx} className="rounded-lg border border-white/[.06] bg-black/30 p-4 space-y-1.5">
                    <h5 className="text-xs font-bold text-white">{sec.title}</h5>
                    <p className="text-xs leading-relaxed text-slate-300">{sec.content}</p>
                  </div>
                ))}
              </div>

              {/* References & Citations */}
              <div className="pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <BookOpen size={14} />
                  <span>Verified Citations & Sources</span>
                </h4>
                <div className="space-y-2">
                  {activeReport.sources.map((src, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-white/[.04] bg-white/[.01] p-2.5 text-xs">
                      <div>
                        <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                          <span>[{idx + 1}] {src.title}</span>
                          <span className="rounded bg-teal-500/10 px-1.5 py-0.2 text-[9px] text-teal-400 border border-teal-500/20">Verified</span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">{src.snippet}</p>
                      </div>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white shrink-0 p-1"
                        title="Open Source"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'knowledge' && <KnowledgeBaseManager notify={notify} />}

      {tab === 'notes' && (
        <ItemCollection
          kind="note"
          tag="research"
          noun="note"
          eyebrow="Research notes"
          heading="Keep sources and questions together."
          description="Plain notes stored in this browser. Organized alongside your local knowledge bases."
          notify={notify}
          templates={[
            { name: 'Blank note', description: 'Free-form.', content: '' },
            { name: 'Source log', description: 'Track a source, claims and doubts.', content: 'Source:\nLink:\nKey claims:\n\nWhat I trust:\n\nWhat I doubt:\n' },
            { name: 'Question map', description: 'A question and what you know so far.', content: 'Question:\n\nWhat I know:\n\nWhat I need to find out:\n' },
          ]}
        />
      )}
    </div>
  );
}
