import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { CanvasFile, CanvasDiff, CanvasHistoryEntry } from './types';

interface CanvasContextValue {
  isOpen: boolean;
  files: CanvasFile[];
  activeFileId: string;
  activeFile: CanvasFile | undefined;
  pendingDiff: CanvasDiff | null;
  canUndo: boolean;
  canRedo: boolean;
  openCanvas: (file?: { name: string; content: string; language?: string }) => void;
  closeCanvas: () => void;
  addFile: (file: { name: string; content: string; language?: string }) => void;
  loadProjectFiles: (newFiles: Array<{ name: string; content: string; language?: string }>) => void;
  removeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateContent: (content: string) => void;
  updateLanguage: (language: string) => void;
  updateFileName: (name: string) => void;
  stagePatch: (proposed: string) => void;
  acceptPatch: () => void;
  rejectPatch: () => void;
  undo: () => void;
  redo: () => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

const STORAGE_KEY = 'ayatrisya_canvas_project_state_v1';

const DEFAULT_FILES: CanvasFile[] = [
  {
    id: 'file-1',
    name: 'index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ayatrisya Canvas Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app-card">
    <h1>🚀 Welcome to Ayatrisya Canvas IDE</h1>
    <p>A full-screen, Replit-style development environment with live preview, AI generation, and terminal execution.</p>
    <button id="actionBtn">Click to Test</button>
    <div id="output"></div>
  </div>
  <script src="app.js"></script>
</body>
</html>
`,
  },
  {
    id: 'file-2',
    name: 'style.css',
    language: 'css',
    content: `body {
  margin: 0;
  padding: 30px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0f1117;
  color: #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.app-card {
  background: #181b24;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  text-align: center;
}

h1 {
  font-size: 20px;
  color: #38bdf8;
  margin-top: 0;
}

p {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.6;
}

button {
  background: linear-gradient(135deg, #06b6d4, #3b82f6);
  border: none;
  border-radius: 8px;
  color: white;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.2s;
  margin-top: 10px;
}

button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

#output {
  margin-top: 16px;
  font-family: monospace;
  font-size: 13px;
  color: #10b981;
}
`,
  },
  {
    id: 'file-3',
    name: 'app.js',
    language: 'javascript',
    content: `// Ayatrisya Canvas Client Logic
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('actionBtn');
  const output = document.getElementById('output');
  let clicks = 0;

  btn?.addEventListener('click', () => {
    clicks++;
    output.innerText = \`Executed successfully! Active click count: \${clicks}\`;
    console.log(\`[Canvas App] Button clicked: \${clicks} times.\`);
  });
});
`,
  },
];

function loadPersistedFiles(): { files: CanvasFile[]; activeFileId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.files) && parsed.files.length > 0) {
        return {
          files: parsed.files,
          activeFileId: parsed.activeFileId || parsed.files[0].id,
        };
      }
    }
  } catch {
    // ignore parse error and fallback
  }
  return { files: DEFAULT_FILES, activeFileId: 'file-1' };
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadPersistedFiles);
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<CanvasFile[]>(initial.files);
  const [activeFileId, setActiveFileId] = useState<string>(initial.activeFileId);
  const [pendingDiff, setPendingDiff] = useState<CanvasDiff | null>(null);

  // Undo/Redo history stack
  const [history, setHistory] = useState<CanvasHistoryEntry[]>([
    { files: initial.files, activeFileId: initial.activeFileId },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Auto-persist files to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, activeFileId }));
    } catch {
      // quota or private mode safe
    }
  }, [files, activeFileId]);

  const pushHistory = (newFiles: CanvasFile[], activeId: string) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ files: newFiles, activeFileId: activeId });
    if (nextHistory.length > 50) nextHistory.shift();
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const openCanvas = useCallback(
    (initialFile?: { name: string; content: string; language?: string }) => {
      setIsOpen(true);
      if (initialFile) {
        setFiles((prev) => {
          const existing = prev.find((f) => f.name === initialFile.name);
          if (existing) {
            setActiveFileId(existing.id);
            return prev;
          }
          const newFile: CanvasFile = {
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: initialFile.name,
            language: initialFile.language || 'typescript',
            content: initialFile.content,
          };
          const next = [...prev, newFile];
          setActiveFileId(newFile.id);
          pushHistory(next, newFile.id);
          return next;
        });
      }
    },
    [history, historyIndex]
  );

  const closeCanvas = useCallback(() => {
    setIsOpen(false);
    setPendingDiff(null);
  }, []);

  const addFile = useCallback(
    (file: { name: string; content: string; language?: string }) => {
      const newFile: CanvasFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        language: file.language || 'typescript',
        content: file.content,
      };
      setFiles((prev) => {
        const next = [...prev, newFile];
        setActiveFileId(newFile.id);
        pushHistory(next, newFile.id);
        return next;
      });
    },
    [history, historyIndex]
  );

  const loadProjectFiles = useCallback(
    (incomingFiles: Array<{ name: string; content: string; language?: string }>) => {
      if (!incomingFiles.length) return;
      const formatted: CanvasFile[] = incomingFiles.map((f, i) => ({
        id: `file-${Date.now()}-${i}`,
        name: f.name,
        content: f.content,
        language: f.language || 'typescript',
      }));
      setFiles(formatted);
      setActiveFileId(formatted[0].id);
      pushHistory(formatted, formatted[0].id);
      setIsOpen(true);
    },
    [history, historyIndex]
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((f) => f.id !== id);
        const nextActive = activeFileId === id ? next[0].id : activeFileId;
        setActiveFileId(nextActive);
        pushHistory(next, nextActive);
        return next;
      });
    },
    [activeFileId, history, historyIndex]
  );

  const updateContent = useCallback(
    (content: string) => {
      setFiles((prev) => {
        const next = prev.map((f) => (f.id === activeFileId ? { ...f, content, modified: true } : f));
        pushHistory(next, activeFileId);
        return next;
      });
    },
    [activeFileId, history, historyIndex]
  );

  const updateLanguage = useCallback(
    (language: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, language } : f))
      );
    },
    [activeFileId]
  );

  const updateFileName = useCallback(
    (name: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, name } : f))
      );
    },
    [activeFileId]
  );

  const stagePatch = useCallback(
    (proposed: string) => {
      const active = files.find((f) => f.id === activeFileId);
      if (!active) return;
      setPendingDiff({
        path: active.name,
        original: active.content,
        proposed,
      });
    },
    [files, activeFileId]
  );

  const acceptPatch = useCallback(() => {
    if (!pendingDiff) return;
    updateContent(pendingDiff.proposed);
    setPendingDiff(null);
  }, [pendingDiff, updateContent]);

  const rejectPatch = useCallback(() => {
    setPendingDiff(null);
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      const snapshot = history[nextIndex];
      setHistoryIndex(nextIndex);
      setFiles(snapshot.files);
      setActiveFileId(snapshot.activeFileId);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshot = history[nextIndex];
      setHistoryIndex(nextIndex);
      setFiles(snapshot.files);
      setActiveFileId(snapshot.activeFileId);
    }
  }, [history, historyIndex]);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  return (
    <CanvasContext.Provider
      value={{
        isOpen,
        files,
        activeFileId,
        activeFile,
        pendingDiff,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        openCanvas,
        closeCanvas,
        addFile,
        loadProjectFiles,
        removeFile,
        setActiveFile: setActiveFileId,
        updateContent,
        updateLanguage,
        updateFileName,
        stagePatch,
        acceptPatch,
        rejectPatch,
        undo,
        redo,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
}

const FALLBACK_CONTEXT: CanvasContextValue = {
  isOpen: false,
  files: DEFAULT_FILES,
  activeFileId: DEFAULT_FILES[0].id,
  activeFile: DEFAULT_FILES[0],
  pendingDiff: null,
  canUndo: false,
  canRedo: false,
  openCanvas: () => {},
  closeCanvas: () => {},
  addFile: () => {},
  loadProjectFiles: () => {},
  removeFile: () => {},
  setActiveFile: () => {},
  updateContent: () => {},
  updateLanguage: () => {},
  updateFileName: () => {},
  stagePatch: () => {},
  acceptPatch: () => {},
  rejectPatch: () => {},
  undo: () => {},
  redo: () => {},
};

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    console.warn('useCanvas was called outside of a CanvasProvider; using safe fallback context.');
    return FALLBACK_CONTEXT;
  }
  return ctx;
}

export function useCanvasSafe() {
  return useContext(CanvasContext) || FALLBACK_CONTEXT;
}

export function useOptionalCanvas() {
  return useContext(CanvasContext);
}
