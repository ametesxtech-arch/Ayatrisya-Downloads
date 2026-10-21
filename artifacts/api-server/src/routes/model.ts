import express, { Router, type IRouter, type Request, type Response } from "express";
import { isIP } from "node:net";
import {
  GetModelCapabilitiesResponse,
  GetModelHealthResponse,
  GenerateModelImageBody,
  GenerateModelImageResponse,
  GenerateModel3dBody,
  GenerateModel3dResponse,
  GenerateModelMusicBody,
  GenerateModelMusicResponse,
  SendModelChatBody,
  SendModelChatResponse,
  SynthesizeModelSpeechBody,
  TranscribeWithModelResponse,
} from "@workspace/api-zod";
import { verifiedFirebaseUid } from "../lib/firebase-auth";
import { consumeModelRequest } from "../lib/model-rate-limit";

const router: IRouter = Router();
const MAX_JSON_RESPONSE_BYTES = 24 * 1024 * 1024;
const MAX_CHAT_RESPONSE_BYTES = 2 * 1024 * 1024;
const MODEL_TIMEOUT_MS = 120_000;
const JSON_RESPONSE_TYPES = new Set(["application/json", "application/x-ndjson", "text/event-stream"]);
const DENIED_HOSTS = /(^|\.)(openai\.com|anthropic\.com|googleapis\.com|groq\.com|openrouter\.ai|huggingface\.co|huggingface\.com)$/i;

type ModelRoute = {
  upstreamPath: string;
  schema?: { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: { message: string } } };
  responseSchema?: { parse: (value: unknown) => unknown };
  responseLimit?: number;
  audioUpload?: boolean;
  allowedTypes?: string[];
};

const messages = {
  missing: "Sign in to Ayatrisya to use hosted models.",
  unavailable: "Firebase authentication is not configured for hosted models.",
  invalid: "Your sign-in session expired. Sign in again to use hosted models.",
};

function getModelConfig(): { baseUrl: URL; apiKey: string } | undefined {
  const rawEndpoint = process.env.AYATRISYA_MODEL_ENDPOINT?.trim();
  const apiKey = process.env.AYATRISYA_MODEL_API_KEY?.trim();
  if (!rawEndpoint || !apiKey) return undefined;
  try {
    const baseUrl = new URL(rawEndpoint);
    if (
      baseUrl.protocol !== "https:" ||
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.search ||
      baseUrl.hash ||
      isIP(baseUrl.hostname) !== 0 ||
      ["localhost", "local", "internal"].some((suffix) =>
        baseUrl.hostname.toLowerCase() === suffix ||
        baseUrl.hostname.toLowerCase().endsWith(`.${suffix}`)) ||
      DENIED_HOSTS.test(baseUrl.hostname)
    ) return undefined;
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
    return { baseUrl, apiKey };
  } catch {
    return undefined;
  }
}

function getModelUrl(baseUrl: URL, upstreamPath: string): URL {
  return new URL(upstreamPath.replace(/^\/+/, ""), baseUrl);
}

function getContentType(response: globalThis.Response, allowed: string[]): string | undefined {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return contentType && allowed.includes(contentType) ? contentType : undefined;
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).set("Cache-Control", "no-store").json({ error: message });
}

function waitForDrainOrClose(res: Response): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      res.off("drain", finish);
      res.off("close", finish);
      resolve();
    };
    res.once("drain", finish);
    res.once("close", finish);
  });
}

function authorizeModelRequest(isGeneration = false) {
  return (req: Request, res: Response, next: (error?: unknown) => void): void => {
    void (async () => {
      const uid = await verifiedFirebaseUid(req, res, messages);
      if (!uid) return;
      const limit = consumeModelRequest(uid, isGeneration);
      if (!limit.allowed) {
        res.set("Retry-After", String(limit.retryAfterSeconds));
        sendError(res, 429, "Ayatrisya model request limit reached. Please wait and try again.");
        return;
      }
      next();
    })().catch(next);
  };
}

async function proxyModelRequest(
  req: Request,
  res: Response,
  route: ModelRoute,
  method: "GET" | "POST",
): Promise<void> {
  const config = getModelConfig();
  if (!config) {
    sendError(res, 503, "The Ayatrisya model endpoint is not configured.");
    return;
  }

  let body: string | Buffer | undefined;
  let contentType = req.get("content-type") ?? "";
  if (method === "POST") {
    if (route.audioUpload) {
      if (!/^multipart\/form-data;\s*boundary=/i.test(contentType) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        sendError(res, 400, "Attach an audio recording to transcribe.");
        return;
      }
      body = req.body;
      if (body.length > 20 * 1024 * 1024) {
        sendError(res, 413, "Audio uploads must be 20 MB or smaller.");
        return;
      }
    } else {
      if (!route.schema) {
        sendError(res, 500, "The model request validator is unavailable.");
        return;
      }
      const parsed = route.schema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, 400, "The model request is invalid.");
        return;
      }
      if (route.upstreamPath === "/chat" &&
          Buffer.byteLength(JSON.stringify(parsed.data)) > 900 * 1024) {
        sendError(res, 413, "Chat requests must be 900 KB or smaller.");
        return;
      }
      if (route.upstreamPath === "/generate/image" &&
          !["PNG", "JPEG"].includes(String((parsed.data as { format?: unknown }).format))) {
        sendError(res, 400, "Image generation supports PNG or JPEG output.");
        return;
      }
      if (route.upstreamPath === "/generate/3d" &&
          (parsed.data as { format?: unknown }).format !== "GLB") {
        sendError(res, 400, "3D generation supports GLB output.");
        return;
      }
      if (route.upstreamPath === "/generate/music" &&
          !["WAV", "MP3"].includes(String((parsed.data as { format?: unknown }).format))) {
        sendError(res, 400, "Music generation supports WAV or MP3 output.");
        return;
      }
      body = JSON.stringify(parsed.data);
      contentType = "application/json";
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Model request timed out.", "TimeoutError")), MODEL_TIMEOUT_MS);
  const abortOnDisconnect = () => {
    if (!res.writableEnded) controller.abort(new DOMException("Client disconnected.", "AbortError"));
  };
  res.once("close", abortOnDisconnect);

  try {
    const upstream = await fetch(getModelUrl(config.baseUrl, route.upstreamPath), {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: req.get("accept") ?? "application/json",
        ...(method === "POST" ? { "Content-Type": contentType } : {}),
      },
      body: Buffer.isBuffer(body)
        ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
        : body,
      redirect: "error",
      signal: controller.signal,
    });

    if (!upstream.ok) {
      req.log.warn({ status: upstream.status, path: route.upstreamPath }, "Ayatrisya model endpoint returned an error");
      await upstream.body?.cancel().catch(() => undefined);
      if (upstream.status === 429) {
        sendError(res, 503, "The Ayatrisya model service is busy. Try again shortly.");
      } else {
        sendError(res, 503, "The Ayatrisya model service is unavailable or rejected the request.");
      }
      return;
    }

    const allowedTypes = route.allowedTypes ?? ["application/json"];
    const responseType = getContentType(upstream, allowedTypes);
    if (!responseType || !upstream.body) {
      req.log.warn({ path: route.upstreamPath, contentType: upstream.headers.get("content-type") }, "Ayatrisya model endpoint returned an unsupported response");
      await upstream.body?.cancel().catch(() => undefined);
      sendError(res, 502, "The Ayatrisya model returned an unsupported response.");
      return;
    }

    const maxBytes = route.responseLimit ?? MAX_JSON_RESPONSE_BYTES;
    const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
    if (declaredLength > maxBytes) {
      await upstream.body.cancel();
      sendError(res, 502, "The Ayatrisya model response exceeded the supported size.");
      return;
    }

    if (route.responseSchema && responseType === "application/json") {
      const reader = upstream.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          sendError(res, 502, "The Ayatrisya model response exceeded the supported size.");
          return;
        }
        chunks.push(value);
      }
      try {
        const parsedResponse = route.responseSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        const serialized = JSON.stringify(parsedResponse);
        if (Buffer.byteLength(serialized) > maxBytes) {
          sendError(res, 502, "The Ayatrisya model response exceeded the supported size.");
          return;
        }
        res.status(200).set({
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        }).send(serialized);
      } catch {
        req.log.warn({ path: route.upstreamPath }, "Ayatrisya model endpoint returned invalid JSON");
        sendError(res, 502, "The Ayatrisya model returned an invalid response.");
      }
      return;
    }

    res.status(200);
    res.set({
      "Content-Type": responseType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const reader = upstream.body.getReader();
    let totalBytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        if (!res.headersSent) sendError(res, 502, "The Ayatrisya model response exceeded the supported size.");
        else res.destroy(new Error("Model response exceeded size limit."));
        return;
      }
      if (!res.write(Buffer.from(value))) {
        await waitForDrainOrClose(res);
        if (res.destroyed) {
          await reader.cancel();
          return;
        }
      }
    }
    res.end();
  } catch (error) {
    if (!res.headersSent && !res.destroyed) {
      const timedOut = controller.signal.aborted && !res.writableEnded;
      req.log.warn({ path: route.upstreamPath, timedOut }, "Ayatrisya model endpoint could not be reached");
      sendError(res, 503, timedOut ? "The Ayatrisya model request timed out." : "The Ayatrisya model service could not be reached.");
    } else if (!res.destroyed) {
      res.destroy(error instanceof Error ? error : undefined);
    }
  } finally {
    clearTimeout(timeout);
    res.off("close", abortOnDisconnect);
  }
}

function jsonRoute(route: ModelRoute) {
  return (req: Request, res: Response): void => {
    void proxyModelRequest(req, res, route, req.method as "GET" | "POST");
  };
}

router.get("/model/health", authorizeModelRequest(), jsonRoute({
  upstreamPath: "/health",
  responseSchema: GetModelHealthResponse,
}));
router.get("/model/capabilities", authorizeModelRequest(), jsonRoute({
  upstreamPath: "/capabilities",
  responseSchema: GetModelCapabilitiesResponse,
}));
router.post("/model/chat", authorizeModelRequest(), jsonRoute({
  upstreamPath: "/chat",
  schema: SendModelChatBody,
  responseSchema: SendModelChatResponse,
  responseLimit: MAX_CHAT_RESPONSE_BYTES,
  allowedTypes: [...JSON_RESPONSE_TYPES],
}));
router.post("/model/generate/image", authorizeModelRequest(true), jsonRoute({
  upstreamPath: "/generate/image",
  schema: GenerateModelImageBody,
  responseSchema: GenerateModelImageResponse,
}));
router.post("/model/generate/3d", authorizeModelRequest(true), jsonRoute({
  upstreamPath: "/generate/3d",
  schema: GenerateModel3dBody,
  responseSchema: GenerateModel3dResponse,
}));
router.post("/model/generate/music", authorizeModelRequest(true), jsonRoute({
  upstreamPath: "/generate/music",
  schema: GenerateModelMusicBody,
  responseSchema: GenerateModelMusicResponse,
}));
router.post("/model/transcribe", authorizeModelRequest(true), express.raw({ type: "multipart/form-data", limit: "20mb" }), jsonRoute({
  upstreamPath: "/transcribe",
  audioUpload: true,
  responseSchema: TranscribeWithModelResponse,
}));
router.post("/model/speech", authorizeModelRequest(true), jsonRoute({
  upstreamPath: "/speech",
  schema: SynthesizeModelSpeechBody,
  responseLimit: 20 * 1024 * 1024,
  allowedTypes: ["audio/wav", "audio/mpeg"],
}));

export default router;
