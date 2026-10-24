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
  outputLimited?: boolean;
}

export interface DesktopCompanionStatus {
  enabled: boolean;
  port: number;
  allowedOrigin: string;
  sessionLifetimeMinutes: number;
  cancelled?: boolean;
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

export interface DesktopModelRuntime {
  id: "v1-fast" | "v2-best";
  available: boolean;
  reason?: string;
  modalities: string[];
}
export interface DesktopRuntimeInfo {
  bridgeName: "ayatrisya-desktop";
  apiVersion: 1;
  appVersion: string;
  platform: "win32" | "darwin" | "linux";
  capabilities: string[];
  localModel: {
    endpointConfigured: boolean;
    models: DesktopModelRuntime[];
  };
}

export type SeedModelHostState = "STOPPED" | "STARTING" | "READY" | "ERROR";
export interface SeedModelHostStatus {
  state: SeedModelHostState;
  configured: boolean;
  autoStart: boolean;
  checkpointName: string | null;
  model: {
    name: string;
    parameterCount: number | null;
    trainingSteps: number | null;
    device: string;
    readiness: string;
  } | null;
  activeRequests: number;
  message: string;
}
export interface SeedModelGenerationResult {
  requestId: string;
  generatedText: string;
  promptTruncated: boolean;
  modelStatus: "experimental";
}

export type WarModeState = "STARTING" | "READY" | "SCANNING" | "THREAT CONTAINED" | "ATTENTION_REQUIRED" | "OFFLINE" | "ERROR";
export interface WarModeStatus {
  state: WarModeState;
  canScan: boolean;
  engine: string | null;
  signatureVersion: string | null;
  ruleCount: number | null;
  ruleFileCount: number | null;
  signatureUpdatedAt: string | null;
  realTimeProtectionEnabled: boolean;
  message: string;
  defender: {
    state: WarModeState;
    canScan: boolean;
    signatureVersion: string | null;
    signatureUpdatedAt: string | null;
    realTimeProtectionEnabled: boolean;
    message: string;
  };
}
export interface WarModeFolder {
  id: string;
  name: string;
}
export interface WarModeScanResult {
  cancelled: boolean;
  folderName: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  outputLimited?: boolean;
  state?: "READY" | "ATTENTION_REQUIRED";
  message?: string;
}
export interface WarModeYaraFinding {
  id: string;
  scanId: string;
  relativePath: string;
  rules: string[];
  attribution: Array<{ rule: string; authors: string[]; source: string | null }>;
  detectedAt: string;
  reviewRequired: true;
}
export interface WarModeYaraProgress {
  scanId: string;
  completed: number;
  total: number;
  currentPath: string;
  counts: {
    scanned: number;
    detected: number;
    skipped: number;
    inaccessible: number;
    failed: number;
  };
}
export interface WarModeYaraScanResult {
  scanId: string;
  folderName: string;
  startedAt: string;
  finishedAt: string;
  cancelled: boolean;
  limitReached: boolean;
  complete: boolean;
  counts: WarModeYaraProgress['counts'];
  findings: WarModeYaraFinding[];
  findingsTruncated: boolean;
  details: Array<{
    path: string;
    kind: string;
    reason?: string;
    rules?: string[];
    attribution?: Array<{ rule: string; authors: string[]; source: string | null }>;
  }>;
  detailsTruncated: boolean;
  rulesetVersion: string;
  ruleCount: number;
  ruleFileCount: number;
  message: string;
}
export interface WarModeQuarantineItem {
  id: string;
  name: string;
  originalPath: string;
  quarantinedAt: string;
  rules: string[];
  attribution: Array<{ rule: string; authors: string[]; source: string | null }>;
}
export interface WarModeYaraAuditEntry {
  at: string;
  action: string;
  folderName?: string;
  counts?: WarModeYaraProgress['counts'];
  complete?: boolean;
  originalPath?: string;
  id?: string;
  reason?: string;
  rules?: string[];
  findings?: Array<{
    path: string;
    attribution: Array<{ rule: string; authors: string[]; source: string | null }>;
  }>;
  attribution?: Array<{ rule: string; authors: string[]; source: string | null }>;
  fromVersion?: string;
  toVersion?: string;
  ruleCount?: number;
  ruleFileCount?: number;
}
export interface WarModeRuleUpdatePreview {
  available: boolean;
  message?: string;
  proposalId?: string;
  fromVersion?: string;
  toVersion?: string;
  fromRuleCount?: number;
  toRuleCount?: number;
  fromRuleFileCount?: number;
  toRuleFileCount?: number;
  added?: number;
  removed?: number;
  changed?: number;
  commitDate?: string;
}
export interface WarModeAuditEntry {
  at: string;
  folderName: string;
  result: "started" | "completed" | "failed" | "timed-out";
  exitCode: number | null;
}

export interface AyatrisyaDesktopApi {
  readonly isDesktop: true;
  getRuntimeInfo(): Promise<unknown>;
  listProjects(): Promise<DesktopProject[]>;
  chooseProjectFolder(): Promise<DesktopProject | null>;
  removeProjectFolder(projectId: string): Promise<void>;
  listFiles(projectId: string, relativePath: string): Promise<DesktopFile[]>;
  readFile(projectId: string, relativePath: string): Promise<string>;
  createFile(projectId: string, relativePath: string): Promise<void>;
  createFileWithContent(projectId: string, relativePath: string, content: string): Promise<void>;
  writeFile(projectId: string, relativePath: string, content: string): Promise<void>;
  runCommand(projectId: string, command: string, commandId?: string): Promise<DesktopCommandResult>;
  cancelCommand(commandId: string): Promise<void>;
  getLocalCompanionStatus(): Promise<DesktopCompanionStatus>;
  enableLocalCompanion(): Promise<DesktopCompanionStatus>;
  disableLocalCompanion(): Promise<DesktopCompanionStatus>;
  getLocalModelEndpoint(): Promise<string>;
  setLocalModelEndpoint(endpoint: string): Promise<string>;
  requestLocalModel(path: LocalModelPath, method: LocalModelMethod, body: unknown, requestId: string): Promise<LocalModelResponse>;
  cancelLocalModelRequest(requestId: string): Promise<void>;
  getSeedModelHostStatus(): Promise<SeedModelHostStatus>;
  chooseSeedModelCheckpoint(): Promise<SeedModelHostStatus | null>;
  setSeedModelHostAutoStart(enabled: boolean): Promise<SeedModelHostStatus>;
  startSeedModelHost(): Promise<SeedModelHostStatus>;
  stopSeedModelHost(): Promise<SeedModelHostStatus>;
  generateSeedModelText(prompt: string, requestId: string): Promise<SeedModelGenerationResult>;
  cancelSeedModelText(requestId: string): Promise<boolean>;
  getWarModeStatus(): Promise<WarModeStatus>;
  chooseWarModeFolder(): Promise<WarModeFolder | null>;
  scanWarModeFolder(folderId: string): Promise<WarModeScanResult>;
  getWarModeAuditLog(): Promise<WarModeAuditEntry[]>;
  openWindowsSecurity(): Promise<void>;
  scanWarModeYaraFolder(folderId: string): Promise<WarModeYaraScanResult | { cancelled: true; folderName: string }>;
  cancelWarModeYaraScan(scanId: string): Promise<boolean>;
  quarantineWarModeFinding(findingId: string): Promise<{ cancelled: true } | { id: string; originalName: string; quarantinedAt: string }>;
  restoreWarModeQuarantine(itemId: string): Promise<{ cancelled: true } | { id: string; name: string; restoredAt: string }>;
  getWarModeQuarantine(): Promise<WarModeQuarantineItem[]>;
  getWarModeYaraAuditLog(): Promise<WarModeYaraAuditEntry[]>;
  prepareWarModeRuleUpdate(): Promise<WarModeRuleUpdatePreview>;
  applyWarModeRuleUpdate(proposalId: string): Promise<WarModeStatus | { cancelled: true }>;
  onWarModeYaraProgress(callback: (progress: WarModeYaraProgress) => void): () => void;
}

declare global {
  interface Window {
    ayatrisyaDesktop?: AyatrisyaDesktopApi;
  }
}
