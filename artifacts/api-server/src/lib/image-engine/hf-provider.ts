// Hugging Face Inference API Image Generation Provider (Stage 2)
// Copyright (c) AMETESX. All rights reserved.

import { validateImageBuffer } from "../cloudflare-image";
import type { ImageGenerationResult } from "./ayatrisya-model";

export const HF_SUPPORTED_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "segmind/tiny-sd",
];

export class HfImageProvider {
  private token: string | null = null;

  constructor() {
    this.token = process.env.HF_TOKEN?.trim() || process.env.HF_READ_TOKEN?.trim() || null;
  }

  isConfigured(): boolean {
    return this.token !== null;
  }

  async generate(data: {
    prompt: string;
    negativePrompt?: string;
    format?: "PNG" | "JPEG";
    model?: string;
  }): Promise<ImageGenerationResult> {
    const prompt = data.prompt.trim();
    if (!prompt) {
      throw new Error("Prompt cannot be empty for Hugging Face image generation.");
    }

    const modelsToTry = data.model
      ? [data.model, ...HF_SUPPORTED_MODELS.filter((m) => m !== data.model)]
      : HF_SUPPORTED_MODELS;

    let lastError = "";

    for (const modelId of modelsToTry) {
      try {
        const endpoint = `https://api-inference.huggingface.co/models/${modelId}`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "image/png, image/jpeg, application/json",
        };
        if (this.token) {
          headers["Authorization"] = `Bearer ${this.token}`;
        }

        const bodyPayload: Record<string, any> = { inputs: prompt };
        if (data.negativePrompt) {
          bodyPayload.parameters = { negative_prompt: data.negativePrompt };
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          // Check for safety refusal
          if (/safety|nsfw|prohibited|flagged|harmful/i.test(errorText)) {
            const safetyErr = new Error(`Hugging Face safety refusal: Content policy violation on ${modelId}.`);
            (safetyErr as any).isSafetyRefusal = true;
            throw safetyErr;
          }

          lastError = `HF ${modelId} HTTP ${response.status}: ${errorText.slice(0, 150)}`;
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.startsWith("image/")) {
          const arrayBuf = await response.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const val = validateImageBuffer(buf);
          if (!val.valid) {
            lastError = `HF ${modelId} returned invalid image data: ${val.error}`;
            continue;
          }

          return {
            fileName: `hf-${Date.now()}${val.ext}`,
            mimeType: val.mimeType!,
            dataBase64: buf.toString("base64"),
            provider: "huggingface",
            model: modelId,
            stage: 2,
            fallbackUsed: true,
          };
        }

        // If returned JSON (e.g. estimated time, model loading, error)
        const json = (await response.json().catch(() => ({}))) as any;
        if (json.error) {
          if (/safety|nsfw|harmful/i.test(json.error)) {
            const safetyErr = new Error(`Hugging Face safety refusal: ${json.error}`);
            (safetyErr as any).isSafetyRefusal = true;
            throw safetyErr;
          }
          lastError = `HF ${modelId}: ${json.error}`;
        }
      } catch (err: any) {
        if (err.isSafetyRefusal) throw err;
        lastError = err?.message || String(err);
      }
    }

    throw new Error(`Hugging Face image generation failed: ${lastError || "All candidate endpoints failed."}`);
  }
}
