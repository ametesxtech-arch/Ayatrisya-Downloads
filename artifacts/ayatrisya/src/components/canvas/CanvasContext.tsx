import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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

const DEFAULT_FILE: CanvasFile = {
  id: 'file-1',
  name: 'index.ts',
  language: 'typescript',
  content: `// Welcome to Ayatrisya Canvas
// Edit code directly, test safe execution, or ask AI to refactor

export function example() {
  console.log("Ayatrisya Canvas Active");
}
`,
};

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<CanvasFile[]>([DEFAULT_FILE]);
  const [activeFileId, setActiveFileId] = useState<string>('file-1');
  const [pendingDiff, setPendingDiff] = useState<CanvasDiff | null>(null);

  // Undo/Redo history stack
  const [history, setHistory] = useState<CanvasHistoryEntry[]>([
    { files: [DEFAULT_FILE], activeFileId: 'file-1' },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = (newFiles: CanvasFile[], activeId: string) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ files: newFiles, activeFileId: activeId });
    if (nextHistory.length > 50) nextHistory.shift(); // Limit to 50 snapshots
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

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        if (prev.length <= 1) return prev; // keep at least 1 file
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
      const prevIdx = historyIndex - 1;
      const snapshot = history[prevIdx];
      setFiles(snapshot.files);
      setActiveFileId(snapshot.activeFileId);
      setHistoryIndex(prevIdx);
      setPendingDiff(null);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const snapshot = history[nextIdx];
      setFiles(snapshot.files);
      setActiveFileId(snapshot.activeFileId);
      setHistoryIndex(nextIdx);
      setPendingDiff(null);
    }
  }, [history, historyIndex]);

  const activeFile = files.find((f) => f.id === activeFileId);

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

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    throw new Error('useCanvas must be used within CanvasProvider');
  }
  return ctx;
}

export function useOptionalCanvas() {
  return useContext(CanvasContext);
}
