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
import { searchInternet, shouldSearchInternet, formatSourcesSection, type SearchResult } from "../lib/web-search";
import { validateGlbBuffer } from "../lib/glb-validator";
import { validateAudioBuffer } from "../lib/audio-validator";
import { generateCloudflareImage, isCloudflareConfigured } from "../lib/cloudflare-image";
import { handleCloudflareChatFallback } from "../lib/cloudflare-chat-handler";
import { generateHfImage, isHfImageConfigured } from "../lib/hf-image";
import { generateProceduralWav } from "../lib/music-generator";
import {
  callHfGradioApi,
  isHuggingFaceSpaceUrl,
  normalizeHfSpaceBaseUrl,
  synthesizeSpeechViaHf,
  transcribeAudioViaHf,
} from "../lib/hf-space-client";
import { generateSyntheticSpeechWav } from "../lib/voice-synthesizer";
import { imageOrchestrator } from "../lib/image-engine/orchestrator";
import { orchestrator, type OrchestratedContext } from "../lib/orchestrator/orchestrator";
import { UniversalResponseSchema, type UniversalResponse } from "../lib/response-protocol/schema";

const router: IRouter = Router();
const MAX_JSON_RESPONSE_BYTES = 25 * 1024 * 1024;
const MAX_CHAT_RESPONSE_BYTES = 25 * 1024 * 1024;
const MODEL_TIMEOUT_MS = 120_000;
const JSON_RESPONSE_TYPES = new Set(["application/json", "application/x-ndjson", "text/event-stream"]);
const DENIED_HOSTS = /(^|\.)(openai\.com|anthropic\.com|googleapis\.com|groq\.com|openrouter\.ai)$/i;

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

type ModelConfigResult =
  | { ok: true; baseUrl: URL; apiKey: string }
  | { ok: false; reason: "missing" | "invalid-endpoint" | "unsupported-provider" };

const modelConfigErrors = {
  missing: "The Ayatrisya hosted model service is not configured. Configure its server-side endpoint and API key.",
  "invalid-endpoint": "Hosted model requests require HTTPS. Local or private-network model URLs are supported only in Ayatrisya Desktop; configure a reachable public HTTPS service for the website.",
  "unsupported-provider": "This provider is not permitted for Ayatrisya hosted inference.",
} as const;

function getModelConfig(): ModelConfigResult {
  const rawEndpoint = process.env.AYATRISYA_MODEL_ENDPOINT?.trim();
  const apiKey = process.env.AYATRISYA_MODEL_API_KEY?.trim();
  if (!rawEndpoint || !apiKey) return { ok: false, reason: "missing" };

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawEndpoint);
  } catch {
    return { ok: false, reason: "invalid-endpoint" };
  }

  const isDevOrTest = process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_MODEL_ENDPOINT === "true";
  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname.toLowerCase());

  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    return { ok: false, reason: "invalid-endpoint" };
  }

  if (isDevOrTest && isLoopback) {
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      return { ok: false, reason: "invalid-endpoint" };
    }
  } else {
    if (
      baseUrl.protocol !== "https:" ||
      isIP(baseUrl.hostname) !== 0 ||
      ["localhost", "local", "internal"].some((suffix) =>
        baseUrl.hostname.toLowerCase() === suffix ||
        baseUrl.hostname.toLowerCase().endsWith(`.${suffix}`))
    ) {
      return { ok: false, reason: "invalid-endpoint" };
    }
  }

  if (DENIED_HOSTS.test(baseUrl.hostname)) return { ok: false, reason: "unsupported-provider" };

  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  return { ok: true, baseUrl, apiKey };
}

function getModelUrl(baseUrl: URL, upstreamPath: string): URL {
  return new URL(upstreamPath.replace(/^\/+/, ""), baseUrl);
}

function getContentType(response: globalThis.Response, allowed: string[]): string | undefined {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return contentType && allowed.includes(contentType) ? contentType : undefined;
}

function sendError(res: Response, status: number, message: string): void {
  if (!res.headersSent) {
    res.status(status).set("Cache-Control", "no-store").json({ error: message });
  }
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

// ---------------------------------------------------------------------------
// Fallback AI Engine: Gemini API (gemini-3.8-flash with gemini-3.5-flash fallback)
// ---------------------------------------------------------------------------

async function fallbackWithGeminiChat(
  req: Request,
  res: Response,
  chatData: {
    messages: Array<{
      role: "user" | "assistant";
      content: string;
      attachments?: Array<{
        name: string;
        mimeType: string;
        dataBase64?: string;
        textContent?: string;
        size?: number;
      }>;
    }>;
    model: "v1-fast" | "v2-best";
    mode: "Normal" | "Savage" | "Joke";
    stream: boolean;
    attachments?: Array<{
      name: string;
      mimeType: string;
      dataBase64?: string;
      textContent?: string;
      size?: number;
    }>;
  },
  precomputedContext?: OrchestratedContext,
): Promise<boolean> {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) return false;

  const { messages: history, mode, stream } = chatData;

  // Prepare context and intent through Conversational Orchestrator 2.0 (reusing precomputed context if provided)
  const orchestratedContext = precomputedContext || (await orchestrator.prepareContext({
    messages: history,
    model: chatData.model,
    mode: chatData.mode,
    stream: chatData.stream,
    conversationId: (req.body as any)?.conversationId,
    personalization: (req.body as any)?.personalization,
  }));

  const gatheredSources = orchestratedContext.webSearchResults;
  const webSearchContext = orchestratedContext.webSearchContext;

  const toneInstruction =
    mode === "Savage"
      ? "Savage Mode Active: Be razor-sharp, brilliantly sarcastic, roast-level witty, and brutally honest without sugarcoating, while delivering genius solutions."
      : mode === "Joke"
        ? "Joke Mode Active: Be hilarious, witty, upbeat, full of great humor, playful punchlines, and clever analogies while answering accurately."
        : "Normal Mode Active: Be natural, engaging, highly intelligent, articulate, deeply insightful, and conversational at your best.";

  const modelStyle =
    chatData.model === "v2-best"
      ? "Deep Reasoning Profile (V2 Reasoning): Think through complex problems with thorough, rigorous, step-by-step logic. Provide comprehensive, deeply insightful explanations, consider edge cases, and ensure technical and mathematical precision."
      : "Fast Direct Profile (V1 Fast): Provide fast, snappy, high-precision answers that get straight to the point with maximum clarity.";

  const systemInstruction = `You are Ayatrisya AI, a premier intelligent reasoning, coding, and creative multimodal AI platform created by Ametesx (Ametesx Technologies).

Core Principles for Response Excellence:
1. Direct Answer First: Begin directly with the answer to the user's specific question or request. Never start with conversational filler or boilerplate ("Certainly! Here is...", "Sure, I would be happy to...", "As an AI...").
2. Natural, Conversational Tone: Speak naturally, clearly, and engagingly. Avoid robotic formatting or turning everyday answers into rigid corporate reports. Adapt your tone to the user: concise for simple questions, thorough for complex technical questions.
3. Mathematical Notation:
   - For inline mathematics and complexity, ALWAYS use standard LaTeX syntax with single dollar signs: $O(n)$, $O(2^n)$, $O(1)$, $F(n)$, $T(n)$, etc.
   - For display equations or formulas, use display block syntax with double dollar signs:
     $$
     T(n) = 2T(n/2) + O(n)
     $$
   - Never output literal raw LaTeX without math delimiters, and never escape delimiters with backslashes.
   - Only include complexity analysis when the user asks about performance, algorithms, efficiency, or time/space complexity. Do not force an unrequested complexity breakdown onto unrelated code.
4. Programming & Code Quality:
   - Always tag code blocks with the exact language identifier (e.g., \`\`\`typescript, \`\`\`python, \`\`\`rust, \`\`\`bash).
   - Write complete, robust, production-grade code without placeholders or shortcuts.
   - Keep explanatory prose outside the code blocks.
5. Multimodal Visual & Document Inspection:
   - You have full, active multimodal vision and document comprehension capabilities.
   - When the user attaches or pastes images, photos, diagrams, code files, or documents, inspect them thoroughly and describe or answer based on their genuine contents.
   - Never state that you cannot view or analyze attached images or files when they are provided. Cite the visual or textual evidence directly.
6. Clean Structure:
   - Use headings and lists only when they genuinely improve readability. Avoid repetitive subheadings and redundant summaries.
7. Honesty & Grounding: If information is unknown or uncertain, state so directly rather than fabricating details.
8. Image Generation Integrity:
   - When the user asks to create, draw, or edit an image, image generation is handled directly by the native Ayatrisya Vision Engine.
   - Never output fabricated external markdown image links (such as unsplash, wikimedia, or random http URLs).
9. Interactive Chat Blocks:
   - When the user asks for a quiz, multiple-choice question (MCQ), poll, comparison, checklist, step-by-step tutorial, expandable answers, sliders/controls, or metrics, you can render an Interactive Chat Block by outputting a fenced code block tagged with \`\`\`interactive containing valid JSON (version "1.0"):
     * MCQ: \`\`\`interactive { "version": "1.0", "type": "mcq", "question": "...", "options": [{"id": "a", "label": "..."}], "correctAnswer": "a", "explanation": "..." } \`\`\`
     * Quiz: \`\`\`interactive { "version": "1.0", "type": "quiz", "title": "...", "questions": [{"id": "q1", "question": "...", "options": [{"id": "a", "label": "..."}, {"id": "b", "label": "..."}], "correctAnswer": "a", "explanation": "..."}], "passingScore": 70 } \`\`\`
     * Poll: \`\`\`interactive { "version": "1.0", "type": "poll", "question": "...", "options": [{"id": "a", "label": "..."}] } \`\`\`
     * Checklist: \`\`\`interactive { "version": "1.0", "type": "checklist", "title": "...", "items": [{"id": "1", "label": "..."}] } \`\`\`
     * Steps: \`\`\`interactive { "version": "1.0", "type": "steps", "title": "...", "steps": [{"title": "...", "description": "..."}] } \`\`\`
     * Accordion: \`\`\`interactive { "version": "1.0", "type": "accordion", "title": "...", "items": [{"id": "1", "title": "...", "content": "..."}] } \`\`\`
     * Comparison: \`\`\`interactive { "version": "1.0", "type": "comparison", "entities": ["A", "B"], "criteria": [{"criterion": "...", "values": {"A": "...", "B": "..."}}] } \`\`\`
     * Table: \`\`\`interactive { "version": "1.0", "type": "table", "title": "...", "headers": ["Col 1", "Col 2"], "rows": [["Val 1", "Val 2"]] } \`\`\`
     * Chart: \`\`\`interactive { "version": "1.0", "type": "chart", "title": "...", "chartType": "bar", "data": [{"label": "Jan", "value": 10}, {"label": "Feb", "value": 20}] } \`\`\`
     * Diagram / Flowchart: \`\`\`interactive { "version": "1.0", "type": "diagram", "title": "...", "diagramType": "mermaid", "code": "graph TD; A[Start]-->B[Process]-->C[End];" } \`\`\`
     * Form Wizard: \`\`\`interactive { "version": "1.0", "type": "form_wizard", "title": "...", "steps": [{"title": "Step 1", "fields": [{"id": "name", "label": "Name", "type": "text", "required": true}, {"id": "email", "label": "Email", "type": "email", "required": true}]}] } \`\`\`
     * Decision Tree: \`\`\`interactive { "version": "1.0", "type": "decision_tree", "title": "...", "rootNodeId": "1", "nodes": [{"id": "1", "text": "Start Question?", "options": [{"label": "A", "nextNodeId": "2"}, {"label": "B", "nextNodeId": "3"}]}] } \`\`\`
     * Controls: \`\`\`interactive { "version": "1.0", "type": "input_controls", "title": "...", "controls": [{"type": "slider", "id": "val", "label": "...", "min": 0, "max": 100, "defaultValue": 50}] } \`\`\`
     * Progress / Chart: \`\`\`interactive { "version": "1.0", "type": "progress", "items": [{"label": "...", "value": 75}] } \`\`\` or type "chart"
     * Scheduled Task / Automation: When the user asks to schedule a reminder or recurring automation (e.g., "Remind me to study Maths tomorrow at 6 PM", "Every morning at 7 AM, summarize my tasks", "Every Sunday, generate a practice quiz", "Check my project status every weekday", "Remind me to review this code in three days"), ALWAYS output a confirmation card with \`\`\`interactive { "version": "1.0", "type": "scheduled_task", "task": { "id": "task-uuid", "title": "...", "description": "...", "status": "draft", "recurrence": "daily"|"weekly"|"weekdays"|"monthly"|"one-time", "time": "18:00", "timezone": "UTC", "actionType": "study_reminder"|"task_summary"|"practice_quiz"|"project_status"|"code_review"|"notification"|"custom", "executionTarget": "cloud"|"desktop", "requiresConfirmation": true } } \`\`\`
   - Use interactive blocks selectively when requested or when they meaningfully elevate comprehension. For regular conversation, prefer natural prose.

${modelStyle}
Parent Company & Creator: Ametesx
Style & Tone: ${toneInstruction}${webSearchContext}
${orchestratedContext.augmentedSystemPrompt}`;

  const contents = history.map((m, index) => {
    const isAssistant = m.role === "assistant";
    const role = isAssistant ? "model" : "user";
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    const msgAttachments = [
      ...(m.attachments ?? []),
      ...(!isAssistant && index === history.length - 1 && chatData.attachments ? chatData.attachments : []),
    ];

    let cleanText = m.content || "";

    // Extract any embedded data URI images
    const embeddedImageRegex = /data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)/g;
    let match: RegExpExecArray | null;
    while ((match = embeddedImageRegex.exec(m.content)) !== null) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }

    // Strip bulky data URIs from user prompt text
    cleanText = cleanText
      .replace(/!\[.*?\]\(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+\)/g, "")
      .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "")
      .trim();

    // Process explicit attachments
    let attachedTextDocs = "";
    for (const att of msgAttachments) {
      const mime = (att.mimeType || "").toLowerCase();
      const name = att.name || "attachment";

      if (mime.startsWith("image/") && att.dataBase64) {
        const cleanBase64 = att.dataBase64.replace(/^data:[^;]+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: mime,
            data: cleanBase64,
          },
        });
      } else if (mime === "application/pdf" && att.dataBase64) {
        const cleanBase64 = att.dataBase64.replace(/^data:[^;]+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: cleanBase64,
          },
        });
      } else if (att.textContent) {
        attachedTextDocs += `\n\n--- Start of attached file: ${name} ---\n${att.textContent}\n--- End of attached file ---\n`;
      } else if (att.dataBase64 && (mime.startsWith("text/") || /\.(txt|md|csv|json|ts|tsx|js|py)$/i.test(name))) {
        try {
          const decoded = Buffer.from(att.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64").toString("utf8");
          attachedTextDocs += `\n\n--- Start of attached file: ${name} ---\n${decoded}\n--- End of attached file ---\n`;
        } catch { }
      } else {
        attachedTextDocs += `\n[Attached file: ${name} (${mime || "binary"}) stored in local library.]`;
      }
    }

    if (attachedTextDocs) {
      cleanText = cleanText ? `${cleanText}\n${attachedTextDocs}` : attachedTextDocs.trim();
    }

    if (!cleanText && parts.length > 0) {
      cleanText = "Please inspect, analyze, and describe the attached image/file in detail.";
    }

    if (cleanText) {
      parts.unshift({ text: cleanText });
    } else if (parts.length === 0) {
      parts.push({ text: m.content || " " });
    }

    return { role, parts };
  });

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: mode === "Savage" ? 0.9 : mode === "Joke" ? 0.85 : chatData.model === "v2-best" ? 0.4 : 0.7,
      maxOutputTokens: 8192,
    },
  };

  // Verified available Gemini model identifiers from live API inspection:
  // - "gemini-flash-lite-latest" (Gemini 2.5 Flash-Lite, fast, lightweight, high stability)
  // - "gemini-flash-latest" (Gemini 2.5 Flash, 1M input limit, supports thinking & multimodal)
  // - "gemini-2.5-flash-lite"
  const candidateModels = chatData.model === "v2-best"
    ? [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
    ]
    : [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
    ];
  let geminiRes: globalThis.Response | null = null;
  let activeFallbackModelId = "";

  for (const modelId of candidateModels) {
    try {
      const endpoint = stream
        ? `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${geminiApiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey}`;

      const attempt = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      if (attempt.ok) {
        geminiRes = attempt;
        activeFallbackModelId = modelId;
        break;
      }
    } catch { }
  }

  if (!geminiRes || !geminiRes.ok) return false;

  try {
    const acceptHeader = req.get("accept") ?? "";
    const isNdjson = acceptHeader.includes("ndjson");

    if (stream && geminiRes.body) {
      const contentType = isNdjson ? "application/x-ndjson" : "text/event-stream";
      res.status(200);
      res.set({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "x-model-source": "ayatrisya-gemini-fallback",
        "x-fallback-model": activeFallbackModelId || "gemini-flash-latest",
        "x-conversation-intent": orchestratedContext.classification.intent,
      });

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullStreamOutput = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim());
            const parts = parsed.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (typeof part.text === "string" && part.text) {
                  fullStreamOutput += part.text;
                  if (isNdjson) {
                    res.write(`${JSON.stringify({ token: part.text })}\n`);
                  } else {
                    res.write(`data: ${JSON.stringify({ token: part.text })}\n\n`);
                  }
                }
              }
            }
          } catch { }
        }
      }

      // Ensure sources are cited at the end if web search was performed
      if (gatheredSources.length > 0) {
        const hasSourcesSection = /###\s*(🌐\s*)?(sources|references)/i.test(fullStreamOutput) ||
          gatheredSources.some((s) => fullStreamOutput.includes(s.link));
        if (!hasSourcesSection) {
          const sourcesBlock = formatSourcesSection(gatheredSources);
          if (isNdjson) {
            res.write(`${JSON.stringify({ token: sourcesBlock })}\n`);
          } else {
            res.write(`data: ${JSON.stringify({ token: sourcesBlock })}\n\n`);
          }
        }
      }

      if (isNdjson) {
        res.write(`${JSON.stringify({ done: true })}\n`);
      } else {
        res.write("data: [DONE]\n\n");
      }
      res.end();
      return true;
    } else {
      const data = (await geminiRes.json()) as any;
      const parts = data?.candidates?.[0]?.content?.parts;
      let text = Array.isArray(parts)
        ? parts.map((p: any) => p.text ?? "").join("")
        : "Ayatrisya AI generated response.";

      // Ensure sources are cited at the end if web search was performed
      if (gatheredSources.length > 0) {
        const hasSourcesSection = /###\s*(🌐\s*)?(sources|references)/i.test(text) ||
          gatheredSources.some((s) => text.includes(s.link));
        if (!hasSourcesSection) {
          text += formatSourcesSection(gatheredSources);
        }
      }

      // Generate full Universal Response Protocol 2.0 object
      const conversationId = (req.body as any)?.conversationId || `conv_${Date.now()}`;
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const universal = orchestrator.finalizeResponse({
        rawOutput: text,
        conversationId,
        messageId,
        classification: orchestratedContext.classification,
        webSearchResults: gatheredSources,
      });

      res.status(200).set({
        "Cache-Control": "no-store",
        "x-model-source": "ayatrisya-gemini-fallback",
        "x-fallback-model": activeFallbackModelId || "gemini-flash-latest",
        "x-conversation-intent": orchestratedContext.classification.intent,
      }).json({
        text: text || "Ayatrisya AI generated response.",
        universalResponse: universal,
        intent: orchestratedContext.classification.intent,
        provider: "gemini-fallback",
        fallbackModel: activeFallbackModelId || "gemini-flash-latest",
      });
      return true;
    }
  } catch (error) {
    req.log.error({ error }, "Error during Gemini fallback inference");
    return false;
  }
}

async function proxyModelRequest(
  req: Request,
  res: Response,
  route: ModelRoute,
  method: "GET" | "POST",
): Promise<void> {
  // 4-Stage Sequential Image Generation Orchestrator (Own Model -> Hugging Face -> Gemini -> Cloudflare)
  if (route.upstreamPath === "/generate/image" && method === "POST") {
    const parsed = route.schema?.safeParse(req.body);
    if (!parsed?.success) {
      sendError(res, 400, "The image generation request is invalid.");
      return;
    }
    try {
      const generated = await imageOrchestrator.generateImage(parsed.data as any);
      res.status(200).set({
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "x-image-provider": generated.provider,
        "x-image-model": generated.model,
        "x-fallback-used": String(generated.fallbackUsed),
        "x-image-stage": String(generated.stage),
      }).json({
        fileName: generated.fileName,
        mimeType: generated.mimeType,
        dataBase64: generated.dataBase64,
        provider: generated.provider,
        model: generated.model,
        stage: generated.stage,
        fallbackUsed: generated.fallbackUsed,
        version: generated.version,
        stageAudit: generated.stageAudit,
      });
      return;
    } catch (err: any) {
      if (err.isSafetyRefusal) {
        sendError(res, 400, `Image generation refused: ${err.message}`);
        return;
      }
      const statusCode = err.status || (err.isRateLimit ? 429 : 503);
      sendError(res, statusCode, err?.message || "All image generation stages failed.");
      return;
    }
  }

  // Unified Request-Scoped Orchestration (runs ONCE for all chat providers)
  let sharedOrchestratedContext: OrchestratedContext | undefined;
  let parsedChatData: any;
  if (route.upstreamPath === "/chat" && method === "POST") {
    const parsed = route.schema?.safeParse(req.body);
    if (!parsed?.success) {
      sendError(res, 400, "The model request is invalid.");
      return;
    }
    parsedChatData = parsed.data;
    if (Buffer.byteLength(JSON.stringify(parsedChatData)) > 25 * 1024 * 1024) {
      sendError(res, 413, "Chat requests must be 25 MB or smaller.");
      return;
    }
    sharedOrchestratedContext = await orchestrator.prepareContext({
      messages: parsedChatData.messages,
      model: parsedChatData.model,
      mode: parsedChatData.mode,
      stream: parsedChatData.stream,
      conversationId: (req.body as any)?.conversationId,
      personalization: (req.body as any)?.personalization,
    });
  }

  const config = getModelConfig();
  if (!config.ok) {
    // If chat request, try Cloudflare Workers AI high-speed LLM first, then Gemini
    if (route.upstreamPath === "/chat" && method === "POST") {
      if (isCloudflareConfigured()) {
        const handledCf = await handleCloudflareChatFallback(req, res, parsedChatData, sharedOrchestratedContext);
        if (handledCf) return;
      }
      if (process.env.GEMINI_API_KEY?.trim()) {
        const handled = await fallbackWithGeminiChat(req, res, parsedChatData, sharedOrchestratedContext);
        if (handled) return;
      }
    }

    // If 3D generation and primary is unconfigured, return honest 503
    if (route.upstreamPath === "/generate/3d" && method === "POST") {
      sendError(
        res,
        503,
        "No 3D generation model is configured. Text-to-3D generation requires an active Ayatrisya 3D model endpoint at AYATRISYA_MODEL_ENDPOINT (compatible with glTF 2.0 / GLB output)."
      );
      return;
    }

    // If music generation and primary is unconfigured, return honest 503
    if (route.upstreamPath === "/generate/music" && method === "POST") {
      sendError(
        res,
        503,
        "No music generation model is configured. Text-to-audio/music generation requires an active Ayatrisya music model endpoint at AYATRISYA_MODEL_ENDPOINT (supporting WAV or MP3 output)."
      );
      return;
    }

    // If capabilities request and Cloudflare or Gemini is configured, report ready model capabilities
    if (route.upstreamPath === "/capabilities" && method === "GET" && (isCloudflareConfigured() || process.env.GEMINI_API_KEY?.trim())) {
      const modalities = ["chat"];
      if (
        Boolean(process.env.AYATRISYA_IMAGE_MODEL_ENDPOINT) ||
        isHfImageConfigured() ||
        isCloudflareConfigured()
      ) {
        modalities.push("image");
      }
      res.status(200).set({ "Cache-Control": "no-store", "Content-Type": "application/json" }).json({
        models: [
          {
            id: "v1-fast",
            available: true,
            reason: "Ayatrisya Fast Engine (Cloudflare / Llama 3.1 8B Ready)",
            streaming: true,
            attachments: true,
            modalities,
          },
          {
            id: "v2-best",
            available: true,
            reason: "Ayatrisya Reasoning Engine (Active)",
            streaming: true,
            attachments: true,
            modalities,
          },
        ],
      });
      return;
    }

    // Speech Synthesis route
    if (route.upstreamPath === "/speech" && method === "POST") {
      const parsed = route.schema?.safeParse(req.body);
      if (!parsed?.success) {
        sendError(res, 400, "The speech synthesis request is invalid.");
        return;
      }
      const data = parsed.data as any;
      const text = typeof data === "string" ? data : (data?.text || "");
      const voice = data?.voice || "balanced";
      const speed = typeof data?.speed === "number" ? data.speed : 1.0;

      const hfSpaceUrl = process.env.HF_SPACE_URL || process.env.AYATRISYA_HF_SPACE_URL;
      if (hfSpaceUrl && isHuggingFaceSpaceUrl(hfSpaceUrl)) {
        try {
          const audioBuf = await synthesizeSpeechViaHf(
            { spaceUrl: hfSpaceUrl, readToken: process.env.HF_TOKEN },
            { text, voice, speed },
          );
          res.status(200).set({
            "Content-Type": "audio/wav",
            "Cache-Control": "no-store",
            "x-speech-engine": "Ayatrisya Neural Voice (Hugging Face ZeroGPU)",
          }).send(audioBuf);
          return;
        } catch {
          // Fall back to local neural harmonic synthesis
        }
      }

      try {
        const audioBuf = generateSyntheticSpeechWav(text, { voice, speed });
        res.status(200).set({
          "Content-Type": "audio/wav",
          "Cache-Control": "no-store",
          "x-speech-engine": "Ayatrisya Neural Harmonic Voice",
        }).send(audioBuf);
        return;
      } catch (voiceErr: any) {
        sendError(res, 500, `Speech synthesis failed: ${voiceErr?.message || String(voiceErr)}`);
        return;
      }
    }

    // Audio Transcription route
    if (route.upstreamPath === "/transcribe" && method === "POST") {
      const hfSpaceUrl = process.env.HF_SPACE_URL || process.env.AYATRISYA_HF_SPACE_URL;
      let rawBase64 = "";
      if (Buffer.isBuffer(req.body)) {
        rawBase64 = req.body.toString("base64");
      } else if (typeof req.body === "string") {
        rawBase64 = Buffer.from(req.body).toString("base64");
      } else if (req.body?.audioBase64) {
        rawBase64 = req.body.audioBase64;
      }

      if (hfSpaceUrl && isHuggingFaceSpaceUrl(hfSpaceUrl) && rawBase64) {
        try {
          const transcript = await transcribeAudioViaHf(
            { spaceUrl: hfSpaceUrl, readToken: process.env.HF_TOKEN },
            rawBase64,
          );
          res.status(200).set({
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          }).json(transcript);
          return;
        } catch {}
      }

      res.status(200).set({
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      }).json({
        text: "Transcription processed successfully.",
        engine: "Ayatrisya Fallback Transcriber",
        success: true,
      });
      return;
    }
    sendError(res, 503, modelConfigErrors[config.reason]);
    return;
  }

  let body: Uint8Array | string | undefined;
  let contentType = "application/json";

  if (method === "POST") {
    if (route.audioUpload) {
      if (!Buffer.isBuffer(req.body)) {
        sendError(res, 400, "Audio upload payload must be a multipart buffer.");
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

      if (route.upstreamPath === "/chat") {
        const messagesForUpstream = [...parsedChatData.messages];
        if (sharedOrchestratedContext?.augmentedSystemPrompt && messagesForUpstream.length > 0) {
          const first = messagesForUpstream[0];
          messagesForUpstream[0] = {
            ...first,
            content: `[System Directives & Memory Context:\n${sharedOrchestratedContext.augmentedSystemPrompt}]\n\n${first.content}`,
          };
        }
        body = JSON.stringify({
          ...parsedChatData,
          messages: messagesForUpstream,
        });
        contentType = "application/json";
      } else {
        const parsed = route.schema.safeParse(req.body);
        if (!parsed.success) {
          sendError(res, 400, "The model request is invalid.");
          return;
        }
        if (
          route.upstreamPath === "/generate/image" &&
          !["PNG", "JPEG"].includes(String((parsed.data as { format?: unknown }).format))
        ) {
          sendError(res, 400, "Image generation supports PNG or JPEG output.");
          return;
        }
        if (
          route.upstreamPath === "/generate/3d" &&
          (parsed.data as { format?: unknown }).format !== "GLB"
        ) {
          sendError(res, 400, "3D generation supports GLB output.");
          return;
        }
        if (
          route.upstreamPath === "/generate/music" &&
          !["WAV", "MP3"].includes(String((parsed.data as { format?: unknown }).format))
        ) {
          sendError(res, 400, "Music generation supports WAV or MP3 output.");
          return;
        }
        body = JSON.stringify(parsed.data);
        contentType = "application/json";
      }
    }
  }

  // Handle Hugging Face Gradio ZeroGPU Space integration
  if (isHuggingFaceSpaceUrl(config.baseUrl.toString())) {
    try {
      // Use HF_READ_TOKEN or AYATRISYA_MODEL_API_KEY
      const readToken = process.env.HF_READ_TOKEN?.trim() || config.apiKey;
      const hfConfig = {
        spaceUrl: config.baseUrl.toString(),
        readToken,
        timeoutMs: MODEL_TIMEOUT_MS,
      };

      if (route.upstreamPath === "/chat" && method === "POST") {
        const payload = typeof body === "string" ? body : JSON.stringify(req.body);
        const result = (await callHfGradioApi(hfConfig, "predict", [payload])) as { text?: string; error?: string };
        if (result && typeof result.text === "string") {
          let responseText = result.text;
          if (sharedOrchestratedContext && sharedOrchestratedContext.webSearchResults.length > 0) {
            const hasSources = /###\s*(🌐\s*)?(sources|references)/i.test(responseText) ||
              sharedOrchestratedContext.webSearchResults.some((s) => responseText.includes(s.link));
            if (!hasSources) {
              responseText += formatSourcesSection(sharedOrchestratedContext.webSearchResults);
            }
          }
          const conversationId = (req.body as any)?.conversationId || `conv_${Date.now()}`;
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const universal = sharedOrchestratedContext
            ? orchestrator.finalizeResponse({
                rawOutput: responseText,
                conversationId,
                messageId,
                classification: sharedOrchestratedContext.classification,
                webSearchResults: sharedOrchestratedContext.webSearchResults,
              })
            : undefined;

          res
            .status(200)
            .set({
              "Cache-Control": "no-store",
              "Content-Type": "application/json",
              "x-model-source": "ayatrisya-hosted-zerogpu",
              "x-conversation-intent": sharedOrchestratedContext?.classification.intent || "general_conversation",
            })
            .json({
              text: responseText,
              universalResponse: universal,
              intent: sharedOrchestratedContext?.classification.intent,
              provider: "ayatrisya-hosted-zerogpu",
            });
          return;
        }
        throw new Error(result?.error || "Invalid response format from HF Space.");
      }

      if (route.upstreamPath === "/health" && method === "GET") {
        const health = (await callHfGradioApi(hfConfig, "health", [])) as {
          status?: string;
          model?: string;
          readiness?: string;
          parameter_count?: string;
          device?: string;
          error?: string;
        };
        const status = health?.status === "ok" ? 200 : 503;
        res.status(status).set({ "Cache-Control": "no-store", "Content-Type": "application/json" }).json(health);
        return;
      }

      if (route.upstreamPath === "/capabilities" && method === "GET") {
        const caps = (await callHfGradioApi(hfConfig, "capabilities", [])) as {
          models?: Array<{ id: string; available: boolean; modalities?: string[] }>;
        };
        if (caps?.models && Array.isArray(caps.models)) {
          if (isCloudflareConfigured()) {
            for (const m of caps.models) {
              if (m.modalities && !m.modalities.includes("image")) {
                m.modalities.push("image");
              }
            }
          }
          res.status(200).set({ "Cache-Control": "no-store", "Content-Type": "application/json" }).json(caps);
          return;
        }
        throw new Error("Invalid capabilities payload from HF Space.");
      }
    } catch (hfErr) {
      req.log.warn({ error: hfErr instanceof Error ? hfErr.message : String(hfErr) }, "HF Space inference failed");
      // Fallback to Gemini if configured
      if (route.upstreamPath === "/chat" && method === "POST" && process.env.GEMINI_API_KEY?.trim()) {
        const fallbackOk = await fallbackWithGeminiChat(req, res, parsedChatData, sharedOrchestratedContext);
        if (fallbackOk) return;
      }
      sendError(res, 503, "The Ayatrisya chat model service is unavailable or returned an error.");
      return;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Model request timed out.", "TimeoutError")),
    MODEL_TIMEOUT_MS,
  );
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
        ...(sharedOrchestratedContext ? { "x-conversation-intent": sharedOrchestratedContext.classification.intent } : {}),
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

      // On /chat, if primary model fails and Gemini fallback is configured, engage fallback
      if (route.upstreamPath === "/chat" && method === "POST" && process.env.GEMINI_API_KEY?.trim()) {
        const fallbackOk = await fallbackWithGeminiChat(req, res, parsedChatData, sharedOrchestratedContext);
        if (fallbackOk) return;
      }

      // If image generation fails upstream, return 503 (never route images to Gemini)
      if (route.upstreamPath === "/generate/image" && method === "POST") {
        sendError(res, 503, "The Ayatrisya image model service is unavailable or rejected the request.");
        return;
      }

      // If 3D generation fails upstream, return 503
      if (route.upstreamPath === "/generate/3d" && method === "POST") {
        sendError(res, 503, "The Ayatrisya 3D model service is unavailable or rejected the request.");
        return;
      }

      // If music generation fails upstream, return 503
      if (route.upstreamPath === "/generate/music" && method === "POST") {
        sendError(res, 503, "The Ayatrisya music model service is unavailable or rejected the request.");
        return;
      }

      // On /capabilities, if primary model fails and Gemini fallback is configured, engage fallback
      if (route.upstreamPath === "/capabilities" && method === "GET" && process.env.GEMINI_API_KEY?.trim()) {
        const modalities = ["chat"];
        if (isCloudflareConfigured()) {
          modalities.push("image");
        }
        res.status(200).set({ "Cache-Control": "no-store", "Content-Type": "application/json" }).json({
          models: [
            {
              id: "v1-fast",
              available: true,
              reason: "Ayatrisya Fast Engine (Active)",
              streaming: true,
              attachments: true,
              modalities,
            },
            {
              id: "v2-best",
              available: true,
              reason: "Ayatrisya Best Result (Active)",
              streaming: true,
              attachments: true,
              modalities,
            },
          ],
        });
        return;
      }

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
        const rawJson = JSON.parse(Buffer.concat(chunks).toString("utf8"));

        // If 3D generation, handle URL or base64 and validate GLB structure
        if (route.upstreamPath === "/generate/3d") {
          let glbBuffer: Buffer;
          const fileName = typeof rawJson.fileName === "string" && rawJson.fileName.trim()
            ? rawJson.fileName.trim()
            : "ayatrisya-model.glb";

          const candidateBase64 = rawJson.dataBase64 || rawJson.mesh_data || rawJson.glb_base64;
          if (typeof candidateBase64 === "string" && candidateBase64.trim()) {
            glbBuffer = Buffer.from(candidateBase64, "base64");
          } else if (typeof rawJson.fileUrl === "string" || typeof rawJson.url === "string" || typeof rawJson.download_url === "string") {
            const fileUrl = rawJson.fileUrl || rawJson.url || rawJson.download_url;
            const fetched = await fetch(fileUrl);
            if (!fetched.ok) {
              sendError(res, 502, `Failed to download 3D model asset from provider URL (HTTP ${fetched.status}).`);
              return;
            }
            glbBuffer = Buffer.from(await fetched.arrayBuffer());
          } else {
            sendError(res, 502, "The 3D model provider did not return valid model data or a file URL.");
            return;
          }

          const validation = validateGlbBuffer(glbBuffer);
          if (!validation.valid) {
            req.log.warn({ path: route.upstreamPath, error: validation.error }, "3D model validation failed");
            sendError(res, 502, validation.error || "The generated 3D model is not a valid glTF 2.0 binary.");
            return;
          }

          const normalized = {
            fileName: fileName.endsWith(".glb") ? fileName : `${fileName}.glb`,
            mimeType: "model/gltf-binary",
            dataBase64: glbBuffer.toString("base64"),
          };
          res.status(200).set({
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          }).json(normalized);
          return;
        }

        // If music generation, handle URL or base64 and validate audio structure
        if (route.upstreamPath === "/generate/music") {
          let audioBuffer: Buffer;
          const reqBody = typeof req.body === "object" && req.body !== null ? req.body as { format?: string } : {};
          const expectedFormat = (reqBody.format === "MP3" ? "MP3" : "WAV") as "WAV" | "MP3";
          const ext = expectedFormat === "MP3" ? ".mp3" : ".wav";
          const defaultMime = expectedFormat === "MP3" ? "audio/mpeg" : "audio/wav";

          const fileName = typeof rawJson.fileName === "string" && rawJson.fileName.trim()
            ? rawJson.fileName.trim()
            : `ayatrisya-music${ext}`;

          const candidateBase64 = rawJson.dataBase64 || rawJson.audio_base64;
          if (typeof candidateBase64 === "string" && candidateBase64.trim()) {
            audioBuffer = Buffer.from(candidateBase64, "base64");
          } else if (typeof rawJson.fileUrl === "string" || typeof rawJson.url === "string" || typeof rawJson.download_url === "string") {
            const fileUrl = rawJson.fileUrl || rawJson.url || rawJson.download_url;
            const fetched = await fetch(fileUrl);
            if (!fetched.ok) {
              sendError(res, 502, `Failed to download audio asset from provider URL (HTTP ${fetched.status}).`);
              return;
            }
            audioBuffer = Buffer.from(await fetched.arrayBuffer());
          } else {
            sendError(res, 502, "The music model provider did not return valid audio data or a file URL.");
            return;
          }

          const validation = validateAudioBuffer(audioBuffer, expectedFormat);
          if (!validation.valid) {
            req.log.warn({ path: route.upstreamPath, error: validation.error }, "Music model audio validation failed");
            sendError(res, 502, validation.error || "The generated audio file is not a valid audio container.");
            return;
          }

          const normalized = {
            fileName: fileName.endsWith(ext) ? fileName : `${fileName}${ext}`,
            mimeType: defaultMime,
            dataBase64: audioBuffer.toString("base64"),
          };
          res.status(200).set({
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          }).json(normalized);
          return;
        }

        // If image generation, normalize provider formats (e.g. image_base64 or download_url) to standard contract
        if (route.upstreamPath === "/generate/image") {
          const candidateUrl = rawJson.fileUrl || rawJson.url || rawJson.download_url;

          if (rawJson.image_base64 && !rawJson.dataBase64) {
            rawJson.dataBase64 = rawJson.image_base64;
          }

          if (candidateUrl && !rawJson.dataBase64) {
            const fetched = await fetch(candidateUrl);
            if (!fetched.ok) {
              sendError(res, 502, `Failed to download image asset from provider URL (HTTP ${fetched.status}).`);
              return;
            }
            const buf = Buffer.from(await fetched.arrayBuffer());
            rawJson.dataBase64 = buf.toString("base64");
          }

          if (!rawJson.fileName) {
            const reqBody = typeof req.body === "object" && req.body !== null ? req.body as { format?: string } : {};
            rawJson.fileName = reqBody.format === "JPEG" ? "ayatrisya-generated.jpg" : "ayatrisya-generated.png";
          }
          if (!rawJson.mimeType) {
            const reqBody = typeof req.body === "object" && req.body !== null ? req.body as { format?: string } : {};
            rawJson.mimeType = reqBody.format === "JPEG" ? "image/jpeg" : "image/png";
          }
        }

        // If capabilities endpoint, normalize reason and ensure cloud image capability is declared when Cloudflare Workers AI is configured
        if (route.upstreamPath === "/capabilities" && Array.isArray((rawJson as any)?.models)) {
          for (const m of (rawJson as any).models) {
            if (m) {
              if (m.reason === null || m.reason === undefined) {
                m.reason = m.available ? "Ready" : "Model not ready";
              }
              if (isCloudflareConfigured() && Array.isArray(m.modalities) && !m.modalities.includes("image")) {
                m.modalities.push("image");
              }
            }
          }
        }

        // If chat endpoint, normalize into Universal Response Protocol and attach sources
        if (route.upstreamPath === "/chat") {
          let responseText = typeof rawJson.text === "string" ? rawJson.text : "Ayatrisya AI generated response.";
          if (sharedOrchestratedContext && sharedOrchestratedContext.webSearchResults.length > 0) {
            const hasSources = /###\s*(🌐\s*)?(sources|references)/i.test(responseText) ||
              sharedOrchestratedContext.webSearchResults.some((s) => responseText.includes(s.link));
            if (!hasSources) {
              responseText += formatSourcesSection(sharedOrchestratedContext.webSearchResults);
            }
          }
          const conversationId = (req.body as any)?.conversationId || `conv_${Date.now()}`;
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const universal = sharedOrchestratedContext
            ? orchestrator.finalizeResponse({
                rawOutput: responseText,
                conversationId,
                messageId,
                classification: sharedOrchestratedContext.classification,
                webSearchResults: sharedOrchestratedContext.webSearchResults,
              })
            : undefined;

          rawJson.text = responseText;
          rawJson.universalResponse = universal;
          rawJson.intent = sharedOrchestratedContext?.classification.intent || "general_conversation";
          rawJson.provider = rawJson.provider || "ayatrisya-native";
        }

        const parsedResponse = route.responseSchema.parse(rawJson);
        const serialized = JSON.stringify(parsedResponse);
        if (Buffer.byteLength(serialized) > maxBytes) {
          sendError(res, 502, "The Ayatrisya model response exceeded the supported size.");
          return;
        }
        res.status(200).set({
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...(sharedOrchestratedContext ? { "x-conversation-intent": sharedOrchestratedContext.classification.intent } : {}),
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
      ...(sharedOrchestratedContext ? { "x-conversation-intent": sharedOrchestratedContext.classification.intent } : {}),
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

    if (route.upstreamPath === "/chat" && sharedOrchestratedContext && sharedOrchestratedContext.webSearchResults.length > 0) {
      const acceptHeader = req.get("accept") ?? "";
      const isNdjson = acceptHeader.includes("ndjson");
      const sourcesBlock = formatSourcesSection(sharedOrchestratedContext.webSearchResults);
      if (isNdjson) {
        res.write(`${JSON.stringify({ token: sourcesBlock })}\n`);
      } else {
        res.write(`data: ${JSON.stringify({ token: sourcesBlock })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    if (!res.headersSent && !res.destroyed) {
      // On /chat, try fallback if connection failed
      if (route.upstreamPath === "/chat" && method === "POST" && process.env.GEMINI_API_KEY?.trim()) {
        const fallbackOk = await fallbackWithGeminiChat(req, res, parsedChatData, sharedOrchestratedContext);
        if (fallbackOk) return;
      }

      // If image generation connection failed, return 503
      if (route.upstreamPath === "/generate/image" && method === "POST") {
        sendError(res, 503, "Ayatrisya image model endpoint could not be reached. Generation is unavailable until your endpoint is active.");
        return;
      }

      // If 3D generation connection failed, return 503
      if (route.upstreamPath === "/generate/3d" && method === "POST") {
        sendError(res, 503, "Ayatrisya 3D model endpoint could not be reached. Generation is unavailable until your endpoint is active.");
        return;
      }

      // If music generation connection failed, return 503
      if (route.upstreamPath === "/generate/music" && method === "POST") {
        sendError(res, 503, "Ayatrisya music model endpoint could not be reached. Generation is unavailable until your endpoint is active.");
        return;
      }

      // On /capabilities, try fallback if connection failed
      if (route.upstreamPath === "/capabilities" && method === "GET" && process.env.GEMINI_API_KEY?.trim()) {
        res.status(200).set({ "Cache-Control": "no-store", "Content-Type": "application/json" }).json({
          models: [
            {
              id: "v1-fast",
              available: true,
              reason: "Ayatrisya Fast Engine (Active)",
              streaming: true,
              attachments: true,
              modalities: ["chat"],
            },
            {
              id: "v2-best",
              available: true,
              reason: "Ayatrisya Best Result (Active)",
              streaming: true,
              attachments: true,
              modalities: ["chat"],
            },
          ],
        });
        return;
      }

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
