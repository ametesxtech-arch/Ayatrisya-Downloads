import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Upload,
  Search,
  Package,
  Download,
  CheckCircle,
  FileUp,
  Layers,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { KnowledgeBaseEngine } from '@/storage/knowledge-engine';
import { SeedEngine } from '@/storage/seed-engine';
import { repository } from '@/storage/repository';
import type { KnowledgeBase, KnowledgeDocument, KnowledgeSeedManifest } from '@/storage/types';
import { downloadBlob } from '@/storage/backup';

export function KnowledgeBaseManager({ notify }: { notify: (m: string) => void }) {
  const [kbEngine] = useState(() => new KnowledgeBaseEngine(repository));
  const [seedEngine] = useState(() => new SeedEngine(repository));

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeKbId, setActiveKbId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create KB State
  const [isCreating, setIsCreating] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [newKbTags, setNewKbTags] = useState('');

  // Upload Doc State
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed Modal State
  const [isExportingSeed, setIsExportingSeed] = useState(false);
  const [seedName, setSeedName] = useState('');
  const [includeMemoriesInSeed, setIncludeMemoriesInSeed] = useState(true);

  // Seed Import State
  const seedInputRef = useRef<HTMLInputElement>(null);

  const loadKbs = async () => {
    setLoading(true);
    try {
      const list = await kbEngine.listKnowledgeBases({ search: search.trim() || undefined });
      setKnowledgeBases(list);
      if (list.length > 0 && (!activeKbId || !list.some((k) => k.id === activeKbId))) {
        setActiveKbId(list[0].id);
      }
    } catch {
      notify('Failed to load knowledge bases.');
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async (kbId: string) => {
    try {
      const docs = await kbEngine.listDocuments(kbId);
      setDocuments(docs);
    } catch {
      notify('Failed to load documents for knowledge base.');
    }
  };

  useEffect(() => {
    void loadKbs();
  }, [search]);

  useEffect(() => {
    if (activeKbId) {
      void loadDocs(activeKbId);
    } else {
      setDocuments([]);
    }
  }, [activeKbId]);

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    try {
      const created = await kbEngine.createKnowledgeBase({
        name: newKbName,
        description: newKbDesc,
        tags: newKbTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setNewKbName('');
      setNewKbDesc('');
      setNewKbTags('');
      setIsCreating(false);
      setActiveKbId(created.id);
      notify('Knowledge Base created.');
      void loadKbs();
    } catch (err: any) {
      notify(err.message || 'Failed to create knowledge base.');
    }
  };

  const handleDeleteKb = async (id: string) => {
    if (!window.confirm('Delete this Knowledge Base and all indexed documents?')) return;
    try {
      await kbEngine.deleteKnowledgeBase(id);
      notify('Knowledge Base deleted.');
      if (activeKbId === id) setActiveKbId(null);
      void loadKbs();
    } catch {
      notify('Could not delete Knowledge Base.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeKbId) return;

    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await kbEngine.ingestDocument({
        knowledgeBaseId: activeKbId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        mimeType: file.type || 'text/plain',
        fileBytes: bytes,
      });
      notify(`Ingested and indexed ${file.name}`);
      void loadDocs(activeKbId);
      void loadKbs();
    } catch (err: any) {
      notify(err.message || 'Document ingestion failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await kbEngine.deleteDocument(docId);
      notify('Document removed.');
      if (activeKbId) void loadDocs(activeKbId);
      void loadKbs();
    } catch {
      notify('Failed to delete document.');
    }
  };

  // Seed Export Handler
  const handleExportSeed = async () => {
    if (!activeKbId || !seedName.trim()) return;
    try {
      const { seedJson, manifest } = await seedEngine.exportSeed({
        name: seedName,
        knowledgeBaseIds: [activeKbId],
        includeMemories: includeMemoriesInSeed,
      });
      const blob = new Blob([seedJson], { type: 'application/json' });
      downloadBlob(blob, `${manifest.name.toLowerCase().replace(/\s+/g, '-')}.ayatrisya-seed.json`);
      setIsExportingSeed(false);
      setSeedName('');
      notify('Portable Knowledge Seed exported successfully.');
    } catch (err: any) {
      notify(err.message || 'Seed export failed.');
    }
  };

  // Seed Import Handler
  const handleImportSeedFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await seedEngine.importSeed(text);
      notify(`Imported Seed: ${result.importedBases} bases, ${result.importedDocuments} docs, ${result.importedMemories} memories.`);
      void loadKbs();
    } catch (err: any) {
      notify(err.message || 'Seed import failed.');
    } finally {
      if (seedInputRef.current) seedInputRef.current.value = '';
    }
  };

  const activeKb = knowledgeBases.find((k) => k.id === activeKbId);
  const cardClass = 'rounded-2xl border border-white/10 bg-[#14161f] p-5 shadow-lg backdrop-blur-sm';

  return (
    <div className="space-y-6" data-testid="knowledge-base-manager">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
              <BookOpen size={16} />
            </span>
            <h3 className="text-base font-semibold text-white">Knowledge Bases & Portable Seeds</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Ingest documents, chunk them for localized retrieval, and package knowledge into tamper-evident Seeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={seedInputRef}
            onChange={handleImportSeedFile}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => seedInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[.08] transition-colors"
            data-testid="button-import-seed"
          >
            <Package size={14} />
            Import Seed
          </button>

          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-semibold text-[#0a1e1a] hover:bg-teal-300 transition-colors"
            data-testid="button-create-kb"
          >
            <Plus size={14} />
            New Knowledge Base
          </button>
        </div>
      </div>

      {/* Create KB Drawer */}
      {isCreating && (
        <div className={`${cardClass} border-teal-500/30 bg-teal-950/10`}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-300 mb-3">Create Knowledge Base</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                placeholder="e.g. Distributed Systems & Algorithms"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 focus:border-teal-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={newKbDesc}
                onChange={(e) => setNewKbDesc(e.target.value)}
                placeholder="Brief summary of domain knowledge contained in this repository."
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 focus:border-teal-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tags</label>
              <input
                type="text"
                value={newKbTags}
                onChange={(e) => setNewKbTags(e.target.value)}
                placeholder="algorithms, distributed, cloud"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 focus:border-teal-400 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateKb}
                disabled={!newKbName.trim()}
                className="rounded-lg bg-teal-400 px-3.5 py-1.5 text-xs font-semibold text-[#0a1e1a] hover:bg-teal-300 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column View: KBs list on left, Document details on right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: List of KBs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Knowledge Repositories ({knowledgeBases.length})</span>
          </div>

          <div className="space-y-2">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                onClick={() => setActiveKbId(kb.id)}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  activeKbId === kb.id
                    ? 'border-teal-400/50 bg-teal-950/20 shadow-md'
                    : 'border-white/[.08] bg-white/[.02] hover:border-white/15'
                }`}
                data-testid={`kb-item-${kb.id}`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white truncate">{kb.name}</h4>
                  <span className="text-[10px] text-teal-300 font-mono">
                    {kb.documentCount} {kb.documentCount === 1 ? 'doc' : 'docs'}
                  </span>
                </div>
                {kb.description && (
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{kb.description}</p>
                )}
              </div>
            ))}

            {knowledgeBases.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
                No Knowledge Bases created yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active KB Detail & Document Ingestion */}
        <div className="md:col-span-2">
          {activeKb ? (
            <div className={`${cardClass} space-y-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{activeKb.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{activeKb.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSeedName(activeKb.name);
                      setIsExportingSeed(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-xs text-teal-300 hover:bg-teal-400/20"
                    title="Export as a portable Seed package"
                    data-testid="button-export-seed"
                  >
                    <Download size={13} />
                    Export Seed
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteKb(activeKb.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10"
                    title="Delete repository"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Ingestion Section */}
              <div className="rounded-xl border border-dashed border-teal-500/20 bg-teal-950/10 p-4 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.csv,.json,.pdf"
                  className="hidden"
                />
                <FileUp size={24} className="mx-auto text-teal-300 mb-2 opacity-80" />
                <p className="text-xs font-medium text-slate-200">
                  {uploading ? 'Processing & Indexing Document...' : 'Ingest Document into Knowledge Base'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                  Supports Markdown, Text, CSV, JSON, and PDF documents. Files are chunked and indexed locally.
                </p>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-semibold text-[#0a1e1a] hover:bg-teal-300 disabled:opacity-50"
                  data-testid="button-upload-doc"
                >
                  <Upload size={13} />
                  Select File
                </button>
              </div>

              {/* Indexed Documents List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Indexed Documents ({documents.length})
                </h4>

                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-xs"
                    data-testid={`document-item-${doc.id}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-teal-300" />
                      <div>
                        <span className="font-medium text-slate-200 block">{doc.title}</span>
                        <span className="text-[11px] text-slate-400">
                          {doc.fileName} • {doc.chunkCount} chunks • {Math.round(doc.fileSize / 1024)} KB
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Remove document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {documents.length === 0 && (
                  <p className="text-xs text-slate-500 py-2">No documents ingested in this repository yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className={`${cardClass} text-center py-12 text-xs text-slate-500`}>
              Select or create a Knowledge Base to inspect documents and export Seeds.
            </div>
          )}
        </div>
      </div>

      {/* Export Seed Modal Dialog */}
      {isExportingSeed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className={`${cardClass} max-w-md w-full border-teal-500/40 bg-[#12141a] space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/[.08] pb-3">
              <Package size={18} className="text-teal-300" />
              <h3 className="text-sm font-semibold text-white">Export Portable Knowledge Seed</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Seed Package Name</label>
                <input
                  type="text"
                  value={seedName}
                  onChange={(e) => setSeedName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeMemoriesInSeed}
                  onChange={(e) => setIncludeMemoriesInSeed(e.target.checked)}
                  className="accent-teal-400 rounded"
                />
                Bundle non-temporary AI memories with this Seed
              </label>
              <p className="text-[11px] text-slate-400">
                Seeds are tamper-evident packages protected by SHA-256 integrity validation. They can be safely restored or shared across workspaces.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[.08]">
              <button
                type="button"
                onClick={() => setIsExportingSeed(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportSeed}
                disabled={!seedName.trim()}
                className="rounded-lg bg-teal-400 px-3.5 py-1.5 text-xs font-semibold text-[#0a1e1a] hover:bg-teal-300 disabled:opacity-50"
              >
                Download Seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

