import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Play,
  RotateCcw,
  RotateCw,
  Copy,
  Download,
  Sparkles,
  Check,
  Split,
  Eye,
  FileCode,
  Terminal,
  ShieldAlert,
} from 'lucide-react';
import { useCanvas } from './CanvasContext';
import { modelClient } from '@/ai/client';
import { usePrefs } from '@/hooks/use-prefs';

const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'html',
  'css',
  'python',
  'rust',
  'go',
  'json',
  'markdown',
  'sql',
];

export function CanvasPanel() {
  const {
    isOpen,
    files,
    activeFileId,
    activeFile,
    pendingDiff,
    canUndo,
    canRedo,
    closeCanvas,
    addFile,
    removeFile,
    setActiveFile,
    updateContent,
    updateLanguage,
    updateFileName,
    stagePatch,
    acceptPatch,
    rejectPatch,
    undo,
    redo,
  } = useCanvas();

  const { prefs } = usePrefs();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'console'>('editor');
  const [promptText, setPromptText] = useState('');
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);

  if (!isOpen || !activeFile) return null;

  const lines = activeFile.content.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const ext = newFileName.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      html: 'html',
      css: 'css',
      py: 'python',
      rs: 'rust',
      go: 'go',
      json: 'json',
      md: 'markdown',
    };
    addFile({
      name: newFileName.trim(),
      language: langMap[ext] || 'typescript',
      content: `// ${newFileName.trim()}\n`,
    });
    setNewFileName('');
    setIsAddingFile(false);
  };

  // AI Prompt to Edit / Refactor Active File
  const handleAiEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || isAiBusy) return;
    setIsAiBusy(true);

    try {
      const messages = [
        {
          role: 'user' as const,
          content: `You are Ayatrisya's Code Canvas assistant.
User requested edit: "${promptText.trim()}".
Current file: ${activeFile.name} (${activeFile.language}).
File content:
\`\`\`${activeFile.language}
${activeFile.content}
\`\`\`

Return ONLY the complete updated file content. Do not include markdown code fences, greetings, or conversational remarks. Output the raw code directly.`,
        },
      ];

      const job = modelClient.submitJob({
        kind: 'chat',
        messages,
        options: {
          model: prefs.model,
          mode: prefs.mode,
        },
      });

      let result = await job.result;
      // Strip any accidental markdown fences if returned
      if (result.startsWith('```')) {
        result = result.replace(/^```[a-zA-Z0-9_-]*\n?/, '');
        if (result.endsWith('```')) result = result.slice(0, -3);
      }

      stagePatch(result);
      setPromptText('');
    } catch (err) {
      alert(`AI modification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAiBusy(false);
    }
  };

  // Safe Execution in Sandboxed iframe (HTML/JS/CSS)
  const isWebExecutable = ['html', 'javascript', 'typescript'].includes(activeFile.language);

  const sandboxedHtml = useMemo(() => {
    if (activeFile.language === 'html') {
      return activeFile.content;
    }
    if (activeFile.language === 'javascript' || activeFile.language === 'typescript') {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; background: #0e1017; color: #e2e8f0; padding: 16px; margin: 0; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const log = console.log;
    console.log = (...args) => {
      log(...args);
      const div = document.createElement('div');
      div.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      document.body.appendChild(div);
    };
    try {
      ${activeFile.content}
    } catch (e) {
      console.log('Error: ' + e.message);
    }
  </script>
</body>
</html>`;
    }
    return '';
  }, [activeFile.content, activeFile.language]);

  // Unified Diff Lines Calculation
  const diffLines = useMemo(() => {
    if (!pendingDiff) return [];
    const origLines = pendingDiff.original.split('\n');
    const propLines = pendingDiff.proposed.split('\n');
    const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];

    const maxLen = Math.max(origLines.length, propLines.length);
    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i];
      const prop = propLines[i];
      if (orig === prop) {
        if (orig !== undefined) result.push({ type: 'same', text: orig });
      } else {
        if (orig !== undefined) result.push({ type: 'removed', text: orig });
        if (prop !== undefined) result.push({ type: 'added', text: prop });
      }
    }
    return result;
  }, [pendingDiff]);

  return (
    <div
      className="canvas-side-panel flex h-full w-full md:w-[480px] lg:w-[560px] xl:w-[620px] shrink-0 flex-col border-l border-white/10 bg-[#0d0e12] text-slate-200 z-30 shadow-2xl"
      data-testid="canvas-panel"
      role="region"
      aria-label="Code Canvas Workspace"
    >
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-white/[.08] bg-[#12141a] px-3 py-1.5">
        <div className="flex items-center gap-2 overflow-x-auto">
          {files.map((f) => (
            <div
              key={f.id}
              onClick={() => setActiveFile(f.id)}
              className={`group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono cursor-pointer transition-colors ${
                f.id === activeFileId
                  ? 'bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30'
                  : 'text-slate-400 hover:bg-white/[.04] hover:text-white'
              }`}
            >
              <FileCode size={12} />
              <span>{f.name}</span>
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-300 transition-opacity"
                  title="Close tab"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          {isAddingFile ? (
            <form onSubmit={handleCreateFile} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder="filename.ts"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onBlur={() => setIsAddingFile(false)}
                className="h-6 w-28 rounded bg-black/50 px-1.5 font-mono text-[11px] text-white border border-white/20 focus:outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingFile(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/[.06] hover:text-white"
              title="Add new file"
            >
              <Plus size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeCanvas}
            className="rounded p-1 text-slate-400 hover:bg-white/[.08] hover:text-white"
            title="Close Canvas"
            data-testid="canvas-close-button"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[.06] bg-[#101218] px-3 py-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={activeFile.language}
            onChange={(e) => updateLanguage(e.target.value)}
            className="h-7 rounded border border-white/10 bg-[#0d0e12] px-2 font-mono text-[11px] text-teal-300 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* Undo / Redo */}
          <button
            type="button"
            disabled={!canUndo}
            onClick={undo}
            className="p-1 hover:text-white disabled:opacity-30"
            title="Undo"
          >
            <RotateCcw size={12} />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={redo}
            className="p-1 hover:text-white disabled:opacity-30"
            title="Redo"
          >
            <RotateCw size={12} />
          </button>

          <span className="text-slate-600">|</span>

          {/* Editor vs Preview tabs */}
          <div className="flex items-center rounded border border-white/10 bg-black/40 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`rounded px-2 py-0.5 ${
                activeTab === 'editor' ? 'bg-white/[.08] text-white font-medium' : 'text-slate-400'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`rounded px-2 py-0.5 flex items-center gap-1 ${
                activeTab === 'preview' ? 'bg-white/[.08] text-white font-medium' : 'text-slate-400'
              }`}
            >
              <Eye size={10} />
              Preview
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/[.06] hover:text-white text-[11px]"
            title="Copy code"
            data-testid="canvas-copy-button"
          >
            {copied ? <Check size={11} className="text-teal-300" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/[.06] hover:text-white text-[11px]"
            title="Download file"
          >
            <Download size={11} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Body */}
      <div className="relative flex-1 overflow-hidden">
        {/* Pending Diff Review Modal / Overlay */}
        {pendingDiff && (
          <div
            className="absolute inset-0 z-20 flex flex-col bg-[#0b0c10]/95 backdrop-blur-md p-4"
            data-testid="canvas-diff-view"
          >
            <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Split size={14} className="text-amber-300" />
                <span className="text-xs font-semibold text-white">
                  Review AI Code Modifications: {pendingDiff.path}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rejectPatch}
                  className="rounded border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[.06]"
                  data-testid="canvas-reject-diff"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={acceptPatch}
                  className="rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-teal-400"
                  data-testid="canvas-accept-diff"
                >
                  Accept Changes
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    line.type === 'added'
                      ? 'bg-emerald-950/40 text-emerald-200'
                      : line.type === 'removed'
                        ? 'bg-rose-950/40 text-rose-300'
                        : 'text-slate-300'
                  }`}
                >
                  <span className="w-6 select-none opacity-40">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 1: Code Editor */}
        {activeTab === 'editor' && (
          <div className="flex h-full overflow-hidden">
            {/* Line numbers gutter */}
            <div
              className="select-none bg-[#090a0d] px-3 py-3 text-right font-mono text-xs leading-relaxed text-slate-600 border-r border-white/[.04]"
              aria-hidden
            >
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Textarea Code Editor */}
            <textarea
              value={activeFile.content}
              onChange={(e) => updateContent(e.target.value)}
              spellCheck={false}
              className="h-full flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none selection:bg-teal-500/30"
              data-testid="canvas-editor-textarea"
              aria-label="Code Editor"
            />
          </div>
        )}

        {/* Tab 2: Sandboxed Web Preview */}
        {activeTab === 'preview' && (
          <div className="h-full w-full bg-black/80 flex flex-col">
            {isWebExecutable ? (
              <iframe
                title="Sandboxed Preview"
                srcDoc={sandboxedHtml}
                sandbox="allow-scripts"
                className="h-full w-full border-none bg-white rounded-b-lg"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                <ShieldAlert size={28} className="mb-2 text-amber-400" />
                <h4 className="font-semibold text-slate-200">Execution Not Available in Web Sandbox</h4>
                <p className="mt-1 max-w-sm text-slate-400">
                  {activeFile.language.toUpperCase()} execution requires compiling or native binaries.
                  To run safely without arbitrary privileges, export the file or use the Desktop Local Runner.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Dock: Ask AI to Refactor */}
      <form
        onSubmit={handleAiEdit}
        className="flex items-center gap-2 border-t border-white/[.08] bg-[#12141a] p-2.5"
      >
        <Sparkles size={14} className="text-teal-400 ml-1 shrink-0" />
        <input
          type="text"
          value={promptText}
          disabled={isAiBusy}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={`Ask AI to modify ${activeFile.name} (e.g. "Add error handling")...`}
          className="flex-1 bg-transparent px-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          data-testid="canvas-ai-input"
        />
        <button
          type="submit"
          disabled={!promptText.trim() || isAiBusy}
          className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-40 transition-colors"
          data-testid="canvas-ai-submit"
        >
          {isAiBusy ? 'Thinking…' : 'Refactor'}
        </button>
      </form>
    </div>
  );
}
