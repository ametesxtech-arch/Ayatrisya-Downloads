import { useState, useEffect, useRef } from 'react';
import { Brain, Plus, Trash2, Pin, Sparkles, AlertCircle, Edit2, Check, X, Tag, Download, FileText, Upload } from 'lucide-react';
import { MemoryEngine } from '@/storage/memory-engine';
import { repository } from '@/storage/repository';
import { IntelligentMemoryContextManager } from '@/storage/intelligent-memory-context-manager';
import type { MemoryCategory, MemoryEntry } from '@/storage/types';

export function MemoryManager({ notify }: { notify?: (msg: string) => void }) {
  const [engine] = useState(() => new MemoryEngine(repository));
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoCollection, setAutoCollection] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Memory Modal / Form
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('user_preference');
  const [newTags, setNewTags] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isTemporary, setIsTemporary] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadMemories = async () => {
    setLoading(true);
    try {
      const list = await engine.listMemories({
        category: selectedCategory === 'all' ? undefined : (selectedCategory as MemoryCategory),
        search: search.trim() || undefined,
      });
      setMemories(list);
    } catch {
      notify?.('Failed to load stored memories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMemories();
    void (async () => {
      try {
        const prefs = await repository.getPreferences();
        setAutoCollection(prefs.personalization.autoMemoryCollection !== false);
      } catch {}
    })();
  }, [selectedCategory, search]);

  const handleToggleAutoCollection = async () => {
    try {
      const nextVal = !autoCollection;
      const current = await repository.getPreferences();
      await repository.savePreferences({
        ...current,
        personalization: {
          ...current.personalization,
          autoMemoryCollection: nextVal,
        },
      });
      setAutoCollection(nextVal);
      notify?.(nextVal ? 'Automatic AI memory collection enabled.' : 'Automatic AI memory collection disabled.');
    } catch {
      notify?.('Could not update memory collection setting.');
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const mgr = new IntelligentMemoryContextManager(repository);
      const result = await mgr.importMemoriesFromJson(text);
      notify?.(`Imported ${result.count} memories successfully.`);
      void loadMemories();
    } catch (err: any) {
      notify?.(err?.message || 'Failed to import memories.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    try {
      await engine.createMemory({
        content: newContent,
        category: newCategory,
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
        pinned: isPinned,
        temporary: isTemporary,
      });
      setNewContent('');
      setNewTags('');
      setIsAdding(false);
      notify?.('Memory saved successfully.');
      void loadMemories();
    } catch (err: any) {
      notify?.(err.message || 'Failed to save memory.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await engine.deleteMemory(id);
      notify?.('Memory deleted.');
      void loadMemories();
    } catch {
      notify?.('Could not delete memory.');
    }
  };

  const handleTogglePin = async (entry: MemoryEntry) => {
    try {
      await engine.updateMemory(entry.id, { pinned: !entry.pinned });
      void loadMemories();
    } catch {
      notify?.('Failed to update memory.');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      await engine.updateMemory(id, { content: editContent });
      setEditingId(null);
      notify?.('Memory updated.');
      void loadMemories();
    } catch (err: any) {
      notify?.(err.message || 'Failed to update memory.');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all eligible AI memories? This action cannot be undone.')) {
      return;
    }
    try {
      const cleared = await engine.clearAllMemories();
      notify?.(`Cleared ${cleared} memories.`);
      void loadMemories();
    } catch {
      notify?.('Failed to clear memories.');
    }
  };

  const handleExportJson = async () => {
    try {
      const mgr = new IntelligentMemoryContextManager(repository);
      const json = await mgr.exportMemoriesAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ayatrisya-memories-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify?.('Exported memories as JSON.');
    } catch {
      notify?.('Failed to export memories.');
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const mgr = new IntelligentMemoryContextManager(repository);
      const md = await mgr.exportMemoriesAsMarkdown();
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ayatrisya-memories-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      notify?.('Exported memories as Markdown.');
    } catch {
      notify?.('Failed to export memories.');
    }
  };

  const cardClass = 'rounded-2xl border border-white/10 bg-[#14161f] p-5 shadow-lg backdrop-blur-sm';

  return (
    <div className="space-y-4" data-testid="ai-memory-manager">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Brain size={16} />
            </span>
            <h3 className="text-base font-semibold text-white">AI Memory Bank</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Transparent, structured memory items retained across conversations. You retain full control to edit or delete any entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Automatic Collection Toggle */}
          <button
            type="button"
            onClick={handleToggleAutoCollection}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
              autoCollection
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-white/10 bg-white/[.04] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle automatic memory extraction from chats"
            data-testid="toggle-auto-memory-collection"
          >
            <Sparkles size={12} className={autoCollection ? 'text-emerald-400' : 'text-slate-500'} />
            <span>Auto-Collection: {autoCollection ? 'Active' : 'Disabled'}</span>
          </button>

          {/* Import JSON Memory */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJson}
            accept=".json,application/json"
            className="hidden"
            data-testid="input-import-memories-file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import memories from JSON backup"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[.08]"
            data-testid="button-import-memories-json"
          >
            <Upload size={13} />
            Import
          </button>

          {memories.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportJson}
                title="Export memories as JSON"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[.08]"
                data-testid="button-export-memories-json"
              >
                <Download size={13} />
                JSON
              </button>
              <button
                type="button"
                onClick={handleExportMarkdown}
                title="Export memories as Markdown"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[.08]"
                data-testid="button-export-memories-md"
              >
                <FileText size={13} />
                MD
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:border-rose-400/30"
                data-testid="button-clear-all-memories"
              >
                <Trash2 size={13} />
                Clear all
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-400 px-3 py-1.5 text-xs font-semibold text-[#1a1830] hover:bg-violet-300 transition-colors"
            data-testid="button-add-memory"
          >
            <Plus size={14} />
            Add memory
          </button>
        </div>
      </div>

      {/* Add New Memory Drawer/Box */}
      {isAdding && (
        <div className={`${cardClass} border-violet-500/30 bg-violet-950/10`}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-3">Record New Memory</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Memory Content</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="e.g. Always generate TypeScript code with strict null checks"
                rows={2}
                maxLength={5000}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-200 focus:border-violet-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                  className="w-full rounded-lg border border-white/10 bg-[#0e1015] px-3 py-1.5 text-xs text-slate-200 focus:border-violet-400 focus:outline-none"
                >
                  <option value="user_preference">User Preference</option>
                  <option value="work_preference">Work Preference</option>
                  <option value="project_context">Project Context</option>
                  <option value="technical_decision">Technical Decision</option>
                  <option value="conversation_fact">Conversation Fact</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="typescript, frontend, react"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="accent-violet-400 rounded"
                />
                Pin (High priority)
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTemporary}
                  onChange={(e) => setIsTemporary(e.target.checked)}
                  className="accent-violet-400 rounded"
                />
                Temporary (Excluded from export)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newContent.trim()}
                className="rounded-lg bg-violet-400 px-3.5 py-1.5 text-xs font-semibold text-[#1a1830] hover:bg-violet-300 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#0e1015] px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="user_preference">User Preferences</option>
          <option value="work_preference">Work Preferences</option>
          <option value="project_context">Project Context</option>
          <option value="technical_decision">Technical Decisions</option>
          <option value="conversation_fact">Conversation Facts</option>
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter memories..."
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
        />
      </div>

      {/* Memories List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-500">Loading stored memories...</div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
          No memories found matching your criteria. Add key preferences or technical decisions to maintain context.
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className="group flex items-start justify-between gap-3 rounded-xl border border-white/[.08] bg-white/[.02] p-3.5 transition-colors hover:border-white/15"
              data-testid={`memory-item-${m.id}`}
            >
              <div className="flex-1 space-y-1">
                {editingId === m.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 rounded border border-violet-400 bg-black/50 px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(m.id)}
                      className="text-teal-300 hover:text-teal-200"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-200 leading-relaxed">{m.content}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                    {m.category.replace('_', ' ')}
                  </span>
                  {m.pinned && (
                    <span className="flex items-center gap-0.5 text-amber-300 font-medium">
                      <Pin size={10} /> Pinned
                    </span>
                  )}
                  {m.temporary && <span className="text-slate-500">(Temporary)</span>}
                  <span>•</span>
                  <span>{new Date(m.updatedAt).toLocaleDateString()}</span>
                  {m.tags.length > 0 && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Tag size={10} />
                      {m.tags.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleTogglePin(m)}
                  className={`p-1 rounded hover:bg-white/10 ${m.pinned ? 'text-amber-300' : 'text-slate-400'}`}
                  title={m.pinned ? 'Unpin' : 'Pin to top'}
                >
                  <Pin size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(m.id);
                    setEditContent(m.content);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                  title="Edit entry"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10"
                  title="Delete entry"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

