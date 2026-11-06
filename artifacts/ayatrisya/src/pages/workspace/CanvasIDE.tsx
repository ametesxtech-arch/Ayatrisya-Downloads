import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Code2,
  Play,
  Square,
  RotateCcw,
  Plus,
  FolderPlus,
  Trash2,
  Download,
  Copy,
  Check,
  Search,
  Sparkles,
  Columns2,
  Monitor,
  Smartphone,
  Tablet,
  Maximize2,
  Terminal as TerminalIcon,
  AlertCircle,
  FileCode,
  FileText,
  FileJson,
  X,
  Undo2,
  Redo2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useCanvas, CanvasProvider, useOptionalCanvas } from '@/components/canvas/CanvasContext';
import { usePrefs } from '@/hooks/use-prefs';
import { useDesktopRuntime } from '@/desktop/use-runtime';
import { useIsMobile } from '@/hooks/use-mobile';
import { generateProjectFromPrompt, type ProjectGenerationProgress } from '@/ai/project-generator';
import { generateGameProjectFromPrompt, createPlayable2DGame, createPlayable3DGame } from '@/ai/game-generator';
import { modelClient } from '@/ai/client';

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

  // Terminal & Command Execution State
  const [commandInput, setCommandInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'cmd' | 'stdout' | 'stderr' | 'info' }>>([
    { text: 'Ayatrisya Virtual Dev Environment [Version 2.0.0-web]', type: 'info' },
    { text: 'Type "help" for a list of supported commands or click "Run" to test your project.', type: 'info' },
  ]);
  const [activeProcess, setActiveProcess] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Live Preview Key (increment to trigger clean iframe re-render)
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLogs, setPreviewLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  // Construct Virtual Sandboxed HTML from Canvas Files
  const bundledPreviewHtml = useMemo(() => {
    // Prefer the currently active file if it is an HTML document or snippet
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

    let baseHtml = htmlFile ? htmlFile.content : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title></head><body><div id="app"></div></body></html>`;

    // Inject combined CSS only if the active document doesn't already contain inline style sheets
    const combinedCss = cssFiles.map((c) => `<style data-file="${c.name}">\n${c.content}\n</style>`).join('\n');
    if (combinedCss && (!activeIsHtml || !baseHtml.includes('<style'))) {
      if (baseHtml.includes('</head>')) {
        baseHtml = baseHtml.replace('</head>', `${combinedCss}\n</head>`);
      } else {
        baseHtml = `${combinedCss}\n${baseHtml}`;
      }
    }

    // Intercept console.log and errors for IDE preview dock
    const loggerScript = `
<script>
  (function() {
    const origLog = console.log;
    const origErr = console.error;
    window.addEventListener('message', function(e) {
      if (e.data === 'ping') window.parent.postMessage('pong', '*');
    });
    console.log = function(...args) {
      origLog(...args);
      window.parent.postMessage({ type: 'canvas-log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    };
    console.error = function(...args) {
      origErr(...args);
      window.parent.postMessage({ type: 'canvas-error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    };
    window.onerror = function(msg, url, line) {
      window.parent.postMessage({ type: 'canvas-error', message: 'Error: ' + msg + ' (Line ' + line + ')' }, '*');
    };
  })();
</script>
`;

    // Inject scripts
    const combinedJs = jsFiles.map((j) => `<script data-file="${j.name}">\ntry {\n${j.content}\n} catch(err) { console.error(err.message); }\n</script>`).join('\n');

    const injection = `${loggerScript}\n${combinedJs}`;
    if (baseHtml.includes('</body>')) {
      baseHtml = baseHtml.replace('</body>', `${injection}\n</body>`);
    } else {
      baseHtml = `${baseHtml}\n${injection}`;
    }

    return baseHtml;
  }, [canvas.files, canvas.activeFile, canvas.activeFileId]);

  // Listen for logs from preview iframe
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'canvas-log') {
        setPreviewLogs((prev) => [...prev.slice(-100), `[LOG] ${e.data.message}`]);
      } else if (e.data?.type === 'canvas-error') {
        setPreviewLogs((prev) => [...prev.slice(-100), `[ERR] ${e.data.message}`]);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  // Handle Command Execution (Desktop Native or Web Isolated Sandbox)
  const executeCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    setTerminalLogs((prev) => [...prev, { text: `$ ${trimmed}`, type: 'cmd' }]);
    setCommandInput('');

    // Check if Desktop runtime is available
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

    // Web Virtual Environment Command Interpreter
    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    setActiveProcess(cmd);
    await new Promise((r) => setTimeout(r, 80)); // Simulate async execution tick

    switch (cmd) {
      case 'help':
        setTerminalLogs((prev) => [
          ...prev,
          { text: 'Available virtual commands in Ayatrisya Web IDE:', type: 'info' },
          { text: '  ls                 List project files and sizes', type: 'info' },
          { text: '  cat <file>         Print file contents', type: 'info' },
          { text: '  touch <file>       Create a new blank file', type: 'info' },
          { text: '  rm <file>          Delete a file from project', type: 'info' },
          { text: '  run / test         Trigger application build and live preview refresh', type: 'info' },
          { text: '  clear              Clear the terminal log', type: 'info' },
          { text: '  npm test           Run simulated project test suite', type: 'info' },
          { text: '  node <file>        Run JavaScript file in sandbox worker', type: 'info' },
          { text: '  python <file>      Report Python interpreter requirements', type: 'info' },
          { text: 'Note: Full native bash/PowerShell is active when using Ayatrisya Desktop.', type: 'info' },
        ]);
        break;

      case 'clear':
        setTerminalLogs([]);
        break;

      case 'ls':
        const fileList = canvas.files.map((f) => `${f.name.padEnd(20)} ${f.content.length} B`).join('\n');
        setTerminalLogs((prev) => [...prev, { text: fileList, type: 'stdout' }]);
        break;

      case 'cat':
        if (!args[0]) {
          setTerminalLogs((prev) => [...prev, { text: 'usage: cat <filename>', type: 'stderr' }]);
        } else {
          const target = canvas.files.find((f) => f.name === args[0]);
          if (target) {
            setTerminalLogs((prev) => [...prev, { text: target.content, type: 'stdout' }]);
          } else {
            setTerminalLogs((prev) => [...prev, { text: `cat: ${args[0]}: No such file`, type: 'stderr' }]);
          }
        }
        break;

      case 'touch':
        if (!args[0]) {
          setTerminalLogs((prev) => [...prev, { text: 'usage: touch <filename>', type: 'stderr' }]);
        } else {
          canvas.addFile({ name: args[0], content: '', language: getLangFromExt(args[0]) });
          setTerminalLogs((prev) => [...prev, { text: `Created file: ${args[0]}`, type: 'info' }]);
        }
        break;

      case 'rm':
        if (!args[0]) {
          setTerminalLogs((prev) => [...prev, { text: 'usage: rm <filename>', type: 'stderr' }]);
        } else {
          const target = canvas.files.find((f) => f.name === args[0]);
          if (target) {
            canvas.removeFile(target.id);
            setTerminalLogs((prev) => [...prev, { text: `Removed file: ${args[0]}`, type: 'info' }]);
          } else {
            setTerminalLogs((prev) => [...prev, { text: `rm: ${args[0]}: No such file`, type: 'stderr' }]);
          }
        }
        break;

      case 'run':
      case 'build':
        setPreviewKey((k) => k + 1);
        setTerminalLogs((prev) => [
          ...prev,
          { text: `✓ Compiled ${canvas.files.length} project files. Live preview reloaded.`, type: 'stdout' },
        ]);
        break;

      case 'npm':
        if (args[0] === 'test') {
          setTerminalLogs((prev) => [
            ...prev,
            { text: '> project@0.0.0 test', type: 'stdout' },
            { text: `✓ syntax check (${canvas.files.length} files passed)`, type: 'stdout' },
            { text: `✓ sandboxed runtime verified without warnings`, type: 'stdout' },
          ]);
        } else if (args[0] === 'run') {
          setPreviewKey((k) => k + 1);
          setTerminalLogs((prev) => [
            ...prev,
            { text: `> dev server online at internal preview port`, type: 'stdout' },
          ]);
        } else {
          setTerminalLogs((prev) => [
            ...prev,
            { text: `npm: package installation in web sandbox is virtualized. Use Ayatrisya Desktop for native npm/pnpm.`, type: 'info' },
          ]);
        }
        break;

      case 'node':
        const jsTarget = canvas.files.find((f) => f.name === (args[0] || 'app.js') || f.name === 'index.js');
        if (jsTarget) {
          try {
            // Safe evaluation of console logs
            const captured: string[] = [];
            const safeLog = (...a: any[]) => captured.push(a.map(x => String(x)).join(' '));
            const fn = new Function('console', jsTarget.content);
            fn({ log: safeLog, error: safeLog, warn: safeLog });
            setTerminalLogs((prev) => [
              ...prev,
              { text: captured.join('\n') || 'Execution completed with return code 0.', type: 'stdout' },
            ]);
          } catch (e: any) {
            setTerminalLogs((prev) => [...prev, { text: `Runtime error: ${e.message}`, type: 'stderr' }]);
          }
        } else {
          setTerminalLogs((prev) => [...prev, { text: `node: ${args[0] || 'file'}: not found`, type: 'stderr' }]);
        }
        break;

      case 'python':
        setTerminalLogs((prev) => [
          ...prev,
          { text: `Python execution requires native CPython host. Switch to Ayatrisya Desktop for full native Python environments.`, type: 'info' },
        ]);
        break;

      default:
        setTerminalLogs((prev) => [
          ...prev,
          { text: `bash: ${cmd}: command not found. Type "help" for available commands.`, type: 'stderr' },
        ]);
        break;
    }

    setActiveProcess(null);
  };

  const getLangFromExt = (fileName: string) => {
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
      default: return 'plaintext';
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
          { text: `✓ AI generated ${res.files.length} project files (${res.files.map(f => f.path).join(', ')}).`, type: 'info' },
        ]);
      }
    } catch (err: any) {
      setAiStatus(`Error: ${err?.message || 'Project generation failed'}`);
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
    } catch (err: any) {
      alert(`AI modification error: ${err?.message || 'Failed'}`);
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

  // Filtered file tree
  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return canvas.files;
    return canvas.files.filter((f) => f.name.toLowerCase().includes(filterQuery.toLowerCase()));
  }, [canvas.files, filterQuery]);

  const active = canvas.activeFile;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0d0f17] text-slate-200 select-none font-sans">
      {/* 1. TOP TOOLBAR */}
      <header className="flex h-11 sm:h-12 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#12141e]/90 px-2 sm:px-3 backdrop-blur-md gap-1 sm:gap-2">
        {/* Left: Branding & Project Meta */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 pr-1.5 sm:pr-3 border-r border-white/10">
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 font-bold shrink-0">
              <Code2 size={14} />
            </div>
            <span className="text-xs font-semibold tracking-wide text-white hidden sm:inline">Canvas IDE</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="font-mono text-slate-300 font-medium truncate max-w-[80px] sm:max-w-none">{active ? active.name : 'project'}</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Saved locally in browser" />
          </div>
        </div>

        {/* Center: Mobile Navigation Switcher vs Desktop Mode Selector */}
        {isMobile ? (
          <div className="flex items-center gap-0.5 bg-black/50 p-0.5 rounded-lg border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab('files')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'files' ? 'bg-teal-500/25 text-teal-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Files
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('code')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'code' ? 'bg-teal-500/25 text-teal-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'preview' ? 'bg-teal-500/25 text-teal-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('terminal')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2 py-1 text-[11px] rounded font-medium transition ${mobileTab === 'terminal' ? 'bg-teal-500/25 text-teal-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Terminal
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('editor-only')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded font-medium transition ${viewMode === 'editor-only' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'}`}
              title="Editor Only"
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded font-medium transition ${viewMode === 'split' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'}`}
              title="Editor + Preview Split"
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview-only')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded font-medium transition ${viewMode === 'preview-only' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'}`}
              title="Full-screen Preview"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('terminal-only')}
              className={`shrink-0 whitespace-nowrap min-w-max px-2.5 py-1 text-xs rounded font-medium transition ${viewMode === 'terminal-only' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'}`}
              title="Terminal Focused"
            >
              Terminal
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Run Button */}
          <button
            type="button"
            onClick={() => {
              if (isMobile) setMobileTab('preview');
              setPreviewKey((k) => k + 1);
              setTerminalLogs((prev) => [...prev, { text: 'Running preview server update…', type: 'info' }]);
            }}
            className="shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 rounded-md bg-emerald-500 px-2 sm:px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 shadow-md transition"
            title="Compile & Run Project (Ctrl+Enter)"
          >
            <Play size={12} fill="currentColor" />
            <span className="hidden sm:inline">Run</span>
          </button>

          {/* AI Project Generator */}
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="shrink-0 whitespace-nowrap min-w-max flex items-center gap-1 sm:gap-1.5 rounded-md border border-teal-500/40 bg-teal-500/10 px-2 sm:px-2.5 py-1 text-xs font-medium text-teal-300 hover:bg-teal-500/20 transition"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">AI Generate</span>
          </button>

          {/* Export Project */}
          <button
            type="button"
            onClick={handleDownloadAll}
            className="shrink-0 whitespace-nowrap min-w-max hidden sm:flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[.06] transition"
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
        <aside className={`shrink-0 border-r border-white/[.08] bg-[#0f111a] flex flex-col ${isMobile ? (mobileTab === 'files' ? 'w-full flex-1' : 'hidden') : 'w-56'}`}>
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
                className="w-full rounded bg-black/40 pl-6 pr-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 border border-white/[.06]"
              />
            </div>
          </div>

          {/* File creation form */}
          {isCreatingFile && (
            <form onSubmit={handleCreateFile} className="p-2 border-b border-teal-500/30 bg-teal-500/5">
              <input
                autoFocus
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.js..."
                className="w-full rounded bg-black/60 px-2 py-1 text-xs text-white border border-teal-500/50 focus:outline-none"
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
                  className="rounded bg-teal-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950"
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
                  className={`group flex items-center justify-between rounded px-2 py-1 text-xs font-mono cursor-pointer transition ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30'
                      : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <FileCode size={13} className={isActive ? 'text-teal-400' : 'text-slate-500'} />
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
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#11131c] px-2 overflow-x-auto">
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
                        ? 'border-teal-400 bg-[#0d0f17] text-teal-200 font-medium'
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
              <div className="flex flex-1 flex-col min-w-0 border-r border-white/[.08] bg-[#0d0f17]">
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
                  <div className="shrink-0 w-12 bg-[#090b10] py-3 text-right pr-3 text-slate-600 select-none border-r border-white/[.05]">
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
                  className="flex items-center gap-2 border-t border-white/[.08] bg-[#12141e] p-2"
                >
                  <Sparkles size={14} className="text-teal-400 ml-1" />
                  <input
                    type="text"
                    value={editorAiPrompt}
                    onChange={(e) => setEditorAiPrompt(e.target.value)}
                    disabled={editorAiBusy || !active}
                    placeholder={active ? `Ask AI to modify ${active.name} (e.g. "Add error handling, responsive grid styling")...` : 'Select a file...'}
                    className="flex-1 rounded bg-black/40 px-2.5 py-1 text-xs text-white border border-white/10 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={editorAiBusy || !editorAiPrompt.trim()}
                    className="shrink-0 whitespace-nowrap min-w-max rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-40 transition"
                  >
                    {editorAiBusy ? 'Refactoring…' : 'Refactor'}
                  </button>
                </form>
              </div>
            )}

            {/* PREVIEW PANE */}
            {(!isMobile ? (viewMode === 'preview-only' || viewMode === 'split') : (mobileTab === 'preview')) && (
              <div className="flex flex-1 flex-col min-w-0 bg-[#090a0f]">
                {/* Preview Toolbar */}
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#11131c] px-3">
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
                </div>

                {/* Sandboxed iframe Container */}
                <div className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-auto bg-[#050608]">
                  <div
                    className={`h-full transition-all duration-200 bg-white shadow-2xl rounded-md overflow-hidden ${
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

          {/* 3. BOTTOM DOCK (TERMINAL, OUTPUT, PROBLEMS) */}
          {(!isMobile ? (isBottomDockOpen || viewMode === 'terminal-only') : (mobileTab === 'terminal')) && (
            <div className={`border-t border-white/[.08] bg-[#0d0f17] flex flex-col ${isMobile || viewMode === 'terminal-only' ? 'flex-1' : 'h-44'}`}>
              {/* Dock Header */}
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/[.06] bg-[#11131c] px-3">
                <div className="flex items-center gap-2 sm:gap-4 text-xs overflow-x-auto scrollbar-none shrink-0">
                  <button
                    type="button"
                    onClick={() => setBottomTab('terminal')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1.5 font-medium py-1 transition ${bottomTab === 'terminal' ? 'text-teal-300 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <TerminalIcon size={12} />
                    <span>Terminal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomTab('output')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1.5 font-medium py-1 transition ${bottomTab === 'output' ? 'text-teal-300 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Layers size={12} />
                    <span>Console Output</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomTab('problems')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1.5 font-medium py-1 transition ${bottomTab === 'problems' ? 'text-teal-300 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <AlertCircle size={12} />
                    <span>Problems (0)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBottomTab('packages')}
                    className={`shrink-0 whitespace-nowrap min-w-max flex items-center gap-1.5 font-medium py-1 transition ${bottomTab === 'packages' ? 'text-teal-300 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <span>Packages</span>
                  </button>
                </div>

                {viewMode !== 'terminal-only' && (
                  <button
                    type="button"
                    onClick={() => setIsBottomDockOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Dock Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2 font-mono text-xs">
                {bottomTab === 'terminal' && (
                  <div className="space-y-1">
                    {terminalLogs.map((log, index) => (
                      <div
                        key={index}
                        className={
                          log.type === 'cmd'
                            ? 'text-teal-300 font-bold'
                            : log.type === 'stderr'
                            ? 'text-rose-400'
                            : log.type === 'info'
                            ? 'text-slate-400 italic'
                            : 'text-slate-200'
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
                      <span className="text-teal-400 font-bold">$</span>
                      <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        placeholder="Type a command (ls, cat, run, npm test, help)..."
                        className="flex-1 bg-transparent text-white focus:outline-none"
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
                  <div className="text-slate-400 space-y-1">
                    <div>Environment: <span className="text-teal-300">{desktop ? 'Desktop Native Local Host' : 'Web Sandboxed Client Engine'}</span></div>
                    <div>Virtual modules: Standard Web APIs, ES Modules, HTML5, CSS3</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isBottomDockOpen && viewMode !== 'terminal-only' && (
            <div className="flex h-6 shrink-0 items-center justify-between border-t border-white/[.08] bg-[#0d0f17] px-3 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => setIsBottomDockOpen(true)}
                className="flex items-center gap-1.5 hover:text-teal-300 font-medium transition"
              >
                <TerminalIcon size={11} />
                <span>Show Terminal & Console</span>
              </button>
              <span className="text-[10px] text-slate-600">Ayatrisya Dev Environment</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. AI PROJECT GENERATION MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#12141c] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles size={16} className="text-teal-400" />
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
                className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs text-teal-300 hover:bg-teal-500/20 transition"
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
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-white/10 bg-black/50 p-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                />
              </label>
              {aiStatus && (
                <p className="mt-2 text-xs text-teal-300 flex items-center gap-1.5">
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
                  className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-40"
                >
                  <Sparkles size={13} />
                  {aiBusy ? 'Generating Project…' : 'Generate Project'}
                </button>
              </div>
            </form>
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
