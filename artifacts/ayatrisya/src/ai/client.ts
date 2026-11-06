import { z } from "zod";
import { firebaseAuth, firebaseConfigured } from "@/integrations/firebase/client";
import type {
  AssetGenerationKind,
  AssetGenerationOptions,
  ModelCapability,
  ModelMessage,
  ModelTransport,
  GenerationOptions,
  ModelJobRequest,
  ModelJobResult,
  ModelJobStatus,
  ModelJobHandle,
} from "./types";
import type { AyatrisyaDesktopApi } from "@/desktop/contracts";
import { getVerifiedDesktopRuntime, type VerifiedDesktopRuntime } from "@/desktop/runtime";
import { buildApiUrl } from "@/lib/api-config";
import { resolveExecutionRouting, type ExecutionTarget, type ExecutionCapability } from "./execution-policy";

const capabilitySchema = z.object({
  models:z.array(z.object({id:z.enum(["v1-fast","v2-best"]),available:z.boolean(),reason:z.string().nullable().optional(),streaming:z.boolean().default(false),attachments:z.boolean().default(true),modalities:z.array(z.string()).default(["chat"])})),
});
const generatedAssetSchema = z.object({
  fileName: z.string().min(1).max(160),
  mimeType: z.string().min(1).max(100),
  dataBase64: z.string().min(1).max(25_000_000).optional(),
  fileUrl: z.string().url().max(2048).optional(),
  url: z.string().url().max(2048).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  stage: z.number().int().optional(),
  fallbackUsed: z.boolean().optional(),
  version: z.string().optional(),
  stageAudit: z.array(z.any()).optional(),
}).passthrough().refine((data) => Boolean(data.dataBase64 || data.fileUrl || data.url), {
  message: "Either dataBase64 or a valid fileUrl must be provided by the Ayatrisya model.",
});
const labels = {"v1-fast":"V1 Fast","v2-best":"V2 Best Result"} as const;
const localModelPaths = new Set([
  "/health",
  "/capabilities",
  "/chat",
  "/generate/image",
  "/generate/3d",
  "/generate/music",
]);
const MAX_GENERATION_RESPONSE_BYTES = 24 * 1024 * 1024;
type TokenProvider = () => Promise<string>;
type DesktopProvider = () => Promise<VerifiedDesktopRuntime | null>;

async function getFirebaseModelToken(): Promise<string> {
  if (firebaseConfigured) {
    try {
      const user = firebaseAuth().currentUser;
      if (user) {
        return await user.getIdToken();
      }
    } catch {
      // Continue to guest token
    }
  }
  return "guest";
}

async function readJsonBounded(response: Response, maxBytes: number): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (/text\/html/i.test(contentType)) {
    throw new Error("The Ayatrisya model returned an HTML page instead of valid data.");
  }
  if (!response.body) throw new Error("The Ayatrisya model returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("The Ayatrisya model response is larger than the supported limit.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("The Ayatrisya model returned an HTML page instead of JSON.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The Ayatrisya model returned invalid JSON.");
  }
}

const assetSpecs = {
  image: {
    path: "/generate/image",
    types: { PNG: ["image/png", ".png"], JPEG: ["image/jpeg", ".jpg"] },
  },
  "3d": {
    path: "/generate/3d",
    types: { GLB: ["model/gltf-binary", ".glb"] },
  },
  music: {
    path: "/generate/music",
    types: { WAV: ["audio/wav", ".wav"], MP3: ["audio/mpeg", ".mp3"] },
  },
} as const;

async function decodeGeneratedAsset(
  kind: AssetGenerationKind,
  format: AssetGenerationOptions["format"],
  raw: unknown,
): Promise<{
  blob: Blob;
  fileName: string;
  provider?: string;
  model?: string;
  stage?: number;
  fallbackUsed?: boolean;
  version?: string;
  stageAudit?: any[];
}> {
  const asset = generatedAssetSchema.parse(raw);
  const spec = assetSpecs[kind].types[format as keyof typeof assetSpecs[typeof kind]["types"]];
  if (!spec) {
    throw new Error(`The requested format '${format}' is not supported for ${kind} generation.`);
  }
  const allowedMimes = Object.values(assetSpecs[kind].types).map(([m]) => m);
  if (kind === "image") {
    if (!allowedMimes.includes(asset.mimeType.toLowerCase())) {
      throw new Error(`The Ayatrisya model returned an unexpected file type (${asset.mimeType}).`);
    }
  } else if (asset.mimeType.toLowerCase() !== spec[0]) {
    throw new Error(`The Ayatrisya model returned an unexpected file type (${asset.mimeType}, expected ${spec[0]}).`);
  }

  let bytes: Uint8Array;
  if (asset.dataBase64) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.dataBase64)) {
      throw new Error("The Ayatrisya model returned invalid base64 file data.");
    }
    let binary: string;
    try {
      binary = atob(asset.dataBase64);
    } catch {
      throw new Error("The Ayatrisya model returned invalid base64 file data.");
    }
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } else if (asset.fileUrl || asset.url) {
    const downloadUrl = (asset.fileUrl || asset.url)!;
    const fetched = await fetch(downloadUrl);
    if (!fetched.ok) {
      throw new Error(`Failed to download ${kind} asset from model provider URL (HTTP ${fetched.status}).`);
    }
    const arrayBuf = await fetched.arrayBuffer();
    bytes = new Uint8Array(arrayBuf);
  } else {
    throw new Error("The Ayatrisya model returned neither base64 data nor a download URL.");
  }

  if (!bytes.byteLength || bytes.byteLength > 24 * 1024 * 1024) {
    throw new Error("The generated file is empty or exceeds the supported file size limit.");
  }

  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const asciiAt = (offset: number, value: string) => value.split("").every((character, index) => bytes[offset + index] === character.charCodeAt(0));

  const isPng = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const isJpeg = startsWith(0xff, 0xd8, 0xff);
  const isWebp = asciiAt(0, "RIFF") && asciiAt(8, "WEBP");

  if (kind === "image" && !isPng && !isJpeg && !isWebp) {
    throw new Error("The Ayatrisya model returned a file with an invalid signature.");
  }

  if (
    (kind === "music" && format === "WAV" && (!asciiAt(0, "RIFF") || !asciiAt(8, "WAVE"))) ||
    (kind === "music" && format === "MP3" && !(asciiAt(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)))
  ) {
    throw new Error("The Ayatrisya model returned a file with an invalid signature.");
  }

  // Deep validation for 3D GLB models
  if (kind === "3d" && format === "GLB") {
    if (bytes.byteLength < 20) {
      throw new Error("The 3D model data is too short to be a valid glTF 2.0 binary.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546c67) {
      // ASCII 'glTF'
      const textPreview = new TextDecoder().decode(bytes.subarray(0, Math.min(128, bytes.byteLength))).trim();
      if (textPreview.startsWith("<!DOCTYPE") || textPreview.startsWith("<html")) {
        throw new Error("The Ayatrisya model returned an HTML error page instead of a 3D model.");
      }
      if (textPreview.startsWith("{") || textPreview.startsWith("[")) {
        throw new Error("The Ayatrisya model returned a JSON error instead of a 3D model.");
      }
      if (startsWith(0x89, 0x50, 0x4e, 0x47)) {
        throw new Error("The Ayatrisya model returned a PNG image instead of a 3D model.");
      }
      throw new Error("The Ayatrisya model returned a file with an invalid glTF 3D header magic signature.");
    }

    const version = view.getUint32(4, true);
    if (version !== 2) {
      throw new Error(`Unsupported glTF version ${version}. Only glTF 2.0 binary (GLB) is supported.`);
    }

    const totalLength = view.getUint32(8, true);
    if (totalLength !== bytes.byteLength) {
      throw new Error(`The GLB file length header (${totalLength}) does not match the actual data size (${bytes.byteLength}). The 3D model may be truncated.`);
    }

    const chunk0Length = view.getUint32(12, true);
    const chunk0Type = view.getUint32(16, true);
    if (chunk0Type !== 0x4e4f534a) {
      // ASCII 'JSON'
      throw new Error("The first chunk of the GLB file must be a JSON chunk.");
    }
    if (20 + chunk0Length > bytes.byteLength) {
      throw new Error("The GLB JSON chunk header declares a length exceeding the total file size.");
    }

    try {
      const jsonText = new TextDecoder("utf-8").decode(bytes.subarray(20, 20 + chunk0Length));
      const gltf = JSON.parse(jsonText);
      if (!gltf?.asset?.version) {
        throw new Error("The 3D model is missing glTF asset metadata.");
      }
    } catch (cause: any) {
      throw new Error(cause?.message || "The 3D model JSON chunk is malformed.", { cause });
    }
  }

  // Deep validation for Music audio (WAV and MP3)
  if (kind === "music") {
    if (bytes.byteLength < 44) {
      throw new Error("The audio file data is too short to be a valid audio file.");
    }
    if (startsWith(0x89, 0x50, 0x4e, 0x47)) {
      throw new Error("The Ayatrisya model returned a PNG image instead of an audio file.");
    }
    const textPreview = new TextDecoder().decode(bytes.subarray(0, Math.min(128, bytes.byteLength))).trim();
    if (textPreview.startsWith("<!DOCTYPE") || textPreview.startsWith("<html")) {
      throw new Error("The Ayatrisya model returned an HTML error page instead of an audio file.");
    }
    if (textPreview.startsWith("{") || textPreview.startsWith("[")) {
      throw new Error("The Ayatrisya model returned a JSON error instead of an audio file.");
    }

    if (format === "WAV") {
      if (!asciiAt(0, "RIFF") || !asciiAt(8, "WAVE")) {
        throw new Error("The Ayatrisya model returned a file with an invalid WAV signature.");
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const declaredSize = view.getUint32(4, true);
      if (declaredSize + 8 > bytes.byteLength + 4) {
        throw new Error("The WAV audio file is truncated or corrupted.");
      }

      // Check format and data chunks
      let offset = 12;
      let hasData = false;
      let dataLen = 0;
      while (offset + 8 <= bytes.byteLength) {
        const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        const size = view.getUint32(offset + 4, true);
        if (id === "data") {
          hasData = true;
          dataLen = Math.min(size, bytes.byteLength - (offset + 8));
          break;
        }
        offset += 8 + size + (size % 2);
      }
      if (!hasData || dataLen <= 0) {
        throw new Error("The WAV audio file contains zero audio samples or has zero duration.");
      }
    }
  }

  const rawBase = asset.fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const extension = kind === "image" ? (isJpeg ? ".jpg" : isWebp ? ".webp" : ".png") : spec[1];
  const mimeType = kind === "image" ? (isJpeg ? "image/jpeg" : isWebp ? "image/webp" : "image/png") : spec[0];
  return {
    blob: new Blob([bytes as BlobPart], { type: mimeType }),
    fileName: `${rawBase || `ayatrisya-${kind}`}${extension}`,
    provider: asset.provider,
    model: asset.model,
    stage: asset.stage,
    fallbackUsed: asset.fallbackUsed,
    version: asset.version,
    stageAudit: asset.stageAudit,
  };
}
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Model request cancelled.", "AbortError");
}
export class AyatrisyaModelClient implements ModelTransport {
  private generation?:AbortController;
  private localRequestId?:string;
  private localRequestApi?: AyatrisyaDesktopApi;
  private fallbackApprovalHandler?: (context: { requestPath: string; promptPreview: string; error: string }) => Promise<boolean>;
  private readonly jobs = new Map<string, { status: ModelJobStatus; controller: AbortController }>();
  private targetPolicy: ExecutionTarget = "auto";

  constructor(
    private readonly tokenProvider: TokenProvider = getFirebaseModelToken,
    private readonly desktopProvider: DesktopProvider = getVerifiedDesktopRuntime,
  ) {
  }

  public setTargetPolicy(policy: ExecutionTarget): void {
    this.targetPolicy = policy;
  }

  public getTargetPolicy(): ExecutionTarget {
    return this.targetPolicy;
  }

  public setFallbackConsentHandler(handler?: (context: { requestPath: string; promptPreview: string; error: string }) => Promise<boolean>) {
    this.fallbackApprovalHandler = handler;
  }

  private async request(
    path: string,
    init: RequestInit = {},
    signal?: AbortSignal,
    capabilityOverride?: ExecutionCapability,
  ) {
    throwIfAborted(signal);
    const runtime = await this.desktopProvider();
    throwIfAborted(signal);
    const desktop = runtime?.api;

    const capability: ExecutionCapability = capabilityOverride || (
      path === "/chat" ? "chat" :
      path === "/generate/image" ? "image" :
      path === "/generate/3d" ? "3d" :
      path === "/generate/music" ? "music" :
      path === "/transcribe" ? "transcribe" :
      path === "/speech" ? "speech" : "chat"
    );

    // Rule 1: 3D model generation is strictly local desktop-only in every mode
    if (capability === "3d" && this.targetPolicy === "cloud_model") {
      throw new Error("3D model generation is strictly local desktop-only and cannot be executed on cloud providers. Please ensure Ayatrisya Desktop is active.");
    }

    if (this.targetPolicy === "local_desktop" && !desktop) {
      throw new Error("Local desktop execution was selected, but the desktop is offline or unreachable. Cloud fallback is disabled for Local Only requests.");
    }

    // Try desktop if available and not explicitly forced to cloud
    if (desktop && this.targetPolicy !== "cloud_model") {
      const localEndpoint = await desktop.getLocalModelEndpoint();
      if (!localEndpoint) {
        if (this.targetPolicy === "local_desktop") {
          throw new Error("No local model is configured in Ayatrisya Desktop. Add a loopback model in Settings. Prompts are not sent to the cloud.");
        }
        if (capability === "3d") {
          throw new Error("No local model is configured in Ayatrisya Desktop. Add a loopback model in Settings to generate 3D assets.");
        }
      } else {
        if (!localModelPaths.has(path)) {
          throw new Error("This operation is not supported by the desktop local model adapter. It will not be sent to the cloud.");
        }
        if (signal?.aborted) throw new DOMException("Model request cancelled.", "AbortError");
        let body: unknown;
        if (init.body !== undefined) {
          if (typeof init.body !== "string") throw new Error("The local model request format is unsupported.");
          try { body = JSON.parse(init.body); } catch { throw new Error("The local model request is invalid."); }
        }

        let attempt = 0;
        let lastError: unknown;
        while (attempt < 2) {
          attempt++;
          const requestId = crypto.randomUUID();
          this.localRequestId = requestId;
          this.localRequestApi = desktop;
          const cancel = () => { void desktop.cancelLocalModelRequest(requestId).catch(() => undefined); };
          signal?.addEventListener("abort", cancel, { once: true });
          if (signal?.aborted) cancel();
          try {
            const result = await desktop.requestLocalModel(
              path as "/health" | "/capabilities" | "/chat" | "/generate/image" | "/generate/3d" | "/generate/music",
              (init.method ?? "GET").toUpperCase() as "GET" | "POST",
              body,
              requestId,
            );
            const response = new Response(JSON.stringify(result.body), {
              status: result.status,
              headers: { "Content-Type": result.contentType },
            });
            if (!response.ok) throw new Error(`Local model request failed (${response.status}).`);
            return { response, dispose: () => undefined };
          } catch (err: any) {
            lastError = err;
            if (signal?.aborted) throw err;
            if (attempt === 1 && (path === "/chat" || path === "/capabilities") && typeof desktop.startSeedModelHost === "function") {
              try {
                await desktop.startSeedModelHost();
                const healthCheck = await desktop.requestLocalModel("/health", "GET", undefined, crypto.randomUUID());
                if (healthCheck.status === 200) {
                  continue;
                }
              } catch {
                // controlled recovery attempt finished
              }
            }
            break;
          } finally {
            signal?.removeEventListener("abort", cancel);
            if (this.localRequestId === requestId) {
              this.localRequestId = undefined;
              this.localRequestApi = undefined;
            }
          }
        }

        // If local model failed
        if (this.targetPolicy === "local_desktop") {
          throw new Error("Local model is unavailable. Cloud fallback was not permitted because Local Only execution was selected.");
        }

        if (path === "/chat") {
          let promptPreview = "";
          if (body && typeof body === "object" && "messages" in (body as any)) {
            const msgs = (body as any).messages;
            if (Array.isArray(msgs) && msgs.length > 0) {
              promptPreview = String(msgs[msgs.length - 1]?.content || "").slice(0, 80);
            }
          }
          const askUser = this.fallbackApprovalHandler || (async (ctx) => {
            if (typeof window !== "undefined" && typeof window.confirm === "function") {
              return window.confirm(
                `The local AI model is unavailable (${ctx.error}).\n\nSend only this message to the Ayatrisya Cloud Planner Agent fallback?`
              );
            }
            return false;
          });

          const approved = await askUser({
            requestPath: path,
            promptPreview,
            error: lastError instanceof Error ? lastError.message : "Local model failed",
          });

          if (!approved) {
            throw new Error("Local model is unavailable. Cloud fallback was declined.");
          }
        } else {
          throw (lastError instanceof Error ? lastError : new Error("Local model request failed."));
        }
      }
    }

    const token = await this.tokenProvider();
    const controller=new AbortController(); const abort=()=>controller.abort(signal?.reason);
    if(signal?.aborted)abort();else signal?.addEventListener("abort",abort,{once:true});
    const timer=setTimeout(()=>controller.abort(new DOMException("Model request timed out.","TimeoutError")),120000);
    const dispose=()=>{clearTimeout(timer);signal?.removeEventListener("abort",abort);};
    try {
      const headers=new Headers(init.headers);
      headers.set("Authorization",`Bearer ${token}`);
      const url = buildApiUrl(`/api/model${path}`);
      const response=await fetch(url,{...init,headers,signal:controller.signal,credentials:"omit",redirect:"error",referrerPolicy:"no-referrer"});
      const contentType = response.headers.get("content-type") ?? "";
      const isHtml = /text\/html/i.test(contentType);

      if (isHtml) {
        throw new Error(
          response.status === 404
            ? "Ayatrisya model API endpoint was not found (404 HTML). Ensure the API server is running and proxied."
            : response.status === 502 || response.status === 503
              ? "The Ayatrisya model service is temporarily unavailable."
              : "The Ayatrisya API server returned an HTML page instead of JSON. Ensure the backend API server is running and route '/api' is proxied.",
        );
      }

      if(!response.ok) {
        let message="";
        if (/application\/json/i.test(contentType)) {
          try { message=z.object({error:z.string().max(300)}).parse(await response.clone().json()).error; } catch { /* use the safe status message */ }
        }
        throw new Error(message || (response.status===503?"The Ayatrisya model is unavailable. Retry later.":`Ayatrisya model request failed (${response.status}).`));
      }

      const isStreamOrAudio = path.startsWith("/speech") || /application\/x-ndjson|text\/event-stream/i.test(contentType);
      if (!isStreamOrAudio && !/application\/json/i.test(contentType)) {
        throw new Error(`The Ayatrisya model returned an unsupported response format (${contentType || "empty"}).`);
      }

      return {response,dispose};
    } catch(e) {dispose();throw e;}
  }
  async listModels():Promise<ModelCapability[]> {
    return this.getModelCapabilities();
  }
  async getModelStatus(modelId: ModelCapability["id"]):Promise<ModelCapability | null> {
    return (await this.getModelCapabilities()).find((model) => model.id === modelId) ?? null;
  }
  submitJob(request: Extract<ModelJobRequest, { kind: "chat" }>): ModelJobHandle<string>;
  submitJob(request: Extract<ModelJobRequest, { kind: "asset" }>): ModelJobHandle<{ blob: Blob; fileName: string }>;
  submitJob(request: Extract<ModelJobRequest, { kind: "transcribe" }>): ModelJobHandle<string>;
  submitJob(request: Extract<ModelJobRequest, { kind: "speech" }>): ModelJobHandle<Blob>;
  submitJob(request: ModelJobRequest): ModelJobHandle<ModelJobResult> {
    const activeJobs = [...this.jobs.values()].filter(({ status }) => status.state === "running").length;
    if (activeJobs >= 1) throw new Error("Ayatrisya supports one active model request at a time. Wait or cancel the current request first.");
    const id = crypto.randomUUID();
    const controller = new AbortController();
    const status: ModelJobStatus = {
      id,
      kind: request.kind,
      state: "running",
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(id, { status, controller });
    this.pruneJobs();
    const externalSignal = request.options?.signal;
    const abortFromCaller = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromCaller();
    else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const result = this.runJob(request, controller.signal)
      .then((value) => {
        this.finishJob(id, "completed");
        return value;
      })
      .catch((error: unknown) => {
        const cancelled = controller.signal.aborted;
        this.finishJob(id, cancelled ? "cancelled" : "failed");
        throw error;
      })
      .finally(() => externalSignal?.removeEventListener("abort", abortFromCaller));
    return { id, result };
  }
  getJobStatus(jobId: string): ModelJobStatus | null {
    const status = this.jobs.get(jobId)?.status;
    return status ? { ...status } : null;
  }
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status.state !== "running") return false;
    job.controller.abort(new DOMException("Model request cancelled.", "AbortError"));
    return true;
  }
  private async runJob(request: ModelJobRequest, signal: AbortSignal): Promise<ModelJobResult> {
    switch (request.kind) {
      case "chat":
        return this.generateResponse(request.messages, { ...request.options, signal });
      case "asset":
        return this.generateAsset(request.assetKind, request.prompt, { ...request.options, signal });
      case "transcribe":
        return this.transcribeAudio(request.audio, { ...request.options, signal });
      case "speech":
        return this.synthesizeSpeech(request.text, { ...request.options, signal });
    }
  }
  private finishJob(jobId: string, state: ModelJobStatus["state"]): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = {
      ...job.status,
      state,
      finishedAt: new Date().toISOString(),
    };
  }
  private pruneJobs(): void {
    if (this.jobs.size <= 100) return;
    for (const [id, job] of this.jobs) {
      if (job.status.state !== "running") this.jobs.delete(id);
      if (this.jobs.size <= 100) break;
    }
  }
  async getModelCapabilities():Promise<ModelCapability[]> {
    const unavailable=(reason:string):ModelCapability[] => Object.entries(labels).map(([id,label])=>({id:id as ModelCapability["id"],label,available:false,reason,streaming:false,attachments:false,modalities:[]}));
    const runtime = await this.desktopProvider();
    const desktop = runtime?.api;
    if (this.targetPolicy === "local_desktop" && !desktop) {
      return unavailable("Local desktop execution was selected, but the desktop is offline or unreachable.");
    }
    let localEndpoint = "";
    try { localEndpoint = desktop ? await desktop.getLocalModelEndpoint() : ""; }
    catch { return unavailable("The saved desktop model endpoint is invalid. Update it in Ayatrisya Settings."); }
    if (desktop && !localEndpoint) {
      return unavailable("No local model is configured. Desktop prompts stay on this device; hosted inference is not used.");
    }
    try {
      const {response,dispose}=await this.request("/capabilities");
      try {
        const text = await response.text();
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
          throw new Error("The API server returned an HTML page instead of model capabilities.");
        }
        let rawJson: unknown;
        try {
          rawJson = JSON.parse(text);
        } catch {
          throw new Error("The API server returned invalid JSON for model capabilities.");
        }
        const parsed=capabilitySchema.parse(rawJson);
        return Object.entries(labels).map(([id,label])=>{
          const model=parsed.models.find(m=>m.id===id);
          const supportedLocalModalities = ["chat", "image", "3d", "music"];
          return {id:id as ModelCapability["id"],label,available:model?.available??false,reason:model?.reason || (model?.available?"Ready":"Model not ready"),streaming:localEndpoint?false:model?.streaming??false,attachments:localEndpoint?false:(model?.attachments??true),modalities:localEndpoint?(model?.modalities??["chat"]).filter((modality)=>supportedLocalModalities.includes(modality)):model?.modalities??[]};
        });
      } finally {dispose();}
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "Could not verify Ayatrisya model availability.");
    }
  }
  async getConnectionHealth() {
    const runtime = await this.desktopProvider();
    let localEndpoint: string;
    try { localEndpoint = runtime ? await runtime.api.getLocalModelEndpoint() : ""; }
    catch { return {configured:true,connected:false,message:"The saved desktop model endpoint is invalid. Update it in Ayatrisya Settings."}; }
    if (runtime && !localEndpoint) {
      return {configured:false,connected:false,message:"No local model is configured. Desktop prompts are not sent to the cloud."};
    }
    try {
      const {response,dispose}=await this.request("/health");
      let health: unknown;
      try {
        const text = await response.text();
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
          return {configured:true,connected:false,message:"The model service returned an HTML error page."};
        }
        try {
          health = JSON.parse(text);
        } catch {
          return {configured:true,connected:false,message:"The model service returned invalid JSON."};
        }
      } finally {dispose();}
      if (!z.object({status:z.literal("ok")}).safeParse(health).success) {
        return {configured:true,connected:false,message:"Model service returned an invalid health status."};
      }
      const capability = (await this.getModelCapabilities()).find((model) => model.available);
      if (!capability) {
        return {configured:true,connected:false,message:"Health check passed, but no model reports available."};
      }
      const text = await this.generateResponse(
        [{role:"user",content:"Reply with a short greeting to confirm this live inference test."}],
        {model:capability.id,mode:"Normal"},
      );
      if (!text.trim()) return {configured:true,connected:false,message:"The model returned an empty response during the inference test."};
      return {configured:true,connected:true,message:`Live inference succeeded with ${capability.label}.`};
    } catch (error) {
      return {configured:Boolean(localEndpoint)||firebaseConfigured,connected:false,message:error instanceof Error?error.message:"Ayatrisya model endpoint could not be reached"};
    }
  }
  async generateResponse(messages:ModelMessage[],options:GenerationOptions):Promise<string> {
    throwIfAborted(options.signal);
    const capability=(await this.getModelCapabilities()).find(m=>m.id===options.model);
    throwIfAborted(options.signal);
    if(!capability?.available)throw new Error(capability?.reason||"Selected model is unavailable.");
    this.cancelGeneration();this.generation=new AbortController();
    const abort=()=>this.generation?.abort(); options.signal?.addEventListener("abort",abort,{once:true});
    if(options.signal?.aborted)abort();
    try {
      const {response,dispose}=await this.request("/chat",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, application/x-ndjson, text/event-stream"},body:JSON.stringify({messages,model:options.model,mode:options.mode,stream:capability.streaming,attachments:options.attachments})},this.generation.signal,"chat");
      try {
        const type = response.headers.get("content-type") ?? "";
        let finalText = "";
        if(type.includes("application/json")) {
          const body=z.object({text:z.string().max(2000000)}).parse(await response.json());
          finalText = body.text;
        } else {
          if(!response.body || (!type.includes("ndjson")&&!type.includes("event-stream")))throw new Error("Unsupported model response format.");
          const reader=response.body.getReader(),decoder=new TextDecoder();let pending="",output="";
          const parseLine=(line:string)=>{
            if(type.includes("event-stream")) {if(!line.startsWith("data:"))return;line=line.slice(5).trim();}
            if(!line.trim()||line==="[DONE]")return;
            const chunk=z.object({token:z.string().optional(),error:z.string().optional(),done:z.boolean().optional()}).parse(JSON.parse(line));
            if(chunk.error)throw new Error("Model generation failed. Retry the request.");
            if(chunk.token){output+=chunk.token;if(output.length>2000000)throw new Error("Model output exceeded the supported limit.");options.onToken?.(chunk.token);}
          };
          while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split(/\r?\n/);pending=lines.pop()??"";for(const line of lines)parseLine(line);}
          pending+=decoder.decode();if(pending.trim())parseLine(pending);
          finalText = output;
        }

        const trimmed = finalText.trim();
        if(!trimmed) throw new Error("The model returned an empty response. Check model connection and retry.");

        // Guard against degenerate corrupted token output (e.g. undertrained checkpoint gibberish)
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length > 5) {
          // If 75%+ of words are 1-2 char fragments or repetitive nonsensical n-grams
          const shortRatio = words.filter(w => w.length <= 2).length / words.length;
          const isMostlyPunctuationOrNoise = /^[^a-zA-Z0-9\s]{4,}$/.test(trimmed);
          if (shortRatio > 0.85 || isMostlyPunctuationOrNoise) {
            throw new Error("The model produced corrupted or unreadable output. Please check that a compatible model weight is installed and selected.");
          }
        }

        if(type.includes("application/json")) {
          options.onToken?.(finalText);
        }
        return finalText;
      } finally {dispose();}
    } finally {options.signal?.removeEventListener("abort",abort);this.generation=undefined;}
  }
  cancelGeneration(){
    this.generation?.abort();
    if(this.localRequestId && this.localRequestApi) {
      void this.localRequestApi.cancelLocalModelRequest(this.localRequestId).catch(()=>undefined);
    }
  }
  async transcribeAudio(audio:Blob,options:{signal?:AbortSignal}={}):Promise<string>{
    throwIfAborted(options.signal);
    const models=await this.getModelCapabilities();throwIfAborted(options.signal);if(!models.some(m=>m.available&&m.modalities.includes("stt")))throw new Error("Ayatrisya speech-to-text is unavailable.");
    const body=new FormData();body.append("audio",audio,"recording.webm");
    const {response,dispose}=await this.request("/transcribe",{method:"POST",body},options.signal,"transcribe");
    try{return z.object({text:z.string()}).parse(await response.json()).text;}finally{dispose();}
  }
  async synthesizeSpeech(text:string,options:{signal?:AbortSignal}={}):Promise<Blob>{
    throwIfAborted(options.signal);
    const models=await this.getModelCapabilities();throwIfAborted(options.signal);if(!models.some(m=>m.available&&m.modalities.includes("tts")))throw new Error("Ayatrisya text-to-speech is unavailable.");
    const {response,dispose}=await this.request("/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})},options.signal,"speech");
    try{if(!response.headers.get("content-type")?.startsWith("audio/"))throw new Error("Invalid speech audio response.");return await response.blob();}finally{dispose();}
  }
  async generateAsset(kind:AssetGenerationKind,prompt:string,options:AssetGenerationOptions):Promise<{
    blob: Blob;
    fileName: string;
    provider?: string;
    model?: string;
    stage?: number;
    fallbackUsed?: boolean;
    version?: string;
    stageAudit?: any[];
  }> {
    throwIfAborted(options.signal);
    if (kind === "3d" && this.targetPolicy === "cloud_model") {
      throw new Error("3D model generation is strictly local desktop-only and cannot be executed on cloud providers. Please ensure Ayatrisya Desktop is active.");
    }
    const capability=(await this.getModelCapabilities()).find((model)=>model.id===options.model);
    throwIfAborted(options.signal);
    if(!capability?.available||!capability.modalities.includes(kind)) {
      throw new Error(capability?.reason||`The selected Ayatrisya model does not report ${kind} generation.`);
    }
    if(!prompt.trim()||prompt.length>4000)throw new Error("Enter a prompt between 1 and 4,000 characters.");
    const spec = assetSpecs[kind].types[options.format as keyof typeof assetSpecs[typeof kind]["types"]];
    if (!spec) {
      throw new Error(`The requested format '${options.format}' is not supported for ${kind} generation.`);
    }
    const path=assetSpecs[kind].path;
    const body:Record<string,unknown>={prompt:prompt.trim(),model:options.model,format:options.format};
    if(kind==="image") {
      body.aspectRatio = options.aspectRatio || "1:1";
      body.width = options.width || 1024;
      body.height = options.height || 1024;
    }
    if(kind==="music") {
      if(!options.durationSeconds)throw new Error("Music duration is missing.");
      body.durationSeconds=options.durationSeconds;
    }
    const {response,dispose}=await this.request(path,{
      method:"POST",
      headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify(body),
    },options.signal,kind);
    try {
      if(!response.headers.get("content-type")?.toLowerCase().includes("json")) {
        throw new Error("The Ayatrisya generation endpoint must return JSON.");
      }
      return await decodeGeneratedAsset(kind,options.format,await readJsonBounded(response,MAX_GENERATION_RESPONSE_BYTES));
    } finally {dispose();}
  }
}
export const modelClient = new AyatrisyaModelClient();
