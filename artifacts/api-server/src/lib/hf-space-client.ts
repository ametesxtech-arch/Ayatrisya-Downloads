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
    return host.endsWith(".hf.space") || host === "huggingface.co";
  } catch {
    return false;
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
      throw new Error(`HF Space returned status ${postRes.status}: ${errText.slice(0, 200)}`);
    }

    const postJson = (await postRes.json()) as { event_id?: string };
    const eventId = postJson?.event_id;
    if (!eventId) {
      throw new Error("Did not receive a valid event_id from Gradio API.");
    }

    // Step 2: GET SSE stream to retrieve the completed result
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
      throw new Error(`HF Space stream returned status ${streamRes.status}: ${streamErr.slice(0, 200)}`);
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
