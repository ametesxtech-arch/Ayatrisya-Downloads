// Hugging Face Space Gradio Client Adapter for Ayatrisya AI
// Space: grpAX/ayatrisya-chat-model-server
// Parent Company: Ametesx

export interface HfSpaceConfig {
  spaceUrl: string;
  readToken?: string;
  timeoutMs?: number;
}

export interface HfPredictionResult {
  text: string;
}

export interface HfHealthResult {
  status: "ok" | "not_ready";
  model?: string;
  readiness?: string;
  parameter_count?: string;
  device?: string;
  error?: string;
  modalities?: string[];
}

export interface HfCapabilitiesResult {
  models: Array<{
    id: "v1-fast" | "v2-best";
    available: boolean;
    reason?: string;
    streaming?: boolean;
    attachments?: boolean;
    modalities?: string[];
  }>;
}

/**
 * In-memory TTL cache for discovered model capabilities.
 * Prevents repeated redundant network requests and cold-start hammering.
 */
interface CachedEntry {
  data: HfCapabilitiesResult;
  expiresAt: number;
}
const capabilitiesCache = new Map<string, CachedEntry>();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedCapabilities(cacheKey: string): HfCapabilitiesResult | null {
  const entry = capabilitiesCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    capabilitiesCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

export function setCachedCapabilities(
  cacheKey: string,
  data: HfCapabilitiesResult,
  ttlMs = DEFAULT_CACHE_TTL_MS
): void {
  capabilitiesCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCapabilitiesCache(): void {
  capabilitiesCache.clear();
}

/**
 * Normalizes Space URL into direct .hf.space host or standard base.
 * e.g., "https://huggingface.co/spaces/grpAX/ayatrisya-chat-model-server" -> "https://grpax-ayatrisya-chat-model-server.hf.space"
 * or "https://grpax-ayatrisya-chat-model-server.hf.space" -> kept as is.
 */
export function normalizeHfSpaceBaseUrl(rawUrl: string): string {
  let urlStr = rawUrl.trim().replace(/\/+$/, "");
  const spaceMatch = urlStr.match(/^https?:\/\/huggingface\.co\/spaces\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/i);
  if (spaceMatch) {
    const user = spaceMatch[1].toLowerCase().replace(/_/g, "-");
    const spaceName = spaceMatch[2].toLowerCase().replace(/_/g, "-");
    return `https://${user}-${spaceName}.hf.space`;
  }
  return urlStr;
}

export function isHuggingFaceSpaceUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host.endsWith(".hf.space") || host === "huggingface.co" || host.includes("hf.space");
  } catch {
    return false;
  }
}

export interface DirectRestResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  isNotFound?: boolean;
  isUnauthorized?: boolean;
  isRateLimited?: boolean;
}

/**
 * Attempts a direct REST call to the upstream Space.
 * Used for genuine REST endpoints mounted at root (/health, /capabilities, /chat).
 */
export async function callHfDirectRestApi<T = unknown>(
  config: HfSpaceConfig,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<DirectRestResult<T>> {
  const baseUrl = normalizeHfSpaceBaseUrl(config.spaceUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const targetUrl = `${baseUrl}${cleanPath}`;
  const timeoutMs = config.timeoutMs ?? 30_000;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (config.readToken) {
    headers["Authorization"] = `Bearer ${config.readToken.trim()}`;
  }
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: method === "POST" && body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 404) {
      return { ok: false, status: 404, isNotFound: true, error: "Endpoint not found (HTTP 404)" };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, isUnauthorized: true, error: "Authentication failed (HTTP 401/403)" };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, isRateLimited: true, error: "Upstream rate limit exceeded (HTTP 429)" };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: `Upstream error ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a Gradio /gradio_api/call/<apiName> flow using standard SSE.
 */
export async function callHfGradioApi(
  config: HfSpaceConfig,
  apiName: "predict" | "health" | "capabilities" | "synthesize_speech" | "transcribe_audio",
  dataArray: unknown[] = [],
): Promise<unknown> {
  const baseUrl = normalizeHfSpaceBaseUrl(config.spaceUrl);
  const timeoutMs = config.timeoutMs ?? 60_000;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.readToken) {
    headers["Authorization"] = `Bearer ${config.readToken.trim()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Hugging Face Space request timed out.")), timeoutMs);

  try {
    // Step 1: POST to initialize job and obtain event_id
    const postRes = await fetch(`${baseUrl}/gradio_api/call/${apiName}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: dataArray }),
      signal: controller.signal,
    });

    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => "");
      const error: any = new Error(`HF Space returned status ${postRes.status}: ${errText.slice(0, 200)}`);
      error.status = postRes.status;
      throw error;
    }

    const postJson = (await postRes.json()) as { event_id?: string };
    const eventId = postJson?.event_id;
    if (!eventId) {
      throw new Error("Did not receive a valid event_id from Gradio API.");
    }

    // Step 2: GET event stream to retrieve completion
    const streamRes = await fetch(`${baseUrl}/gradio_api/call/${apiName}/${eventId}`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...(config.readToken ? { Authorization: `Bearer ${config.readToken.trim()}` } : {}),
      },
      signal: controller.signal,
    });

    if (!streamRes.ok) {
      const streamErr = await streamRes.text().catch(() => "");
      const error: any = new Error(`HF Space stream returned status ${streamRes.status}: ${streamErr.slice(0, 200)}`);
      error.status = streamRes.status;
      throw error;
    }

    // Parse SSE lines
    const text = await streamRes.text();
    const lines = text.split(/\r?\n/);
    let currentEvent = "";
    let completedData: string | null = null;
    let errorMessage: string | null = null;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        const payload = line.slice("data:".length).trim();
        if (currentEvent === "complete") {
          completedData = payload;
        } else if (currentEvent === "error") {
          errorMessage = payload;
        }
      }
    }

    if (errorMessage) {
      throw new Error(`HF Space error event: ${errorMessage}`);
    }

    if (!completedData) {
      throw new Error("HF Space stream completed without emitting a complete event.");
    }

    // Gradio returns array of outputs: [result1, result2, ...]
    const parsedOutputs = JSON.parse(completedData);
    const primaryOutput = Array.isArray(parsedOutputs) ? parsedOutputs[0] : parsedOutputs;

    // In our Space, primaryOutput is a JSON-encoded string
    if (typeof primaryOutput === "string") {
      try {
        return JSON.parse(primaryOutput);
      } catch {
        return primaryOutput;
      }
    }
    return primaryOutput;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resilient capabilities discovery:
 * 1. Checks memory cache.
 * 2. Attempts direct REST GET /capabilities.
 * 3. If direct 404, attempts Gradio SSE /gradio_api/call/capabilities.
 * 4. If capabilities not implemented, falls back to genuine GET /health and derives verified capabilities.
 */
export async function discoverHfCapabilities(config: HfSpaceConfig): Promise<HfCapabilitiesResult> {
  const cacheKey = normalizeHfSpaceBaseUrl(config.spaceUrl);
  const cached = getCachedCapabilities(cacheKey);
  if (cached) return cached;

  // Path 1: Direct REST /capabilities
  const direct = await callHfDirectRestApi<HfCapabilitiesResult>(config, "/capabilities", "GET");
  if (direct.ok && direct.data?.models && Array.isArray(direct.data.models)) {
    setCachedCapabilities(cacheKey, direct.data);
    return direct.data;
  }

  // Path 2: Gradio SSE /gradio_api/call/capabilities
  try {
    const gradioCaps = (await callHfGradioApi(config, "capabilities", [])) as HfCapabilitiesResult;
    if (gradioCaps?.models && Array.isArray(gradioCaps.models)) {
      setCachedCapabilities(cacheKey, gradioCaps);
      return gradioCaps;
    }
  } catch (err: any) {
    if (err?.status && err.status !== 404) {
      // If error is 401, 403, or 429, re-throw with status
      throw err;
    }
  }

  // Path 3: Health check discovery fallback
  let health: HfHealthResult | null = null;
  const directHealth = await callHfDirectRestApi<HfHealthResult>(config, "/health", "GET");
  if (directHealth.ok && directHealth.data) {
    health = directHealth.data;
  } else {
    try {
      health = (await callHfGradioApi(config, "health", [])) as HfHealthResult;
    } catch {}
  }

  if (health) {
    const isReady = health.status === "ok";
    const activeModel = health.model || "Ayatrisya ZeroGPU Engine";
    const modalities = Array.isArray(health.modalities) && health.modalities.length > 0
      ? health.modalities
      : ["chat", "coding", "planning", "speech", "transcribe"];

    const discoveredCaps: HfCapabilitiesResult = {
      models: [
        {
          id: "v1-fast",
          available: isReady,
          reason: isReady
            ? `Ready on Ayatrisya Engine (${activeModel})`
            : (health.error || "Model initializing warm-up test"),
          streaming: false,
          attachments: true,
          modalities,
        },
        {
          id: "v2-best",
          available: isReady,
          reason: isReady
            ? "Ready on Ayatrisya Engine (Deep Reasoning & Coding)"
            : (health.error || "Model initializing warm-up test"),
          streaming: false,
          attachments: true,
          modalities,
        },
      ],
    };
    setCachedCapabilities(cacheKey, discoveredCaps);
    return discoveredCaps;
  }

  throw new Error("Unable to discover capabilities: Upstream model service did not respond to /capabilities or /health.");
}

export interface HfSpeechSynthesisPayload {
  text: string;
  voice?: "balanced" | "female" | "male";
  speed?: number;
}

export interface HfSpeechSynthesisResult {
  mimeType: string;
  dataBase64: string;
  sampleRate: number;
  bytes: number;
}

export async function synthesizeSpeechViaHf(
  config: HfSpaceConfig,
  payload: HfSpeechSynthesisPayload,
): Promise<Buffer> {
  const res = (await callHfGradioApi(config, "synthesize_speech", [JSON.stringify(payload)])) as any;
  if (!res || !res.dataBase64) {
    throw new Error("Invalid speech synthesis response from Hugging Face Space.");
  }
  return Buffer.from(res.dataBase64, "base64");
}

export interface HfTranscriptionResult {
  text: string;
  engine?: string;
  success: boolean;
}

export async function transcribeAudioViaHf(
  config: HfSpaceConfig,
  audioBase64: string,
): Promise<HfTranscriptionResult> {
  const res = (await callHfGradioApi(config, "transcribe_audio", [JSON.stringify({ audioBase64 })])) as any;
  if (!res || typeof res.text !== "string") {
    throw new Error("Invalid transcription response from Hugging Face Space.");
  }
  return res as HfTranscriptionResult;
}
