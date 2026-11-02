// Google Gemini / Imagen 3 Image Generation Provider (Stage 3)
// Copyright (c) AMETESX. All rights reserved.

import { validateImageBuffer } from "../cloudflare-image";
import type { ImageGenerationResult } from "./ayatrisya-model";

export class GeminiImageProvider {
  static readonly MODEL_ID = "imagen-3.0-generate-002";
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY?.trim() || null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async generate(data: {
    prompt: string;
    aspectRatio?: string;
    format?: "PNG" | "JPEG";
  }): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured on the server.");
    }

    const prompt = data.prompt.trim();
    if (!prompt) {
      throw new Error("Prompt cannot be empty for Gemini image generation.");
    }

    // Map aspect ratios to Imagen supported values: "1:1", "3:4", "4:3", "9:16", "16:9"
    let aspect = "1:1";
    if (data.aspectRatio) {
      const allowed = ["1:1", "3:4", "4:3", "9:16", "16:9"];
      if (allowed.includes(data.aspectRatio)) {
        aspect = data.aspectRatio;
      }
    }

    const outputMimeType = data.format === "PNG" ? "image/png" : "image/jpeg";

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GeminiImageProvider.MODEL_ID}:predict?key=${this.apiKey}`;
    const payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspect,
        outputMimeType,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      
      // Safety block check
      if (/safety|block|prohibited|harm/i.test(errorText)) {
        const safetyErr = new Error(`Gemini Imagen safety refusal: Prompt triggered content safety filters.`);
        (safetyErr as any).isSafetyRefusal = true;
        throw safetyErr;
      }

      if (response.status === 404) {
        throw new Error(
          `Gemini image model (${GeminiImageProvider.MODEL_ID}) is unavailable or not accessible with the current API key/region.`
        );
      }

      throw new Error(`Gemini image generation HTTP ${response.status}: ${errorText.slice(0, 150)}`);
    }

    const json = (await response.json()) as any;

    // Check safety attributes in predictions
    if (json.predictions?.[0]?.safetyAttributes?.blocked) {
      const safetyErr = new Error("Gemini Imagen safety refusal: Generation was blocked by safety filters.");
      (safetyErr as any).isSafetyRefusal = true;
      throw safetyErr;
    }

    const base64Bytes = json.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Bytes || typeof base64Bytes !== "string") {
      throw new Error("Gemini returned invalid or empty image prediction payload.");
    }

    const buf = Buffer.from(base64Bytes, "base64");
    const val = validateImageBuffer(buf);
    if (!val.valid) {
      throw new Error(val.error || "Gemini prediction data could not be validated as an image.");
    }

    return {
      fileName: `gemini-imagen-${Date.now()}${val.ext}`,
      mimeType: val.mimeType!,
      dataBase64: base64Bytes,
      provider: "gemini",
      model: GeminiImageProvider.MODEL_ID,
      stage: 3,
      fallbackUsed: true,
    };
  }
}

