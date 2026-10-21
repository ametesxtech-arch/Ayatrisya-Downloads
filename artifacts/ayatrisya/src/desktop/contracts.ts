export interface DesktopProject {
  id: string;
  name: string;
  path: string;
  available: boolean;
}

export interface DesktopFile {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
}

export interface DesktopCommandResult {
  cancelled: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type LocalModelPath =
  | "/health"
  | "/capabilities"
  | "/chat"
  | "/generate/image"
  | "/generate/3d"
  | "/generate/music";
export type LocalModelMethod = "GET" | "POST";
export interface LocalModelResponse {
  status: number;
  contentType: string;
  body: unknown;
}

export interface AyatrisyaDesktopApi {
  readonly isDesktop: true;
  listProjects(): Promise<DesktopProject[]>;
  chooseProjectFolder(): Promise<DesktopProject | null>;
  removeProjectFolder(projectId: string): Promise<void>;
  listFiles(projectId: string, relativePath: string): Promise<DesktopFile[]>;
  readFile(projectId: string, relativePath: string): Promise<string>;
  createFile(projectId: string, relativePath: string): Promise<void>;
  createFileWithContent(projectId: string, relativePath: string, content: string): Promise<void>;
  writeFile(projectId: string, relativePath: string, content: string): Promise<void>;
  runCommand(projectId: string, command: string): Promise<DesktopCommandResult>;
  getLocalModelEndpoint(): Promise<string>;
  setLocalModelEndpoint(endpoint: string): Promise<string>;
  requestLocalModel(path: LocalModelPath, method: LocalModelMethod, body: unknown, requestId: string): Promise<LocalModelResponse>;
  cancelLocalModelRequest(requestId: string): Promise<void>;
}

declare global {
  interface Window {
    ayatrisyaDesktop?: AyatrisyaDesktopApi;
  }
}
