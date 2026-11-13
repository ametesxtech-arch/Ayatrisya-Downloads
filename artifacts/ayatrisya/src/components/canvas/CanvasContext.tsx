import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { CanvasFile, CanvasDiff, CanvasHistoryEntry, CanvasProject } from './types';
import { downloadZip } from '@/lib/zip-export';
import { downloadBlob } from '@/storage/backup';

export interface CanvasContextValue {
  isOpen: boolean;
  files: CanvasFile[];
  activeFileId: string;
  activeFile: CanvasFile | undefined;
  pendingDiff: CanvasDiff | null;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  projects: CanvasProject[];
  activeProjectId: string;
  currentProjectName: string;
  openCanvas: (file?: { name: string; content: string; language?: string }) => void;
  closeCanvas: () => void;
  addFile: (file: { name: string; content: string; language?: string }) => void;
  createFolder: (folderPath: string) => void;
  renameFile: (id: string, newName: string) => void;
  duplicateFile: (id: string) => void;
  removeFile: (id: string) => void;
  loadProjectFiles: (newFiles: Array<{ name: string; content: string; language?: string }>) => void;
  setActiveFile: (id: string) => void;
  updateContent: (content: string) => void;
  updateLanguage: (language: string) => void;
  updateFileName: (name: string) => void;
  stagePatch: (proposed: string) => void;
  acceptPatch: () => void;
  rejectPatch: () => void;
  undo: () => void;
  redo: () => void;
  switchProject: (projectId: string) => void;
  createProject: (name: string, templateKey?: string) => void;
  renameProject: (name: string) => void;
  deleteProject: (projectId: string) => void;
  exportProjectZip: () => void;
  exportProjectJson: () => void;
  importProject: (data: { name?: string; files: Array<{ name: string; content: string; language?: string }> }) => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

const STORAGE_KEY_V1 = 'ayatrisya_canvas_project_state_v1';
const PROJECTS_STORAGE_KEY = 'ayatrisya_canvas_projects_v2';

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
    <p>A professional development environment with live preview, AI generation, and Linux bash terminal execution.</p>
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
  color: #a78bfa;
  margin-top: 0;
}

p {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.6;
}

button {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
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
  color: #34d399;
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
    output.innerText = \`✓ Executed successfully! Active click count: \${clicks}\`;
    console.log(\`[Canvas App] Button clicked: \${clicks} times.\`);
  });
});
`,
  },
];

export const PROJECT_TEMPLATES: Record<string, { name: string; files: Array<{ name: string; content: string; language: string }> }> = {
  'vanilla-web': {
    name: 'Vanilla Web App',
    files: DEFAULT_FILES,
  },
  'arcade-2d': {
    name: '2D Cyber Arcade Game',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cyber Runner 2088</title>
  <style>
    body { margin: 0; background: #050508; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: monospace; color: #fff; }
    canvas { border: 1px solid #8b5cf6; background: #0b0a12; box-shadow: 0 0 20px rgba(139,92,246,0.3); border-radius: 8px; }
    #hud { margin-bottom: 8px; display: flex; gap: 20px; font-size: 14px; color: #c4b5fd; }
  </style>
</head>
<body>
  <div id="hud">
    <span>SCORE: <strong id="scoreVal">0</strong></span>
    <span>LIVES: <strong id="livesVal">3</strong></span>
    <span>FPS: <strong id="fpsVal">60</strong></span>
  </div>
  <canvas id="gameCanvas" width="640" height="360"></canvas>
  <script src="game.js"></script>
</body>
</html>`,
      },
      {
        name: 'game.js',
        language: 'javascript',
        content: `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let score = 0;
let x = 60, y = 280, vy = 0, onGround = true;
const obstacles = [];

function spawnObstacle() {
  obstacles.push({ x: canvas.width, w: 24, h: 32, speed: 4 });
}

setInterval(spawnObstacle, 1600);

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Floor
  ctx.fillStyle = '#1e1b2e';
  ctx.fillRect(0, 312, canvas.width, 48);

  // Player
  vy += 0.6; // gravity
  y += vy;
  if (y >= 280) { y = 280; vy = 0; onGround = true; }
  ctx.fillStyle = '#8b5cf6';
  ctx.fillRect(x, y, 30, 32);

  // Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.x -= ob.speed;
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(ob.x, 312 - ob.h, ob.w, ob.h);
    if (ob.x < -30) {
      obstacles.splice(i, 1);
      score += 10;
      document.getElementById('scoreVal').innerText = score;
    }
  }

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'ArrowUp') && onGround) {
    vy = -12;
    onGround = false;
  }
});
canvas.addEventListener('click', () => {
  if (onGround) { vy = -12; onGround = false; }
});

loop();`,
      },
    ],
  },
  'python-script': {
    name: 'Python Scientific Script',
    files: [
      {
        name: 'main.py',
        language: 'python',
        content: `# Ayatrisya Python 3 Analytics & Utility Engine
import math
import json

def calculate_stats(data):
    n = len(data)
    mean = sum(data) / n
    variance = sum((x - mean) ** 2 for x in data) / n
    std_dev = math.sqrt(variance)
    return {
        "count": n,
        "mean": round(mean, 2),
        "std_dev": round(std_dev, 2),
        "min": min(data),
        "max": max(data)
    }

samples = [12, 18, 24, 30, 36, 42, 54, 66, 78, 90]
results = calculate_stats(samples)
print("=== Ayatrisya Analytics Results ===")
print(json.dumps(results, indent=2))
`,
      },
      {
        name: 'README.md',
        language: 'markdown',
        content: `# Python Analytics Engine
Run this script in the Ayatrisya Linux Terminal:
\`\`\`bash
python3 main.py
\`\`\`
`,
      },
    ],
  },
  'vite-react': {
    name: 'Vite + React SPA',
    files: [
      {
        name: 'package.json',
        language: 'json',
        content: `{
  "name": "ayatrisya-vite-react",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.1",
    "@vitejs/plugin-react": "^4.3.1"
  }
}
`,
      },
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      },
      {
        name: 'src/main.jsx',
        language: 'javascript',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      },
      {
        name: 'src/App.jsx',
        language: 'javascript',
        content: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: '#09080e',
      color: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: '#141320',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <h1 style={{ color: '#a78bfa', margin: '0 0 12px 0' }}>⚡ Vite + React 18</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>
          High-performance modern single page application with instant hot module reloading and component state isolation.
        </p>
        <button
          onClick={() => setCount((c) => c + 1)}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '16px',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
          }}
        >
          Count is: {count}
        </button>
      </div>
    </div>
  );
}
`,
      },
      {
        name: 'vite.config.js',
        language: 'javascript',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
`,
      },
    ],
  },
  'nextjs-app': {
    name: 'Next.js App',
    files: [
      {
        name: 'package.json',
        language: 'json',
        content: `{
  "name": "ayatrisya-nextjs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
`,
      },
      {
        name: 'app/page.tsx',
        language: 'typescript',
        content: `export default function Page() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', color: '#fff', background: '#0b0a11', minHeight: '100vh' }}>
      <h1 style={{ color: '#8b5cf6' }}>Next.js 14 App Router</h1>
      <p style={{ color: '#94a3b8' }}>Production React Framework running in Ayatrisya Canvas.</p>
    </main>
  );
}
`,
      },
    ],
  },
  'nodejs-api': {
    name: 'Node.js Express API',
    files: [
      {
        name: 'package.json',
        language: 'json',
        content: `{
  "name": "ayatrisya-node-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}
`,
      },
      {
        name: 'server.js',
        language: 'javascript',
        content: `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    runtime: 'Ayatrisya Web Sandbox / Desktop Native'
  });
});

app.listen(PORT, () => {
  console.log(\`[Server] Listening on http://localhost:\${PORT}\`);
});
`,
      },
    ],
  },
};

function loadPersistedState(): {
  projects: CanvasProject[];
  activeProjectId: string;
  files: CanvasFile[];
  activeFileId: string;
} {
  try {
    const rawProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (rawProjects) {
      const parsed = JSON.parse(rawProjects);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const active = parsed[0];
        return {
          projects: parsed,
          activeProjectId: active.id,
          files: active.files || DEFAULT_FILES,
          activeFileId: active.files?.[0]?.id || 'file-1',
        };
      }
    }

    // Fallback to V1 storage if available
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (Array.isArray(parsedV1.files) && parsedV1.files.length > 0) {
        const defaultProj: CanvasProject = {
          id: 'proj-default',
          name: 'Main Workspace',
          updatedAt: new Date().toISOString(),
          files: parsedV1.files,
        };
        return {
          projects: [defaultProj],
          activeProjectId: 'proj-default',
          files: parsedV1.files,
          activeFileId: parsedV1.activeFileId || parsedV1.files[0].id,
        };
      }
    }
  } catch {}

  const initialProject: CanvasProject = {
    id: 'proj-default',
    name: 'Main Workspace',
    updatedAt: new Date().toISOString(),
    files: DEFAULT_FILES,
  };

  return {
    projects: [initialProject],
    activeProjectId: 'proj-default',
    files: DEFAULT_FILES,
    activeFileId: 'file-1',
  };
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadPersistedState);
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<CanvasProject[]>(initial.projects);
  const [activeProjectId, setActiveProjectId] = useState<string>(initial.activeProjectId);
  const [files, setFiles] = useState<CanvasFile[]>(initial.files);
  const [activeFileId, setActiveFileId] = useState<string>(initial.activeFileId);
  const [pendingDiff, setPendingDiff] = useState<CanvasDiff | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // History stack for undo/redo
  const [history, setHistory] = useState<CanvasHistoryEntry[]>([
    { files: initial.files, activeFileId: initial.activeFileId },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Debounced auto-save to localStorage
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ files, activeFileId }));
        setProjects((prev) =>
          prev.map((p) =>
            p.id === activeProjectId
              ? { ...p, files, updatedAt: new Date().toISOString() }
              : p
          )
        );
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [files, activeFileId, activeProjectId]);

  // Persist all projects list
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {}
  }, [projects]);

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
        name: file.name.trim(),
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

  const createFolder = useCallback((folderPath: string) => {
    const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanFolder) return;
    const keepFile = `${cleanFolder}/.keep`;
    addFile({
      name: keepFile,
      content: `# ${cleanFolder}\n`,
      language: 'markdown',
    });
  }, [addFile]);

  const renameFile = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setFiles((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, name: trimmed, modified: true } : f));
      pushHistory(next, activeFileId);
      return next;
    });
  }, [activeFileId, history, historyIndex]);

  const duplicateFile = useCallback((id: string) => {
    setFiles((prev) => {
      const orig = prev.find((f) => f.id === id);
      if (!orig) return prev;
      const parts = orig.name.split('.');
      const ext = parts.length > 1 ? `.${parts.pop()}` : '';
      const base = parts.join('.');
      const dupName = `${base}-copy${ext}`;
      const dupFile: CanvasFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: dupName,
        language: orig.language,
        content: orig.content,
      };
      const next = [...prev, dupFile];
      setActiveFileId(dupFile.id);
      pushHistory(next, dupFile.id);
      return next;
    });
  }, [history, historyIndex]);

  const setActiveFile = useCallback((id: string) => {
    setActiveFileId(id);
  }, []);

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
      renameFile(activeFileId, name);
    },
    [activeFileId, renameFile]
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

  // Project Management Handlers
  const switchProject = useCallback((projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj || !proj.files.length) return;
    setActiveProjectId(proj.id);
    setFiles(proj.files);
    setActiveFileId(proj.files[0].id);
    setHistory([{ files: proj.files, activeFileId: proj.files[0].id }]);
    setHistoryIndex(0);
  }, [projects]);

  const createProject = useCallback((name: string, templateKey?: string) => {
    const tpl = templateKey && PROJECT_TEMPLATES[templateKey] ? PROJECT_TEMPLATES[templateKey] : null;
    const projectFiles: CanvasFile[] = tpl
      ? tpl.files.map((f, i) => ({
          id: `file-${Date.now()}-${i}`,
          name: f.name,
          language: f.language,
          content: f.content,
        }))
      : DEFAULT_FILES.map((f, i) => ({
          ...f,
          id: `file-${Date.now()}-${i}`,
        }));

    const newProj: CanvasProject = {
      id: `proj-${Date.now()}`,
      name: name.trim() || 'New Project',
      updatedAt: new Date().toISOString(),
      files: projectFiles,
      template: templateKey,
    };

    setProjects((prev) => [...prev, newProj]);
    setActiveProjectId(newProj.id);
    setFiles(projectFiles);
    setActiveFileId(projectFiles[0].id);
    setHistory([{ files: projectFiles, activeFileId: projectFiles[0].id }]);
    setHistoryIndex(0);
  }, []);

  const renameProject = useCallback((newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, name: trimmed, updatedAt: new Date().toISOString() } : p))
    );
  }, [activeProjectId]);

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p.id !== projectId);
      if (activeProjectId === projectId) {
        const nextActive = next[0];
        setActiveProjectId(nextActive.id);
        setFiles(nextActive.files);
        setActiveFileId(nextActive.files[0].id);
        setHistory([{ files: nextActive.files, activeFileId: nextActive.files[0].id }]);
        setHistoryIndex(0);
      }
      return next;
    });
  }, [activeProjectId]);

  const exportProjectZip = useCallback(() => {
    const curProject = projects.find((p) => p.id === activeProjectId);
    const projName = (curProject?.name || 'ayatrisya-project').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const entries = files.map((f) => ({
      path: f.name,
      data: f.content,
    }));
    downloadZip(projName, entries);
  }, [activeProjectId, projects, files]);

  const exportProjectJson = useCallback(() => {
    const curProject = projects.find((p) => p.id === activeProjectId);
    const data = {
      name: curProject?.name || 'Ayatrisya Project',
      exportedAt: new Date().toISOString(),
      files: files.map((f) => ({
        name: f.name,
        language: f.language,
        content: f.content,
      })),
    };
    const jsonStr = JSON.stringify(data, null, 2);
    downloadBlob(new Blob([jsonStr], { type: 'application/json' }), `${(curProject?.name || 'project').toLowerCase().replace(/\s+/g, '-')}.json`);
  }, [activeProjectId, projects, files]);

  const importProject = useCallback((data: { name?: string; files: Array<{ name: string; content: string; language?: string }> }) => {
    if (!data.files || data.files.length === 0) return;
    const formatted: CanvasFile[] = data.files.map((f, i) => ({
      id: `file-${Date.now()}-${i}`,
      name: f.name,
      language: f.language || 'typescript',
      content: f.content,
    }));

    const newProj: CanvasProject = {
      id: `proj-${Date.now()}`,
      name: data.name || 'Imported Project',
      updatedAt: new Date().toISOString(),
      files: formatted,
    };

    setProjects((prev) => [...prev, newProj]);
    setActiveProjectId(newProj.id);
    setFiles(formatted);
    setActiveFileId(formatted[0].id);
    setHistory([{ files: formatted, activeFileId: formatted[0].id }]);
    setHistoryIndex(0);
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const currentProject = projects.find((p) => p.id === activeProjectId);

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
        saveStatus,
        projects,
        activeProjectId,
        currentProjectName: currentProject?.name || 'Workspace Project',
        openCanvas,
        closeCanvas,
        addFile,
        createFolder,
        renameFile,
        duplicateFile,
        removeFile,
        loadProjectFiles,
        setActiveFile,
        updateContent,
        updateLanguage,
        updateFileName,
        stagePatch,
        acceptPatch,
        rejectPatch,
        undo,
        redo,
        switchProject,
        createProject,
        renameProject,
        deleteProject,
        exportProjectZip,
        exportProjectJson,
        importProject,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return ctx;
}

export function useOptionalCanvas() {
  return useContext(CanvasContext);
}
