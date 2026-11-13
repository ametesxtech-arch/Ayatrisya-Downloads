import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  RefreshCw,
  Edit3,
  Check,
  X,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { AIMemorySummaryEngine } from '@/storage/ai-memory-summary-engine';
import { repository } from '@/storage/repository';
import type { AIMemorySummary } from '@/storage/types';
import { ago } from '@/lib/format';

interface AIMemorySummaryCardProps {
  notify?: (msg: string) => void;
}

export function AIMemorySummaryCard({ notify }: AIMemorySummaryCardProps) {
  const [engine] = useState(() => new AIMemorySummaryEngine(repository));
  const [summary, setSummary] = useState<AIMemorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    preferencesAndStyle: true,
    activeProjects: true,
    technicalEnvironment: true,
    goalsAndPlans: true,
  });

  const loadSummary = async () => {
    try {
      setLoading(true);
      let res = await engine.getSummary();
      if (!res) {
        // Automatically synthesize initial summary if memories exist
        const memEngine = new MemoryEngine(repository);
        const existingMemories = await memEngine.listMemories();
        if (existingMemories.length > 0) {
          res = await engine.generateSummary();
        }
      }
      setSummary(res);
      if (res?.overview) {
        setOverviewDraft(res.overview);
      }
    } catch {
      notify?.('Could not load AI Memory Summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const handleSynthesize = async () => {
    try {
      setGenerating(true);
      const fresh = await engine.generateSummary();
      setSummary(fresh);
      setOverviewDraft(fresh.overview);
      notify?.('AI Memory Summary synthesized successfully.');
    } catch (err: any) {
      notify?.(err?.message || 'Synthesis failed. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveOverview = async () => {
    try {
      const updated = await engine.saveSummary({ overview: overviewDraft.trim() });
      setSummary(updated);
      setEditingOverview(false);
      notify?.('Summary overview updated.');
    } catch {
      notify?.('Failed to save summary overview.');
    }
  };

  const handleClearSummary = async () => {
    if (!window.confirm('Are you sure you want to clear the AI Memory Summary? Your underlying detailed memories will be preserved.')) {
      return;
    }
    try {
      await engine.deleteSummary();
      setSummary(null);
      setOverviewDraft('');
      notify?.('AI Memory Summary cleared.');
    } catch {
      notify?.('Failed to clear memory summary.');
    }
  };

  const handleWipeAll = async () => {
    if (!window.confirm('CAUTION: This will permanently delete ALL detailed memories and your persistent AI Memory Summary. Proceed?')) {
      return;
    }
    try {
      await engine.clearAllMemorySystem();
      setSummary(null);
      setOverviewDraft('');
      notify?.('All AI memories and summaries permanently cleared.');
    } catch {
      notify?.('Failed to wipe memory system.');
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionsConfig: Array<{
    key: keyof AIMemorySummary['sections'];
    label: string;
    description: string;
    badgeColor: string;
  }> = [
    {
      key: 'preferencesAndStyle',
      label: 'Preferences & Communication Style',
      description: 'Tone, response length, language preferences, formatting habits',
      badgeColor: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    },
    {
      key: 'backgroundContext',
      label: 'Background Context',
      description: 'Domain knowledge, company/team context, study background',
      badgeColor: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    },
    {
      key: 'activeProjects',
      label: 'Active Projects',
      description: 'Repositories, active initiatives, current feature branches',
      badgeColor: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    },
    {
      key: 'technicalEnvironment',
      label: 'Technical Environment & Tools',
      description: 'Tech stack, runtime versions, packages, databases, cloud tools',
      badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    },
    {
      key: 'goalsAndPlans',
      label: 'Goals & Plans',
      description: 'Milestones, learning objectives, delivery goals',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    },
    {
      key: 'importantDecisions',
      label: 'Important Decisions',
      description: 'Architecture choices, framework picks, design commitments',
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    },
    {
      key: 'ongoingTasks',
      label: 'Ongoing Work & Unresolved Tasks',
      description: 'Pending items, unresolved bugs, active experiments',
      badgeColor: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    },
    {
      key: 'constraintsAndInstructions',
      label: 'Constraints & Instructions',
      description: 'Fixed rules, prohibited dependencies, security requirements',
      badgeColor: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    },
  ];

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-[#181a24] to-[#12141c] p-5 shadow-xl sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[.07] pb-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
            <Brain size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">AI Memory Summary Engine</h3>
              <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                Layer B
              </span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Auto-Maintained
              </span>
              {summary?.version ? (
                <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                  v{summary.version}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Autonomous cross-conversation profile consolidated into 8 structured focus domains.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleSynthesize()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-50"
            title="Consolidate all detailed memories and conversation milestones into this summary"
          >
            <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Refreshing…' : 'Refresh Summary (Optional)'}
          </button>

          {summary && (
            <button
              type="button"
              onClick={() => void handleClearSummary()}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/10"
              title="Clear summary only (detailed memories preserved)"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Reset Summary</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading AI Memory Summary…</div>
      ) : !summary ? (
        <div className="my-6 rounded-xl border border-dashed border-white/10 bg-white/[.015] p-6 text-center">
          <Sparkles className="mx-auto size-8 text-violet-400/60" />
          <h4 className="mt-2 text-sm font-medium text-slate-300">AI Memory Summary (Maintained Automatically)</h4>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Ayatrisya automatically identifies your preferences, project context, and decisions from your conversations and keeps this summary continuously updated in the background. No manual summary building is required.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Automatic Maintenance Active
            </span>
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleSynthesize()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[.08] disabled:opacity-50"
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Refreshing…' : 'Refresh Summary (Optional)'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Overview Section */}
          <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Core Summary Overview
              </span>
              {!editingOverview ? (
                <button
                  type="button"
                  onClick={() => setEditingOverview(true)}
                  className="flex items-center gap-1 text-[11px] text-violet-300 hover:underline"
                >
                  <Edit3 size={11} /> Edit
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveOverview()}
                    className="flex items-center gap-1 rounded bg-teal-600 px-2 py-0.5 text-[10px] text-white"
                  >
                    <Check size={11} /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOverview(false);
                      setOverviewDraft(summary.overview);
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                  >
                    <X size={11} /> Cancel
                  </button>
                </div>
              )}
            </div>

            {editingOverview ? (
              <textarea
                value={overviewDraft}
                onChange={(e) => setOverviewDraft(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#0e1017] p-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-400/50"
                placeholder="High-level user profile..."
              />
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-300 italic">
                {summary.overview || 'No overview text provided.'}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 border-t border-white/[.05] pt-2.5">
              <span>Last updated: {ago(summary.lastSynthesizedAt)}</span>
              <span>•</span>
              <span>Based on {summary.totalSourceMemoriesCount} detailed memories</span>
              <span>•</span>
              <span className="text-violet-300/80">
                {summary.isAiGenerated ? 'Synthesized by AI' : 'User edited'}
              </span>
            </div>
          </div>

          {/* 8 Structured Sections Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {sectionsConfig.map(({ key, label, description, badgeColor }) => {
              const items = summary.sections[key] || [];
              const isExpanded = !!expandedSections[key];

              return (
                <div
                  key={key}
                  className="rounded-xl border border-white/[.07] bg-[#14161f] p-3.5 transition hover:border-white/[.12]"
                >
                  <div
                    onClick={() => toggleSection(key)}
                    className="flex cursor-pointer items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{label}</span>
                        <span className={`rounded border px-1.5 py-0.2 text-[9px] font-medium ${badgeColor}`}>
                          {items.length}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">{description}</p>
                    </div>
                    <button
                      type="button"
                      className="text-slate-500 hover:text-slate-300"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-white/[.05] pt-2.5">
                      {items.length === 0 ? (
                        <p className="text-[11px] italic text-slate-600">No recorded items in this section.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-300 leading-snug">
                              <span className="text-violet-400 select-none">•</span>
                              <span className="flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Danger zone actions */}
          <div className="flex items-center justify-between border-t border-white/[.07] pt-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Info size={13} />
              <span>Layer B memory is injected with high priority into response generation prompts.</span>
            </div>
            <button
              type="button"
              onClick={() => void handleWipeAll()}
              className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
            >
              <AlertTriangle size={12} />
              Wipe Entire Memory Store
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

