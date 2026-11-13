export interface CanvasFile {
  id: string;
  name: string;
  language: string;
  content: string;
  modified?: boolean;
}

export interface CanvasHistoryEntry {
  files: CanvasFile[];
  activeFileId: string;
}

export interface CanvasDiff {
  path: string;
  original: string;
  proposed: string;
}

export interface CanvasExecutionResult {
  output: string;
  error?: string;
  status: 'idle' | 'running' | 'success' | 'error';
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  theme: 'obsidian' | 'midnight' | 'matrix';
}

export interface EditorProblem {
  id: string;
  fileId: string;
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export interface CanvasProject {
  id: string;
  name: string;
  description?: string;
  template?: string;
  updatedAt: string;
  files: CanvasFile[];
}
