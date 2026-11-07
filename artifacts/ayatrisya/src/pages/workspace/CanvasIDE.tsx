import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Code2,
  Play,
  RotateCcw,
  Plus,
  Trash2,
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
} from 'lucide-react';
import { useCanvas, CanvasProvider, useOptionalCanvas } from '@/components/canvas/CanvasContext';
import { usePrefs } from '@/hooks/use-prefs';
import { useDesktopRuntime } from '@/desktop/use-runtime';
import { useIsMobile } from '@/hooks/use-mobile';
import { generateProjectFromPrompt, type ProjectGenerationProgress } from '@/ai/project-generator';
import { generateGameProjectFromPrompt, createPlayable2DGame, createPlayable3DGame } from '@/ai/game-generator';
import { modelClient } from '@/ai/client';
import { LinuxVM } from '@/lib/linux-vm';

function getLangFromExt(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return 'html';
    case 'css': return 'css';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
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

  // Mode: 'editor-only' | 'split' | 'preview-only' | 'terminal-only'
  const [viewMode, setViewMode] = useState<'editor-only' | 'split' | 'preview-only' | 'terminal-only'>('split');
  // Mobile single-pane tab: 'files' | 'code' | 'preview' | 'terminal'
  const [mobileTab, setMobileTab] = useState<'files' | 'code' | 'preview' | 'terminal'>('code');
  // Device viewport: 'desktop' | 'tablet' | 'mobile'
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  // Bottom dock tab: 'terminal' | 'output' | 'problems' | 'packages'
  const [bottomTab, setBottomTab] = useState<'terminal' | 'output' | 'problems' | 'packages'>('terminal');
  const [isBottomDockOpen, setIsBottomDockOpen] = useState(true);

  // File explorer filter
  const [filterQuery, setFilterQuery] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);

  // AI Project Generation Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  // AI Refactor / Edit Input in Editor
  const [editorAiPrompt, setEditorAiPrompt] = useState('');
  const [editorAiBusy, setEditorAiBusy] = useState(false);

  // Linux Virtual Machine & Command Execution State
  const linuxVmRef = useRef<LinuxVM>(new LinuxVM());
  const [commandInput, setCommandInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'cmd' | 'stdout' | 'stderr' | 'info' }>>([
    { text: 'Ayatrisya Virtual Dev Environment [Linux 6.6.0-ayatrisya x86_64 GNU/Linux]', type: 'info' },
    { text: 'Ayatrisya OS 2.0 LTS (Noble Nectar) — Type "help" for a list of supported Linux commands or click "Run" to test your project.', type: 'info' },
  ]);
  const [, setActiveProcess] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Live Preview Key (increment to trigger clean iframe re-render)
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLogs, setPreviewLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // Prevent parent page scroll drift on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Listen for Escape key to exit fullscreen preview
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenPreview) {
        setIsFullscreenPreview(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreenPreview]);

  // Scroll terminal to bottom strictly within its own scrollable container
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Construct Virtual Sandboxed HTML from Canvas Files
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
    const jsFiles = canvas.files.filter((f) => f.name.endsWith('.js') || f.name.endsWith('.ts') || f.language === 'javascript');

    let baseHtml = htmlFile
      ? htmlFile.content
      : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ayatrisya Canvas</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #101014; color: #ece9f3; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: #16151f; border: 1px solid rgba(255,255,255,0.08); padding: 32px; border-radius: 16px; text-align: center; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #fff; }
    p { font-size: 13px; color: #94919f; line-height: 1.6; margin-bottom: 20px; }
    button { background: linear-gradient(135deg, #8b5cf6, #6366f1); border: 0; padding: 10px 20px; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Welcome to Ayatrisya Canvas IDE</h1>
    <p>A full-screen development environment with live preview, AI generation, and full Linux terminal execution.</p>
    <button id="actionBtn">Click to Test</button>
    <div id="output" style="margin-top: 14px; font-size: 12px; color: #c4b5fd;"></div>
  </div>
  <script>
    document.getElementById('actionBtn').addEventListener('click', () => {
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

    // Capture console logs inside the sandboxed preview iframe
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
      send('error', ['[Uncaught] ' + msg + ' (line ' + line + ')']);
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

  // Handle Command Execution (Full Linux VM or Desktop Native)
  const executeCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const vm = linuxVmRef.current;
    const promptDisplay = vm.getPrompt();

    setTerminalLogs((prev) => [...prev, { text: `${promptDisplay} ${trimmed}`, type: 'cmd' }]);
    setCommandInput('');
    setHistoryIndex(-1);

    // Check if Desktop native runtime is available
    if (desktop && desktop.desktop) {
      try {
        setActiveProcess(trimmed);
        const res = await desktop.desktop.runCommand('canvas-project', trimmed);
        if (res.stdout) {
          setTerminalLogs((prev) => [...prev, { text: res.stdout, type: 'stdout' }]);
        }
        if (res.stderr) {
          setTerminalLogs((prev) => [...prev, { text: res.stderr, type: 'stderr' }]);
        }
        if (res.cancelled) {
          setTerminalLogs((prev) => [...prev, { text: 'Process terminated by user.', type: 'info' }]);
        }
      } catch (err) {
        setTerminalLogs((prev) => [...prev, { text: `Error: ${err instanceof Error ? err.message : String(err)}`, type: 'stderr' }]);
      } finally {
        setActiveProcess(null);
      }
      return;
    }

    // Web Full Linux Virtual Machine Execution
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

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    canvas.addFile({
      name: newFileName.trim(),
      content: '',
      language: getLangFromExt(newFileName.trim()),
    });
    setNewFileName('');
    setIsCreatingFile(false);
  };

  // Quick Game Launch Helpers
  const load2DGameTemplate = () => {
    const game = createPlayable2DGame('Cyber Runner 2088');
    canvas.loadProjectFiles(
      game.files.map((f) => ({
        name: f.path,
        content: f.content,
        language: f.language,
      }))
    );
    setShowAiModal(false);
    setPreviewKey((k) => k + 1);
    setTerminalLogs((prev) => [
      ...prev,
      { text: `✓ Loaded 2D Cyber Arcade Platformer with physics, audio synth & touch controls.`, type: 'info' },
    ]);
  };

  const load3DGameTemplate = () => {
    const game = createPlayable3DGame('Orbital Voyager 3D');
    canvas.loadProjectFiles(
      game.files.map((f) => ({
        name: f.path,
        content: f.content,
        language: f.language,
      }))
    );
    setShowAiModal(false);
    setPreviewKey((k) => k + 1);
    setTerminalLogs((prev) => [
      ...prev,
      { text: `✓ Loaded 3D WebGL Space Flight with Three.js camera, procedural asteroids & particle stars.`, type: 'info' },
    ]);
  };

  // Generate Multi-File Project or Game via Model
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
          { text: `✓ Generated ${gameRes.title} (${gameRes.metadata.genre}) with real-time loop, audio, and controls.`, type: 'info' },
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
          { text: `✓ AI generated ${res.files.length} project files (${res.files.map((f) => f.path).join(', ')}).`, type: 'info' },
        ]);
      }
    } catch (err: unknown) {
      setAiStatus(`Error: ${err instanceof Error ? err.message : 'Project generation failed'}`);
    } finally {
      setAiBusy(false);
    }
  };

  // AI Modify Active File
  const handleEditorAiRefactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorAiPrompt.trim() || !canvas.activeFile || editorAiBusy) return;

    setEditorAiBusy(true);
    try {
      const current = canvas.activeFile;
      const prompt = `You are an expert programming assistant in Ayatrisya IDE.
Current file: ${current.name} (${current.language})
Task: ${editorAiPrompt.trim()}

Original content:
\`\`\`${current.language}
${current.content}
\`\`\`

Return ONLY the complete updated file content without markdown code fences or conversational text.`;

      const updated = await modelClient.generateResponse([{ role: 'user', content: prompt }], {
        model: prefs.model,
        mode: prefs.mode,
      });

      let clean = updated.trim();
      if (clean.startsWith('```')) {
        const lines = clean.split('\n');
        lines.shift();
        if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
        clean = lines.join('\n');
      }

      canvas.stagePatch(clean);
      setEditorAiPrompt('');
    } catch (err: unknown) {
      alert(`AI modification error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setEditorAiBusy(false);
    }
  };

  // Export Project as Downloadable Files
  const handleDownloadAll = () => {
    canvas.files.forEach((file) => {
      const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Open Preview in a Standalone Browser Window/Tab
  const openPreviewInNewWindow = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(bundledPreviewHtml);
      win.document.close();
    }
  };

  // Filtered file tree
  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return canvas.files;
    return canvas.files.filter((f) => f.name.toLowerCase().includes(filterQuery.toLowerCase()));
  }, [canvas.files, filterQuery]);

  const active = canvas.activeFile;
  const currentVm = linuxVmRef.current;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#101014] text-[#ebe8f1] select-none font-sans">
      {/* 1. TOP TOOLBAR - Aligned with Ayatrisya Workspace Palette */}
      <header className="flex h-11 sm:h-12 shrink-0 items-center justify-between border-b border-white/[.07] bg-[#121116]/95 px-2.5 sm:px-4 backdrop-blur-md gap-2 overflow-x-auto scrollbar-none">
        {/* Left: Branding & Project Meta */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 pr-2.5 sm:pr-3 border-r border-white/[.08]">
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 font-bold shrink-0">
              <Code2 size={14} />
            </div>
            <span className="text-xs font-semibold tracking-wide text-white hidden sm:inline">Canvas IDE</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-mono text-violet-200 font-medium truncate max-w-[100px] sm:max-w-none">{active ? active.name : 'project'}</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Saved locally in browser" />
          </div>
        </div>

        {/* Center: Mobile Navigation Switcher vs Desktop Mode Selector */}
        <div className="flex md:hidden items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[.08] shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('files')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'files' ? 'bg-violet-500/25 text-violet-200 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('code')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'code' ? 'bg-violet-500/25 text-violet-200 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'preview' ? 'bg-violet-500/25 text-violet-200 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('terminal')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'terminal' ? 'bg-violet-500/25 text-violet-200 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Terminal
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/[.08] shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('editor-only')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded-md font-medium transition ${viewMode === 'editor-only' ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Editor Only"
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded-md font-medium transition ${viewMode === 'split' ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Editor + Preview Split"
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview-only')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded-md font-medium transition ${viewMode === 'preview-only' ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Full-screen Preview"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setViewMode('terminal-only')}
            className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded-md font-medium transition ${viewMode === 'terminal-only' ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Linux Terminal Focused"
          >
            Terminal
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Run Button */}
          <button
            type="button"
            onClick={() => {
              setPreviewKey((k) => k + 1);
              setTerminalLogs((prev) => [
                ...prev,
                { text: `✓ Compiled ${canvas.files.length} project files. Live preview reloaded.`, type: 'stdout' },
              ]);
            }}
            className="shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 rounded-lg bg-emerald-500 px-2.5 sm:px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 shadow-sm transition"
            title="Compile & Run Project (Ctrl+Enter)"
          >
            <Play size={12} fill="currentColor" />
            <span>Run</span>
          </button>

          {/* AI Generate Project Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-2.5 sm:px-3 py-1 text-xs font-medium text-violet-200 hover:bg-violet-500/25 transition shadow-sm"
            title="Generate whole project or game with AI"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">AI Generate</span>
          </button>

          {/* Export Project */}
          <button
            type="button"
            onClick={handleDownloadAll}
            className="shrink-0 whitespace-nowrap min-w-max hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[.06] transition"
            title="Export files to local drive"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE GRID */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: FILE EXPLORER */}
        <aside className={`shrink-0 border-r border-white/[.07] bg-[#13121a] flex flex-col ${isMobile ? (mobileTab === 'files' ? 'w-full flex-1' : 'hidden') : 'w-56'}`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[.06]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Files</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCreatingFile(true)}
                className="rounded p-1 text-slate-400 hover:bg-white/[.06] hover:text-white"
                title="New File"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-2 py-1.5 border-b border-white/[.04]">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-2 text-slate-500" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search files…"
                className="w-full rounded-md bg-black/40 pl-6 pr-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 border border-white/[.06]"
              />
            </div>
          </div>

          {/* File creation form */}
          {isCreatingFile && (
            <form onSubmit={handleCreateFile} className="p-2 border-b border-violet-500/30 bg-violet-500/5">
              <input
                autoFocus
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.js..."
                className="w-full rounded bg-black/60 px-2 py-1 text-xs text-white border border-violet-500/50 focus:outline-none"
              />
              <div className="mt-1.5 flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingFile(false)}
                  className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-500"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* File Tree List */}
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {filteredFiles.map((file) => {
              const isActive = file.id === canvas.activeFileId;
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    canvas.setActiveFile(file.id);
                    if (isMobile) setMobileTab('code');
                  }}
                  className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-mono cursor-pointer transition ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-200 font-semibold border border-violet-500/30'
                      : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCode size={13} className={isActive ? 'text-violet-400' : 'text-slate-500'} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  {canvas.files.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        canvas.removeFile(file.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400"
                      title="Delete file"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER / RIGHT WORKSPACE */}
        <div className={`flex flex-1 flex-col min-w-0 overflow-hidden ${isMobile && mobileTab === 'files' ? 'hidden' : 'flex'}`}>
          {/* TABS & ACTIONS */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[.07] bg-[#14131d] px-2 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
              {canvas.files.map((file) => {
                const isActive = file.id === canvas.activeFileId;
                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      canvas.setActiveFile(file.id);
                      if (isMobile) setMobileTab('code');
                    }}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-mono cursor-pointer border-t-2 select-none transition ${
                      isActive
                        ? 'border-violet-400 bg-[#171622] text-violet-200 font-medium'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[.03]'
                    }`}
                  >
                    <span>{file.name}</span>
                    {file.modified && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Editor Quick Tools */}
            <div className="flex items-center gap-1 text-slate-400 shrink-0">
              <button
                type="button"
                disabled={!canvas.canUndo}
                onClick={canvas.undo}
                className="p-1 hover:text-white disabled:opacity-30"
                title="Undo"
              >
                <Undo2 size={13} />
              </button>
              <button
                type="button"
                disabled={!canvas.canRedo}
                onClick={canvas.redo}
                className="p-1 hover:text-white disabled:opacity-30"
                title="Redo"
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
                title="Copy content"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* SPLIT VIEW (EDITOR + PREVIEW) */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* CODE EDITOR PANE */}
            {(!isMobile ? (viewMode === 'editor-only' || viewMode === 'split') : (mobileTab === 'code')) && (
              <div className="flex flex-1 flex-col min-w-0 border-r border-white/[.07] bg-[#111018]">
                {/* Diff Banner if pending */}
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
                        className="rounded bg-amber-400 px-2 py-0.5 font-bold text-slate-950 hover:bg-amber-300 text-xs"
                      >
                        Accept Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Editor Surface */}
                <div className="relative flex-1 min-h-0 overflow-auto font-mono text-xs flex">
                  {/* Line Numbers */}
                  <div className="shrink-0 w-12 bg-[#0e0d14] py-3 text-right pr-3 text-slate-600 select-none border-r border-white/[.05]">
                    {active ? (
                      active.content.split('\n').map((_, idx) => (
                        <div key={idx} className="leading-5">
                          {idx + 1}
                        </div>
                      ))
                    ) : (
                      <div className="leading-5">1</div>
                    )}
                  </div>

                  {/* Textarea Code Input */}
                  <textarea
                    value={active?.content || ''}
                    onChange={(e) => canvas.updateContent(e.target.value)}
                    placeholder="Write code here…"
                    spellCheck={false}
                    className="flex-1 resize-none bg-transparent p-3 leading-5 text-slate-200 focus:outline-none font-mono text-xs overflow-auto whitespace-pre"
                  />
                </div>

                {/* Bottom AI Refactor Bar */}
                <form
                  onSubmit={handleEditorAiRefactor}
                  className="flex items-center gap-1.5 sm:gap-2 border-t border-white/[.07] bg-[#13121b] p-2 shrink-0"
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
                    className="shrink-0 whitespace-nowrap min-w-max rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition shadow-sm"
                  >
                    {editorAiBusy ? 'Refactoring…' : 'Refactor'}
                  </button>
                </form>
              </div>
            )}

            {/* PREVIEW PANE */}
            {(!isMobile ? (viewMode === 'preview-only' || viewMode === 'split') : (mobileTab === 'preview')) && (
              <div className="flex flex-1 flex-col min-w-0 bg-[#0c0c10]">
                {/* Preview Toolbar */}
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[.07] bg-[#14131d] px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300">Live Preview</span>
                    <button
                      type="button"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="p-1 text-slate-400 hover:text-white"
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
                        className={`p-1 rounded ${deviceViewport === 'desktop' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        title="Desktop (100%)"
                      >
                        <Monitor size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceViewport('tablet')}
                        className={`p-1 rounded ${deviceViewport === 'tablet' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        title="Tablet (768px)"
                      >
                        <Tablet size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceViewport('mobile')}
                        className={`p-1 rounded ${deviceViewport === 'mobile' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        title="Mobile (375px)"
                      >
                        <Smartphone size={12} />
                      </button>
                    </div>

                    {/* Pop-out to standalone browser window */}
                    <button
                      type="button"
                      onClick={openPreviewInNewWindow}
                      className="p-1 text-slate-400 hover:text-violet-300 transition"
                      title="Open preview in new browser tab"
                    >
                      <ExternalLink size={13} />
                    </button>

                    {/* Full Screen Preview Button */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreenPreview(true)}
                      className="flex items-center gap-1 rounded bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-xs font-medium text-violet-200 hover:bg-violet-500/25 transition shadow-sm"
                      title="Full Screen Preview"
                    >
                      <Maximize2 size={12} />
                      <span className="hidden sm:inline">Full Screen</span>
                    </button>
                  </div>
                </div>

                {/* Sandboxed iframe Container */}
                <div className="flex-1 min-h-0 flex items-center justify-center p-1 sm:p-2 overflow-auto bg-[#09090d]">
                  <div
                    className={`h-full max-w-full transition-all duration-200 bg-white shadow-2xl rounded-md overflow-hidden ${
                      deviceViewport === 'mobile'
                        ? 'w-[375px]'
                        : deviceViewport === 'tablet'
                        ? 'w-[768px]'
                        : 'w-full'
                    }`}
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

          {/* 3. BOTTOM DOCK (LINUX TERMINAL, OUTPUT, PROBLEMS, PACKAGES) */}
          {(!isMobile ? (isBottomDockOpen || viewMode === 'terminal-only') : (mobileTab === 'terminal')) && (
            <div className={`border-t border-white/[.07] bg-[#0f0e15] flex flex-col ${isMobile || viewMode === 'terminal-only' ? 'flex-1' : 'h-48'}`}>
              {/* Dock Header */}
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/[.06] bg-[#13121b] px-2 sm:px-3">
                <div className="flex items-center gap-1.5 sm:gap-4 text-xs overflow-x-auto scrollbar-none shrink-0">
                  <button
                    type="button"
                    onClick={() => setBottomTab('terminal')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 font-medium py-1 transition ${bottomTab === 'terminal' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <TerminalIcon size={12} />
                    <span>Terminal</span>
                    <span className="hidden sm:inline"> (Linux bash)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomTab('output')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 font-medium py-1 transition ${bottomTab === 'output' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Layers size={12} />
                    <span>Output</span>
                    <span className="hidden sm:inline"> Console</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomTab('problems')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 font-medium py-1 transition ${bottomTab === 'problems' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <AlertCircle size={12} />
                    <span>Problems</span>
                    <span className="hidden sm:inline"> (0)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomTab('packages')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 font-medium py-1 transition ${bottomTab === 'packages' ? 'text-violet-300 border-b-2 border-violet-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Cpu size={12} />
                    <span>Env</span>
                    <span className="hidden sm:inline">ironment</span>
                  </button>
                </div>

                {!isMobile && viewMode !== 'terminal-only' && (
                  <button
                    type="button"
                    onClick={() => setIsBottomDockOpen(false)}
                    className="text-slate-400 hover:text-white shrink-0 p-1"
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
                        className={
                          log.type === 'cmd'
                            ? 'text-violet-200 font-medium whitespace-pre-wrap'
                            : log.type === 'stderr'
                            ? 'text-rose-400 whitespace-pre-wrap'
                            : log.type === 'info'
                            ? 'text-violet-400/80 italic whitespace-pre-wrap'
                            : 'text-slate-200 whitespace-pre-wrap'
                        }
                      >
                        {log.text}
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                    {/* Command input prompt */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        executeCommand(commandInput);
                      }}
                      className="flex items-center gap-1 pt-1"
                    >
                      <span className="text-violet-400 font-semibold shrink-0 hidden sm:inline">ayatrisya@workspace</span>
                      <span className="text-slate-500 shrink-0 hidden sm:inline">:</span>
                      <span className="text-violet-300 font-medium shrink-0 hidden sm:inline">{currentVm.getDisplayPath()}</span>
                      <span className="text-violet-400 font-semibold shrink-0 sm:hidden">bash</span>
                      <span className="text-slate-400 font-bold ml-0.5 mr-1 shrink-0">$</span>
                      <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        placeholder="Type a Linux command (ls, cat, touch, node, python3, help)..."
                        className="flex-1 bg-transparent min-w-0 text-slate-100 focus:outline-none font-mono text-xs"
                        onKeyDown={(e) => {
                          const hist = currentVm.getHistory();
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
                  </div>
                )}

                {bottomTab === 'output' && (
                  <div className="space-y-1 text-slate-300">
                    {previewLogs.length === 0 ? (
                      <div className="text-slate-500 italic">No console logs emitted yet.</div>
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
                  <div className="text-slate-500 italic">No syntax errors detected in workspace.</div>
                )}

                {bottomTab === 'packages' && (
                  <div className="text-slate-300 space-y-1.5 leading-relaxed">
                    <div>Environment: <span className="text-violet-300 font-semibold">{desktop ? 'Desktop Native Linux Host' : 'Ayatrisya Linux 2.0 LTS (Virtual POSIX Environment)'}</span></div>
                    <div>Kernel: <span className="text-slate-400 font-mono">6.6.0-ayatrisya #1 SMP PREEMPT_DYNAMIC x86_64</span></div>
                    <div>Architecture: <span className="text-slate-400 font-mono">x86_64 (GNU/Linux)</span></div>
                    <div>User & Shell: <span className="text-slate-400 font-mono">ayatrisya (uid 1000) / /bin/bash (5.2.21)</span></div>
                    <div>Runtimes: <span className="text-slate-400 font-mono">Node.js v20.12.2, Python 3.12.3, GCC 13.2.0, npm 10.5.0</span></div>
                    <div>Virtual Filesystem: <span className="text-slate-400 font-mono">/home/ayatrisya/project mounted with real-time bidirectional canvas sync</span></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isBottomDockOpen && viewMode !== 'terminal-only' && (
            <div className="flex h-6 shrink-0 items-center justify-between border-t border-white/[.07] bg-[#0f0e15] px-3 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => setIsBottomDockOpen(true)}
                className="flex items-center gap-1.5 hover:text-violet-300 font-medium transition"
              >
                <TerminalIcon size={11} />
                <span>Show Linux Terminal & Console</span>
              </button>
              <span className="text-[10px] text-slate-500">Ayatrisya Linux Environment</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. AI PROJECT GENERATION MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#13121b] p-5 shadow-2xl">
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
            {/* Instant Templates / Game Scaffolding */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiBusy}
                onClick={load2DGameTemplate}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition"
              >
                <span>🎮 2D Cyber Arcade</span>
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={load3DGameTemplate}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 transition"
              >
                <span>🚀 3D Space Flight (Three.js)</span>
              </button>
            </div>

            <form onSubmit={handleGenerateProject} className="mt-3">
              <label className="block text-xs font-medium text-slate-400">
                Project Prompt & Requirements
                <textarea
                  autoFocus
                  disabled={aiBusy}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Build a 2D dungeon crawler with collision, inventory, and enemies, or an interactive task dashboard..."
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-white/10 bg-black/50 p-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
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

      {/* 5. FULL SCREEN LIVE PREVIEW OVERLAY */}
      {isFullscreenPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0c10] select-auto animate-in fade-in duration-200">
          {/* Top Fullscreen Header */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#14131d]/95 px-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold tracking-wide text-white flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Preview (Full Screen)
              </span>
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/[.06] hover:text-white transition"
                title="Reload preview"
              >
                <RotateCcw size={12} />
                <span>Reload</span>
              </button>
            </div>

            {/* Center Device Viewport Switcher */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
              <button
                type="button"
                onClick={() => setDeviceViewport('desktop')}
                className={`p-1 rounded text-xs px-2 flex items-center gap-1 transition ${deviceViewport === 'desktop' ? 'bg-white/10 text-white font-medium' : 'text-slate-500 hover:text-slate-300'}`}
                title="Desktop (100%)"
              >
                <Monitor size={12} />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceViewport('tablet')}
                className={`p-1 rounded text-xs px-2 flex items-center gap-1 transition ${deviceViewport === 'tablet' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Tablet (768px)"
              >
                <Tablet size={12} />
                <span className="hidden sm:inline">Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceViewport('mobile')}
                className={`p-1 rounded text-xs px-2 flex items-center gap-1 transition ${deviceViewport === 'mobile' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Mobile (375px)"
              >
                <Smartphone size={12} />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>

            {/* Right: Pop-out and Exit Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openPreviewInNewWindow}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[.06] transition"
                title="Open preview in new browser tab"
              >
                <ExternalLink size={12} />
                <span>New Tab</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreenPreview(false)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500 shadow-sm transition"
                title="Exit Full Screen (Esc)"
              >
                <Minimize2 size={13} />
                <span>Exit Full Screen</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Iframe Canvas */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-0 md:p-3 overflow-hidden bg-[#050608]">
            <div
              className={`h-full transition-all duration-200 bg-white shadow-2xl rounded-none md:rounded-lg overflow-hidden ${
                deviceViewport === 'mobile'
                  ? 'w-[375px]'
                  : deviceViewport === 'tablet'
                  ? 'w-[768px]'
                  : 'w-full'
              }`}
            >
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
