import type { ChatMode, ModelId } from "@/storage/types";
export interface ModelCapability {
  id:ModelId; label:string; available:boolean; reason:string;
  streaming:boolean; attachments:boolean; modalities:string[];
}
export interface MessageAttachment {
  name: string;
  mimeType: string;
  dataBase64?: string;
  textContent?: string;
  size?: number;
}
export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
}
export interface GenerationOptions {
  model: ModelId;
  mode: ChatMode;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  attachments?: MessageAttachment[];
}
export type AssetGenerationKind = "image" | "3d" | "music";
export interface AssetGenerationOptions {
  model: ModelId;
  format: "PNG" | "JPEG" | "GLB" | "WAV" | "MP3";
  aspectRatio?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  signal?: AbortSignal;
}
export type ModelJobRequest =
  | { kind: "chat"; messages: ModelMessage[]; options: GenerationOptions }
  | { kind: "asset"; assetKind: AssetGenerationKind; prompt: string; options: AssetGenerationOptions }
  | { kind: "transcribe"; audio: Blob; options?: { signal?: AbortSignal } }
  | { kind: "speech"; text: string; options?: { signal?: AbortSignal } };
export type ModelJobResult =
  | string
  | {
      blob: Blob;
      fileName: string;
      provider?: string;
      model?: string;
      stage?: number;
      fallbackUsed?: boolean;
      version?: string;
      stageAudit?: any[];
    }
  | Blob;
export interface ModelJobHandle<T extends ModelJobResult = ModelJobResult> {
  id: string;
  result: Promise<T>;
}
export interface ModelJobStatus {
  id: string;
  kind: ModelJobRequest["kind"];
  state: "running" | "completed" | "cancelled" | "failed";
  startedAt: string;
  finishedAt?: string;
  error?: string;
}
export interface ModelTransport {
  listModels():Promise<ModelCapability[]>;
  getModelStatus(modelId:ModelId):Promise<ModelCapability | null>;
  getModelCapabilities():Promise<ModelCapability[]>;
  getConnectionHealth():Promise<{configured:boolean;connected:boolean;message:string}>;
  submitJob(request: Extract<ModelJobRequest, { kind: "chat" }>): ModelJobHandle<string>;
  submitJob(request: Extract<ModelJobRequest, { kind: "asset" }>): ModelJobHandle<{ blob: Blob; fileName: string }>;
  submitJob(request: Extract<ModelJobRequest, { kind: "transcribe" }>): ModelJobHandle<string>;
  submitJob(request: Extract<ModelJobRequest, { kind: "speech" }>): ModelJobHandle<Blob>;
  getJobStatus(jobId:string):ModelJobStatus | null;
  cancelJob(jobId:string):boolean;
  generateResponse(messages:ModelMessage[],options:GenerationOptions):Promise<string>;
  cancelGeneration():void;
  transcribeAudio(audio:Blob,options?:{signal?:AbortSignal}):Promise<string>;
  synthesizeSpeech(text:string,options?:{signal?:AbortSignal}):Promise<Blob>;
  generateAsset(kind: AssetGenerationKind, prompt: string, options: AssetGenerationOptions): Promise<{ blob: Blob; fileName: string }>;
}
