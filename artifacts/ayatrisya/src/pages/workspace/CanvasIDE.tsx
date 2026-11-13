import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Download,
  Copy,
  Check,
  Search,
  Sparkles,
  Monitor,
  Smartphone,
  Tablet,
  Terminal as TerminalIcon,
  AlertCircle,
  FileCode,
  X,
  Undo2,
  Redo2,
  Layers,
  Cpu,
  Maximize2,
  Minimize2,
  ExternalLink,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
  Code2,
  ShieldCheck,
  Upload,
  Info,
  Sliders,
  AlignLeft,
  Settings,
  HelpCircle,
  FolderGit2,
} from 'lucide-react';
import { useCanvas, CanvasProvider, useOptionalCanvas, PROJECT_TEMPLATES } from '@/components/canvas/CanvasContext';
import { CanvasBackground } from '@/components/canvas/CanvasBackground';
import { CanvasCodeEditor } from '@/components/canvas/CanvasCodeEditor';
import { CanvasFileTree } from '@/components/canvas/CanvasFileTree';
import { CanvasDiffModal } from '@/components/canvas/CanvasDiffModal';
import { CanvasSearchFilesModal } from '@/components/canvas/CanvasSearchFilesModal';
import { CanvasRuntimeAuditModal } from '@/components/canvas/CanvasRuntimeAuditModal';
import { SoapBubbleButton } from '@/components/soap-bubble';
import { usePrefs } from '@/hooks/use-prefs';
import { useDesktopRuntime } from '@/desktop/use-runtime';
import { useIsMobile } from '@/hooks/use-mobile';
import { generateProjectFromPrompt, type ProjectGenerationProgress } from '@/ai/project-generator';
import { generateGameProjectFromPrompt, createPlayable2DGame, createPlayable3DGame } from '@/ai/game-generator';
import { modelClient } from '@/ai/client';
import { LinuxVM } from '@/lib/linux-vm';
import type { CanvasFile, EditorProblem } from '@/components/canvas/types';
import { cx } from '@/lib/cx';

function getLangFromExt(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return 'html';
    case 'css': return 'css';
    case 'js':
    case 'jsx': return 'javascript';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'py': return 'python';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'rs': return 'rust';
    case 'go': return 'go';
    case 'sql': return 'sql';
    case 'sh': return 'shell';
    default: return 'plaintext';
  }
}

function CanvasIDEInternal() {
  const canvas = useCanvas();
  const { prefs } = usePrefs();
  const desktop = useDesktopRuntime();
  const isMobile = useIsMobile();

  // Desktop View Mode: 'split' | 'editor-only' | 'preview-only' | 'terminal-only'
  const [viewMode, setViewMode] = useState<'split' | 'editor-only' | 'preview-only' | 'terminal-only'>('split');

  // Mobile dedicated tab: 'files' | 'editor' | 'preview' | 'terminal' | 'ai'
  const [mobileTab, setMobileTab] = useState<'files' | 'editor' | 'preview' | 'terminal' | 'ai'>('editor');

  // Preview device preset: 'desktop' | 'tablet' | 'mobile' | 'iphone-15'
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'tablet' | 'mobile' | 'iphone-15'>('desktop');

  // Bottom dock tab: 'terminal' | 'output' | 'problems' | 'environment'
  const [bottomTab, setBottomTab] = useState<'terminal' | 'output' | 'problems' | 'environment'>('terminal');
  const [isBottomDockOpen, setIsBottomDockOpen] = useState(true);

  // Modals
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // AI Refactor / Edit input
  const [editorAiPrompt, setEditorAiPrompt] = useState('');
  const [editorAiBusy, setEditorAiBusy] = useState(false);

  // Linux Virtual Machine & Command Execution State
  const linuxVmRef = useRef<LinuxVM>(new LinuxVM());
  const [commandInput, setCommandInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'cmd' | 'stdout' | 'stderr' | 'info' }>>([
    { text: 'Ayatrisya Virtual Dev Environment [In-Browser POSIX Simulator x86_64]', type: 'info' },
    { text: 'Ayatrisya OS 2.0 LTS (Noble Nectar) — Web Sandbox Active. Type "help" for commands or click "Run".', type: 'info' },
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Live Preview Key & Logs
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLogs, setPreviewLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // Real-time Problems / Diagnostics
  const problems = useMemo<EditorProblem[]>(() => {
    const list: EditorProblem[] = [];
    if (!canvas.activeFile) return list;

    const file = canvas.activeFile;
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Check JSON
    if (ext === 'json') {
      try {
        JSON.parse(file.content);
      } catch (err: any) {
        const msg = err.message || 'Syntax error in JSON';
        const match = msg.match(/position (\d+)/);
        let line = 1;
        let col = 1;
        if (match) {
          const pos = parseInt(match[1], 10);
          const before = file.content.substring(0, pos);
          line = before.split('\n').length;
          col = pos - before.lastIndexOf('\n');
        }
        list.push({
          id: `prob-${Date.now()}`,
          fileId: file.id,
          filePath: file.name,
          line,
          column: col,
          severity: 'error',
          message: msg,
          source: 'JSON Parser',
        });
      }
    }

    // Check basic bracket balance for JS/TS/CSS
    if (['js', 'jsx', 'ts', 'tsx', 'css'].includes(ext || '')) {
      const openBraces = (file.content.match(/{/g) || []).length;
      const closeBraces = (file.content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        list.push({
          id: `prob-brace-${Date.now()}`,
          fileId: file.id,
          filePath: file.name,
          line: file.content.split('\n').length,
          column: 1,
          severity: 'warning',
          message: `Mismatched curly braces: ${openBraces} opening vs ${closeBraces} closing braces`,
          source: 'Syntax Check',
        });
      }
    }

    return list;
  }, [canvas.activeFile]);

  // Prevent scroll drift on initial mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Escape listener for fullscreen preview
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenPreview) {
        setIsFullscreenPreview(false);
      }
      // Ctrl+Shift+F -> Search across all files
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreenPreview]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Construct Virtual Sandboxed HTML
  const bundledPreviewHtml = useMemo(() => {
    const activeIsHtml =
      canvas.activeFile &&
      (canvas.activeFile.name.endsWith('.html') ||
        canvas.activeFile.language === 'html' ||
        canvas.activeFile.content.includes('<!DOCTYPE html>') ||
        canvas.activeFile.content.includes('<html'));

    const htmlFile = activeIsHtml
      ? canvas.activeFile
      : canvas.files.find((f) => f.name === 'index.html') ||
        canvas.files.find((f) => f.name.endsWith('.html')) ||
        canvas.files.find((f) => f.language === 'html');

    const cssFiles = canvas.files.filter((f) => f.name.endsWith('.css') || f.language === 'css');
    const jsFiles = canvas.files.filter(
      (f) =>
        (f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.jsx') || f.language === 'javascript') &&
        !f.name.endsWith('.test.js') &&
        !f.name.endsWith('.test.ts')
    );

    let baseHtml = htmlFile
      ? htmlFile.content
      : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ayatrisya Canvas</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0c0b12; color: #ece9f3; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: #161424; border: 1px solid rgba(255,255,255,0.08); padding: 32px; border-radius: 16px; text-align: center; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #fff; }
    p { font-size: 13px; color: #94919f; line-height: 1.6; margin-bottom: 20px; }
    button { background: linear-gradient(135deg, #8b5cf6, #6366f1); border: 0; padding: 10px 20px; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Ayatrisya Canvas IDE</h1>
    <p>Professional cloud development environment with live preview, AI assistance, and Linux bash terminal execution.</p>
    <button id="actionBtn">Click to Test</button>
    <div id="output" style="margin-top: 14px; font-size: 12px; color: #c4b5fd;"></div>
  </div>
  <script>
    document.getElementById('actionBtn')?.addEventListener('click', () => {
      document.getElementById('output').innerText = '✓ Interaction verified at ' + new Date().toLocaleTimeString();
      console.log('User interaction logged in Ayatrisya Canvas Preview');
    });
  </script>
</body>
</html>`;

    // Inject combined CSS
    const combinedCss = cssFiles.map((c) => `<style data-file="${c.name}">\n${c.content}\n</style>`).join('\n');
    if (combinedCss && (!activeIsHtml || !baseHtml.includes('<style'))) {
      if (baseHtml.includes('</head>')) {
        baseHtml = baseHtml.replace('</head>', `${combinedCss}\n</head>`);
      } else {
        baseHtml = `${combinedCss}\n${baseHtml}`;
      }
    }

    // Capture console logs inside the sandboxed preview iframe via postMessage
    const loggerScript = `
<script>
  (function() {
    const _origLog = console.log;
    const _origErr = console.error;
    const _origWarn = console.warn;
    function send(type, args) {
      try {
        const text = Array.from(args).map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ');
        window.parent.postMessage({ type: 'CANVAS_PREVIEW_LOG', level: type, text }, '*');
      } catch (e) {}
    }
    console.log = function() { send('info', arguments); _origLog.apply(console, arguments); };
    console.error = function() { send('error', arguments); _origErr.apply(console, arguments); };
    console.warn = function() { send('warn', arguments); _origWarn.apply(console, arguments); };
    window.onerror = function(msg, url, line) {
      send('error', ['[Uncaught Error] ' + msg + ' (line ' + line + ')']);
    };
  })();
</script>
`;

    if (baseHtml.includes('<head>')) {
      baseHtml = baseHtml.replace('<head>', `<head>\n${loggerScript}`);
    } else {
      baseHtml = `${loggerScript}\n${baseHtml}`;
    }

    // Inject JS scripts
    const combinedJs = jsFiles.map((j) => `<script data-file="${j.name}">\n${j.content}\n</script>`).join('\n');
    if (combinedJs && (!activeIsHtml || !baseHtml.includes('<script'))) {
      if (baseHtml.includes('</body>')) {
        baseHtml = baseHtml.replace('</body>', `${combinedJs}\n</body>`);
      } else {
        baseHtml = `${baseHtml}\n${combinedJs}`;
      }
    }

    return baseHtml;
  }, [canvas.files, canvas.activeFile]);

  // Listen for iframe log messages
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'CANVAS_PREVIEW_LOG') {
        const entry = e.data.level === 'error' ? `[ERR] ${e.data.text}` : `[LOG] ${e.data.text}`;
        setPreviewLogs((prev) => [...prev.slice(-100), entry]);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  // Execute terminal command
  const executeCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const vm = linuxVmRef.current;
    setTerminalLogs((prev) => [...prev, { text: `ayatrisya@workspace:${vm.getDisplayPath()}$ ${trimmed}`, type: 'cmd' }]);
    setCommandInput('');
    setHistoryIndex(-1);

    try {
      const res = await vm.execute(trimmed, canvas.files);

      if (res.clear) {
        setTerminalLogs([]);
        return;
      }

      if (res.refreshPreview) {
        setPreviewKey((k) => k + 1);
      }

      if (res.createdFile) {
        canvas.addFile({
          name: res.createdFile.name,
          content: res.createdFile.content,
          language: getLangFromExt(res.createdFile.name),
        });
      }

      if (res.removedFile) {
        const found = canvas.files.find((f) => f.name === res.removedFile);
        if (found) canvas.removeFile(found.id);
      }

      if (res.updatedFile) {
        const target = canvas.files.find((f) => f.name === res.updatedFile?.name);
        if (target) {
          canvas.setActiveFile(target.id);
          canvas.updateContent(res.updatedFile.content);
        } else {
          canvas.addFile({
            name: res.updatedFile.name,
            content: res.updatedFile.content,
            language: getLangFromExt(res.updatedFile.name),
          });
        }
      }

      if (res.stdout) {
        setTerminalLogs((prev) => [...prev, { text: res.stdout!, type: 'stdout' }]);
      }
      if (res.stderr) {
        setTerminalLogs((prev) => [...prev, { text: res.stderr!, type: 'stderr' }]);
      }
    } catch (err) {
      setTerminalLogs((prev) => [
        ...prev,
        { text: `bash: runtime error: ${err instanceof Error ? err.message : String(err)}`, type: 'stderr' },
      ]);
    }
  };

  // Run Project button handler
  const handleRunProject = () => {
    setPreviewKey((k) => k + 1);
    setTerminalLogs((prev) => [
      ...prev,
      { text: `✓ Compiled ${canvas.files.length} project files. Live preview reloaded.`, type: 'stdout' },
    ]);
    if (isMobile) {
      setMobileTab('preview');
    }
  };

  // Pop out preview in standalone tab
  const openPreviewInNewWindow = () => {
    try {
      const blob = new Blob([bundledPreviewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {}
  };

  // AI Modify Active File (stages reviewable diff)
  const handleEditorAiRefactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorAiPrompt.trim() || editorAiBusy || !canvas.activeFile) return;

    setEditorAiBusy(true);
    const active = canvas.activeFile;
    try {
      const promptText = `You are the Ayatrisya Canvas Coding Engine. Modify the following file according to the user request. Output ONLY the complete modified file content with no conversational chit-chat or markdown fences.\n\nFile Name: ${active.name}\nRequest: ${editorAiPrompt}\n\nCurrent Content:\n${active.content}`;
      const res = await modelClient.sendChat({
        messages: [{ role: 'user', content: promptText }],
        model: prefs.model || 'ayatrisya-coder-v1',
        temperature: 0.2,
      });

      const proposed = res.text
        .replace(/^```[a-z]*\n/i, '')
        .replace(/\n```$/i, '')
        .trim();

      if (proposed && proposed !== active.content) {
        canvas.stagePatch(proposed);
      }
      setEditorAiPrompt('');
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        { text: `[AI Assistant Error]: ${err.message || 'Refactor failed'}`, type: 'stderr' },
      ]);
    } finally {
      setEditorAiBusy(false);
    }
  };

  // AI Generate Project
  const handleGenerateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiBusy) return;

    setAiBusy(true);
    setAiStatus('Planning project architecture…');
    try {
      const isGame = /game|arcade|platformer|rpg|shooter|puzzle/i.test(aiPrompt);
      if (isGame) {
        setAiStatus('Assembling game engine loop, physics, sound synth & HUD…');
        const gameRes = await generateGameProjectFromPrompt(aiPrompt.trim(), {
          model: prefs.model,
          onProgress: (p) => setAiStatus(p.message),
        });
        canvas.loadProjectFiles(
          gameRes.files.map((f) => ({
            name: f.path,
            content: f.content,
            language: f.language,
          }))
        );
        setShowAiModal(false);
        setAiPrompt('');
        setAiStatus('');
        setPreviewKey((k) => k + 1);
        setTerminalLogs((prev) => [
          ...prev,
          { text: `✓ Generated ${gameRes.title} with 2D physics, loop, audio synth, and touch controls.`, type: 'info' },
        ]);
        return;
      }

      const res = await generateProjectFromPrompt(aiPrompt.trim(), {
        model: prefs.model,
        mode: prefs.mode,
        onProgress: (p: ProjectGenerationProgress) => {
          if (p.step === 'planning') setAiStatus('Planning architecture & file tree…');
          else if (p.step === 'generating_files') {
            setAiStatus(`Writing file ${p.completedFiles + 1}/${p.totalFiles}: ${p.currentFilePath || ''}…`);
          }
        },
      });

      if (res.files && res.files.length > 0) {
        canvas.loadProjectFiles(
          res.files.map((f) => ({
            name: f.path,
            content: f.content,
            language: f.language,
          }))
        );
        setShowAiModal(false);
        setAiPrompt('');
        setAiStatus('');
        setPreviewKey((k) => k + 1);
        setTerminalLogs((prev) => [
          ...prev,
          { text: `✓ AI generated ${res.files.length} project files.`, type: 'info' },
        ]);
      }
    } catch (err: unknown) {
      setAiStatus(`Error: ${err instanceof Error ? err.message : 'Project generation failed'}`);
    } finally {
      setAiBusy(false);
    }
  };

  const active = canvas.activeFile;

  return (
    <div className="relative flex h-screen w-full flex-col bg-[#0b0a11] text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. PROFESSIONAL IDE TOP NAVBAR */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#12111b] px-3 z-20">
        {/* Left: Brand Identity & Project Selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-sm ring-1 ring-violet-400/40">
              <Code2 size={14} />
            </div>
            <span className="text-xs font-bold tracking-tight text-white hidden sm:inline">
              Ayatrisya <span className="text-violet-400 font-semibold">Canvas IDE</span>
            </span>
          </div>

          <span className="text-slate-600 hidden sm:inline">/</span>

          {/* Project Switcher Trigger */}
          <button
            type="button"
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-white/[.05] hover:bg-white/[.08] px-2.5 py-1 text-xs text-slate-300 font-medium border border-white/[.06] transition"
          >
            <FolderGit2 size={13} className="text-violet-400" />
            <span className="truncate max-w-36">{canvas.currentProjectName}</span>
          </button>

          {/* Autosave Status Badge */}
          <span
            className={cx(
              'text-[10px] px-2 py-0.5 rounded-full font-medium transition hidden md:inline-flex items-center gap-1',
              canvas.saveStatus === 'saved'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', canvas.saveStatus === 'saved' ? 'bg-teal-400' : 'bg-amber-400')} />
            {canvas.saveStatus === 'saved' ? 'Saved' : 'Saving…'}
          </span>
        </div>

        {/* Center: Desktop Layout Switcher */}
        {!isMobile && (
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[.08]">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={cx('px-2.5 py-1 text-xs rounded-md font-medium transition', viewMode === 'split' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
              title="Split Code & Preview"
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('editor-only')}
              className={cx('px-2.5 py-1 text-xs rounded-md font-medium transition', viewMode === 'editor-only' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
              title="Code Focused"
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview-only')}
              className={cx('px-2.5 py-1 text-xs rounded-md font-medium transition', viewMode === 'preview-only' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
              title="Live Preview Focused"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('terminal-only')}
              className={cx('px-2.5 py-1 text-xs rounded-md font-medium transition', viewMode === 'terminal-only' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
              title="Linux Terminal Focused"
            >
              Terminal
            </button>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Run Button */}
          <button
            type="button"
            onClick={handleRunProject}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 shadow-md transition"
            title="Compile & Run Project (Ctrl+Enter)"
          >
            <Play size={12} fill="currentColor" />
            <span>Run</span>
          </button>

          {/* AI Generate Button */}
          <SoapBubbleButton
            type="button"
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-violet-200 transition shadow-sm"
            title="Generate project or game with AI"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">AI Generate</span>
          </SoapBubbleButton>

          {/* Export Project ZIP */}
          <button
            type="button"
            onClick={canvas.exportProjectZip}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[.08] transition"
            title="Download full project as a valid ZIP archive"
          >
            <Download size={13} />
            <span>Export .ZIP</span>
          </button>

          {/* Runtime Audit Pill */}
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-1 rounded-md bg-violet-500/10 hover:bg-violet-500/20 px-2 py-1 text-[11px] text-violet-300 border border-violet-500/20 transition"
            title="Inspect Runtime Security & Environment Classification"
          >
            <ShieldCheck size={12} className="text-teal-400" />
            <span className="hidden lg:inline">{desktop?.isNative ? 'Desktop Native' : 'Web Sandbox'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE AREA */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* DESKTOP / TABLET FILE EXPLORER SIDEBAR */}
        {!isMobile && (
          <aside className="w-60 shrink-0 h-full overflow-hidden border-r border-white/[.07] bg-[#111018]">
            <CanvasFileTree
              files={canvas.files}
              activeFileId={canvas.activeFileId}
              onSelectFile={canvas.setActiveFile}
              onCreateFile={(name) => canvas.addFile({ name, content: '', language: getLangFromExt(name) })}
              onCreateFolder={canvas.createFolder}
              onRenameFile={canvas.renameFile}
              onDuplicateFile={canvas.duplicateFile}
              onDeleteFile={canvas.removeFile}
            />
          </aside>
        )}

        {/* MOBILE SINGLE-PANE FILE EXPLORER */}
        {isMobile && mobileTab === 'files' && (
          <div className="flex-1 h-full overflow-hidden">
            <CanvasFileTree
              files={canvas.files}
              activeFileId={canvas.activeFileId}
              onSelectFile={(id) => {
                canvas.setActiveFile(id);
                setMobileTab('editor');
              }}
              onCreateFile={(name) => {
                canvas.addFile({ name, content: '', language: getLangFromExt(name) });
                setMobileTab('editor');
              }}
              onCreateFolder={canvas.createFolder}
              onRenameFile={canvas.renameFile}
              onDuplicateFile={canvas.duplicateFile}
              onDeleteFile={canvas.removeFile}
            />
          </div>
        )}

        {/* CENTER WORKSPACE: TABS, EDITOR & PREVIEW */}
        {(!isMobile || mobileTab === 'editor' || mobileTab === 'preview' || mobileTab === 'terminal' || mobileTab === 'ai') && (
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            {/* MULTI-TAB HEADER (Desktop/Tablet) */}
            {!isMobile && (
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[.07] bg-[#14131f] px-2 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                  {canvas.files.map((file) => {
                    const isActive = file.id === canvas.activeFileId;
                    return (
                      <div
                        key={file.id}
                        onClick={() => canvas.setActiveFile(file.id)}
                        className={cx(
                          'flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-mono cursor-pointer border-t-2 select-none transition shrink-0',
                          isActive
                            ? 'border-violet-400 bg-[#0e0d15] text-violet-200 font-medium'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[.03]'
                        )}
                      >
                        <span>{file.name}</span>
                        {file.modified && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 text-slate-400 shrink-0">
                  <button
                    type="button"
                    disabled={!canvas.canUndo}
                    onClick={canvas.undo}
                    className="p-1 hover:text-white disabled:opacity-30"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={!canvas.canRedo}
                    onClick={canvas.redo}
                    className="p-1 hover:text-white disabled:opacity-30"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (active) {
                        navigator.clipboard.writeText(active.content);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="p-1 hover:text-white"
                    title="Copy File Content"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            )}

            {/* SPLIT / MAIN WORKSPACE AREA */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* CODE EDITOR PANE */}
              {(!isMobile ? viewMode === 'editor-only' || viewMode === 'split' : mobileTab === 'editor') && (
                <div className="flex flex-1 flex-col min-w-0 border-r border-white/[.07] bg-[#0e0d15] overflow-hidden">
                  {/* Inline Diff Banner if pending */}
                  {canvas.pendingDiff && (
                    <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-200">
                      <span className="font-semibold">AI Proposed Changes for {canvas.pendingDiff.path}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={canvas.rejectPatch}
                          className="rounded border border-amber-500/40 px-2 py-0.5 hover:bg-amber-500/20 text-xs"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={canvas.acceptPatch}
                          className="rounded bg-amber-400 px-2.5 py-0.5 font-bold text-slate-950 hover:bg-amber-300 text-xs"
                        >
                          Accept Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Professional Code Editor */}
                  <CanvasCodeEditor
                    file={active}
                    onChangeContent={canvas.updateContent}
                    onRun={handleRunProject}
                    problems={problems}
                    isMobile={isMobile}
                  />

                  {/* Bottom AI Refactor Input Bar */}
                  <form
                    onSubmit={handleEditorAiRefactor}
                    className="flex items-center gap-2 border-t border-white/[.07] bg-[#12111b] p-2 shrink-0"
                  >
                    <Sparkles size={14} className="text-violet-400 ml-1 shrink-0" />
                    <input
                      type="text"
                      value={editorAiPrompt}
                      onChange={(e) => setEditorAiPrompt(e.target.value)}
                      disabled={editorAiBusy || !active}
                      placeholder={active ? `Ask AI to modify ${active.name}...` : 'Select a file...'}
                      className="flex-1 min-w-0 rounded-md bg-black/40 px-2.5 py-1 text-xs text-white border border-white/10 focus:outline-none focus:border-violet-400"
                    />
                    <button
                      type="submit"
                      disabled={editorAiBusy || !editorAiPrompt.trim()}
                      className="rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition shadow-sm"
                    >
                      {editorAiBusy ? 'Refactoring…' : 'Refactor'}
                    </button>
                  </form>
                </div>
              )}

              {/* LIVE PREVIEW PANE */}
              {(!isMobile ? viewMode === 'preview-only' || viewMode === 'split' : mobileTab === 'preview') && (
                <div className="flex flex-1 flex-col min-w-0 bg-[#09080e] overflow-hidden">
                  {/* Preview Toolbar */}
                  <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[.07] bg-[#14131f] px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Live Preview</span>
                      <button
                        type="button"
                        onClick={() => setPreviewKey((k) => k + 1)}
                        className="p-1 text-slate-400 hover:text-white transition"
                        title="Reload preview"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {/* Device Presets */}
                      <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
                        <button
                          type="button"
                          onClick={() => setDeviceViewport('desktop')}
                          className={cx('p-1 rounded', deviceViewport === 'desktop' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300')}
                          title="Desktop (100%)"
                        >
                          <Monitor size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeviceViewport('tablet')}
                          className={cx('p-1 rounded', deviceViewport === 'tablet' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300')}
                          title="Tablet (768px)"
                        >
                          <Tablet size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeviceViewport('mobile')}
                          className={cx('p-1 rounded', deviceViewport === 'mobile' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300')}
                          title="Mobile (375px)"
                        >
                          <Smartphone size={12} />
                        </button>
                      </div>

                      {/* Pop-out to new window */}
                      <button
                        type="button"
                        onClick={openPreviewInNewWindow}
                        className="p-1 text-slate-400 hover:text-violet-300 transition"
                        title="Open preview in new tab"
                      >
                        <ExternalLink size={13} />
                      </button>

                      {/* Fullscreen Preview */}
                      <button
                        type="button"
                        onClick={() => setIsFullscreenPreview(true)}
                        className="flex items-center gap-1 rounded bg-white/[.06] hover:bg-white/10 px-2 py-0.5 text-xs text-slate-200 transition"
                        title="Full Screen Preview (Esc to exit)"
                      >
                        <Maximize2 size={12} />
                        <span className="hidden sm:inline">Full</span>
                      </button>
                    </div>
                  </div>

                  {/* Sandboxed iframe Container */}
                  <div className="relative flex-1 min-h-0 flex items-center justify-center p-1 sm:p-2 overflow-auto bg-[#07060b]">
                    <CanvasBackground opacity={0.3} />
                    <div
                      className={cx(
                        'relative z-10 h-full max-w-full transition-all duration-200 bg-white shadow-2xl rounded-md overflow-hidden',
                        deviceViewport === 'mobile'
                          ? 'w-[375px]'
                          : deviceViewport === 'tablet'
                          ? 'w-[768px]'
                          : 'w-full'
                      )}
                    >
                      <iframe
                        key={previewKey}
                        title="Ayatrisya Canvas Preview"
                        sandbox="allow-scripts allow-modals"
                        srcDoc={bundledPreviewHtml}
                        className="h-full w-full border-0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. RESIZABLE BOTTOM DOCK (Desktop/Tablet) or FULL PANE (Mobile Terminal) */}
            {(!isMobile ? isBottomDockOpen || viewMode === 'terminal-only' : mobileTab === 'terminal') && (
              <div className={cx('border-t border-white/[.07] bg-[#0d0c14] flex flex-col', isMobile || viewMode === 'terminal-only' ? 'flex-1' : 'h-48')}>
                {/* Dock Header */}
                <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/[.06] bg-[#12111b] px-3">
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setBottomTab('terminal')}
                      className={cx('flex items-center gap-1.5 font-medium py-1 transition', bottomTab === 'terminal' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200')}
                    >
                      <TerminalIcon size={12} />
                      <span>Terminal (Linux bash)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('output')}
                      className={cx('flex items-center gap-1.5 font-medium py-1 transition', bottomTab === 'output' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200')}
                    >
                      <Layers size={12} />
                      <span>Console Output ({previewLogs.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('problems')}
                      className={cx('flex items-center gap-1.5 font-medium py-1 transition', bottomTab === 'problems' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200')}
                    >
                      <AlertCircle size={12} />
                      <span>Problems ({problems.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('environment')}
                      className={cx('flex items-center gap-1.5 font-medium py-1 transition', bottomTab === 'environment' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200')}
                    >
                      <Cpu size={12} />
                      <span>Runtime</span>
                    </button>
                  </div>

                  {!isMobile && viewMode !== 'terminal-only' && (
                    <button
                      type="button"
                      onClick={() => setIsBottomDockOpen(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dock Body */}
                <div ref={terminalBodyRef} className="flex-1 min-h-0 overflow-y-auto p-2.5 font-mono text-xs">
                  {bottomTab === 'terminal' && (
                    <div className="space-y-1">
                      {terminalLogs.map((log, index) => (
                        <div
                          key={index}
                          className={cx(
                            'whitespace-pre-wrap leading-relaxed',
                            log.type === 'cmd'
                              ? 'text-violet-200 font-medium'
                              : log.type === 'stderr'
                              ? 'text-rose-400'
                              : log.type === 'info'
                              ? 'text-violet-400/80 italic'
                              : 'text-slate-200'
                          )}
                        >
                          {log.text}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />

                      {/* Command Prompt */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          executeCommand(commandInput);
                        }}
                        className="flex items-center gap-1 pt-1.5"
                      >
                        <span className="text-violet-400 font-semibold shrink-0">ayatrisya@workspace</span>
                        <span className="text-slate-500 shrink-0">:</span>
                        <span className="text-violet-300 font-medium shrink-0">{linuxVmRef.current.getDisplayPath()}</span>
                        <span className="text-slate-400 font-bold ml-0.5 mr-1 shrink-0">$</span>
                        <input
                          type="text"
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          placeholder="Type a Linux command (ls, cat, touch, node, python3, git, clear, help)..."
                          className="flex-1 bg-transparent min-w-0 text-slate-100 focus:outline-none font-mono text-xs"
                          onKeyDown={(e) => {
                            const hist = linuxVmRef.current.getHistory();
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              if (hist.length === 0) return;
                              const nextIdx = historyIndex === -1 ? hist.length - 1 : Math.max(0, historyIndex - 1);
                              setHistoryIndex(nextIdx);
                              setCommandInput(hist[nextIdx] || '');
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              if (historyIndex === -1) return;
                              const nextIdx = historyIndex + 1;
                              if (nextIdx >= hist.length) {
                                setHistoryIndex(-1);
                                setCommandInput('');
                              } else {
                                setHistoryIndex(nextIdx);
                                setCommandInput(hist[nextIdx] || '');
                              }
                            }
                          }}
                        />
                      </form>

                      {/* Mobile Quick Terminal Commands */}
                      {isMobile && (
                        <div className="flex items-center gap-1.5 pt-2 overflow-x-auto scrollbar-none">
                          {['ls -la', 'pwd', 'node app.js', 'python3 main.py', 'git status', 'clear', 'help'].map((cmd) => (
                            <button
                              key={cmd}
                              type="button"
                              onClick={() => executeCommand(cmd)}
                              className="rounded bg-white/[.06] hover:bg-violet-600 px-2 py-1 text-[11px] text-violet-300 shrink-0 font-mono transition"
                            >
                              {cmd}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {bottomTab === 'output' && (
                    <div className="space-y-1 text-slate-300">
                      {previewLogs.length === 0 ? (
                        <div className="text-slate-500 italic">No console logs emitted yet. Click 'Run' to compile and execute.</div>
                      ) : (
                        previewLogs.map((log, i) => (
                          <div key={i} className={log.startsWith('[ERR]') ? 'text-rose-400' : 'text-slate-300'}>
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {bottomTab === 'problems' && (
                    <div className="space-y-1">
                      {problems.length === 0 ? (
                        <div className="text-slate-500 italic">No syntax errors or diagnostics detected in workspace.</div>
                      ) : (
                        problems.map((prob) => (
                          <div key={prob.id} className="flex items-center gap-2 text-rose-400 p-1 rounded hover:bg-rose-950/20">
                            <AlertCircle size={13} className="shrink-0" />
                            <span className="font-semibold text-slate-200">{prob.filePath}:{prob.line}</span>
                            <span>{prob.message}</span>
                            <span className="text-[10px] text-slate-500 font-sans ml-auto">[{prob.source}]</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {bottomTab === 'environment' && (
                    <div className="space-y-2 text-slate-300 leading-relaxed text-xs">
                      <div>Execution Model: <span className="text-violet-300 font-semibold">{desktop?.isNative ? 'Desktop Native Linux Host' : 'Web Sandbox (In-Browser POSIX Simulator)'}</span></div>
                      <div>Kernel: <span className="text-slate-400 font-mono">Linux 6.6.0-ayatrisya #1 SMP PREEMPT_DYNAMIC x86_64</span></div>
                      <div>Virtual Mount: <span className="text-slate-400 font-mono">/home/ayatrisya/project mounted with real-time bidirectional canvas sync</span></div>
                      <div>Sandboxing: <span className="text-teal-300 font-semibold">Strict iframe sandbox="allow-scripts allow-modals" (Private storage isolated)</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Closed Bottom Dock Bar Toggle */}
            {!isBottomDockOpen && !isMobile && viewMode !== 'terminal-only' && (
              <div className="flex h-6 shrink-0 items-center justify-between border-t border-white/[.07] bg-[#0d0c14] px-3 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setIsBottomDockOpen(true)}
                  className="flex items-center gap-1.5 hover:text-violet-300 font-medium transition"
                >
                  <TerminalIcon size={11} />
                  <span>Show Linux Terminal & Console</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. MOBILE BOTTOM NAVIGATION BAR (Phase 1 Mobile Requirement) */}
      {isMobile && (
        <nav className="flex h-14 shrink-0 items-center justify-around border-t border-white/[.08] bg-[#12111b] px-2 z-30 select-none">
          <button
            type="button"
            onClick={() => setMobileTab('files')}
            className={cx('flex flex-col items-center gap-1 p-1 text-[10px] transition', mobileTab === 'files' ? 'text-violet-400 font-bold' : 'text-slate-400')}
          >
            <FolderOpen size={18} />
            <span>Files</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            className={cx('flex flex-col items-center gap-1 p-1 text-[10px] transition', mobileTab === 'editor' ? 'text-violet-400 font-bold' : 'text-slate-400')}
          >
            <Code2 size={18} />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={cx('flex flex-col items-center gap-1 p-1 text-[10px] transition', mobileTab === 'preview' ? 'text-violet-400 font-bold' : 'text-slate-400')}
          >
            <Monitor size={18} />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('terminal')}
            className={cx('flex flex-col items-center gap-1 p-1 text-[10px] transition', mobileTab === 'terminal' ? 'text-violet-400 font-bold' : 'text-slate-400')}
          >
            <TerminalIcon size={18} />
            <span>Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="flex flex-col items-center gap-1 p-1 text-[10px] text-violet-300 font-semibold"
          >
            <Sparkles size={18} className="text-violet-400" />
            <span>AI</span>
          </button>
        </nav>
      )}

      {/* 5. MULTI-PROJECT SWITCHER & MANAGER MODAL */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm select-auto">
          <div className="w-full max-w-lg rounded-2xl border border-violet-500/30 bg-[#141320] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <FolderGit2 size={16} className="text-violet-400" />
                Workspace Projects
              </h3>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Existing Projects List */}
            <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              {canvas.projects.map((proj) => {
                const isCur = proj.id === canvas.activeProjectId;
                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      canvas.switchProject(proj.id);
                      setShowProjectModal(false);
                    }}
                    className={cx(
                      'flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition',
                      isCur
                        ? 'border-violet-500/50 bg-violet-500/15 text-white'
                        : 'border-white/[.06] bg-white/[.02] text-slate-300 hover:bg-white/[.06]'
                    )}
                  >
                    <div>
                      <div className="font-semibold text-xs">{proj.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {proj.files.length} file{proj.files.length === 1 ? '' : 's'} · Updated {new Date(proj.updatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    {isCur && <span className="text-[10px] font-bold text-teal-300">Active</span>}
                  </div>
                );
              })}
            </div>

            {/* Create From Template Buttons */}
            <div className="mt-4 pt-3 border-t border-white/[.08]">
              <label className="text-xs font-semibold text-slate-300 mb-2 block">
                Create New Project From Template:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(PROJECT_TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      canvas.createProject(tpl.name, key);
                      setShowProjectModal(false);
                    }}
                    className="p-2.5 rounded-xl border border-white/[.07] bg-white/[.02] hover:bg-violet-500/10 hover:border-violet-500/30 text-left transition"
                  >
                    <div className="font-semibold text-white">{tpl.name}</div>
                    <div className="text-[10px] text-slate-500">{tpl.files.length} template files</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. AI PROJECT GENERATION MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-auto">
          <div className="w-full max-w-lg rounded-2xl border border-violet-500/30 bg-[#141320] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles size={16} className="text-violet-400" />
                Generate Multi-File Project with AI
              </h3>
              <button
                type="button"
                onClick={() => !aiBusy && setShowAiModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleGenerateProject} className="mt-3">
              <label className="block text-xs font-medium text-slate-300">
                Describe the web app, tool, or game you want to build:
                <textarea
                  autoFocus
                  disabled={aiBusy}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Build an interactive analytics dashboard with real-time SVG charts and dark mode, or a 2D space shooter game..."
                  className="mt-1.5 min-h-28 w-full rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                />
              </label>
              {aiStatus && (
                <p className="mt-2 text-xs text-violet-300 flex items-center gap-1.5">
                  <Sparkles size={12} className="animate-spin" />
                  {aiStatus}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => setShowAiModal(false)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiBusy || !aiPrompt.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40 shadow-sm transition"
                >
                  <Sparkles size={13} />
                  {aiBusy ? 'Generating Project…' : 'Generate Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. FULL SCREEN LIVE PREVIEW OVERLAY */}
      {isFullscreenPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#07060b] select-auto animate-in fade-in duration-200">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#12111b]/95 px-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Preview (Full Screen)
              </span>
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/[.06] hover:text-white transition"
              >
                <RotateCcw size={12} />
                <span>Reload</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openPreviewInNewWindow}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[.06] transition"
              >
                <ExternalLink size={12} />
                <span>New Tab</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreenPreview(false)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500 shadow-sm transition"
              >
                <Minimize2 size={13} />
                <span>Exit Full Screen (Esc)</span>
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 flex items-center justify-center p-0 md:p-3 overflow-hidden bg-[#050508]">
            <CanvasBackground opacity={0.35} />
            <div className="relative z-10 h-full w-full bg-white shadow-2xl rounded-none md:rounded-lg overflow-hidden">
              <iframe
                key={`fs-${previewKey}`}
                title="Ayatrisya Canvas Full Screen Preview"
                sandbox="allow-scripts allow-modals"
                srcDoc={bundledPreviewHtml}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* 8. REVIEWABLE VISUAL DIFF MODAL */}
      <CanvasDiffModal
        diff={canvas.pendingDiff}
        onAccept={canvas.acceptPatch}
        onReject={canvas.rejectPatch}
      />

      {/* 9. SEARCH ACROSS ALL FILES MODAL */}
      <CanvasSearchFilesModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        files={canvas.files}
        onSelectResult={(fileId) => canvas.setActiveFile(fileId)}
      />

      {/* 10. RUNTIME ARCHITECTURE AUDIT MODAL */}
      <CanvasRuntimeAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        isDesktop={Boolean(desktop?.isNative)}
      />
    </div>
  );
}

export function CanvasIDEPage() {
  const existing = useOptionalCanvas();
  if (existing) {
    return <CanvasIDEInternal />;
  }
  return (
    <CanvasProvider>
      <CanvasIDEInternal />
    </CanvasProvider>
  );
}
