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

export interface AyatrisyaDesktopApi {
  readonly isDesktop: true;
  listProjects(): Promise<DesktopProject[]>;
  chooseProjectFolder(): Promise<DesktopProject | null>;
  removeProjectFolder(projectId: string): Promise<void>;
  listFiles(projectId: string, relativePath: string): Promise<DesktopFile[]>;
  readFile(projectId: string, relativePath: string): Promise<string>;
  createFile(projectId: string, relativePath: string): Promise<void>;
  writeFile(projectId: string, relativePath: string, content: string): Promise<void>;
  runCommand(projectId: string, command: string): Promise<DesktopCommandResult>;
}

declare global {
  interface Window {
    ayatrisyaDesktop?: AyatrisyaDesktopApi;
  }
}
