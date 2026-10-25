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
