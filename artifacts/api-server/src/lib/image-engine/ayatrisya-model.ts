// Ayatrisya Proprietary Image Generation Model Specification & Inference Adapter
// Identity: Ayatrisya-Diffusion-v1 (Ametesx Architecture)
// Copyright (c) AMETESX. All rights reserved.

import { validateImageBuffer } from "../cloudflare-image";

export interface AyatrisyaImageConfig {
  prompt: string;
  negativePrompt?: string;
  format?: "PNG" | "JPEG";
  aspectRatio?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
}

export interface ImageGenerationResult {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  provider: "ayatrisya-own-model" | "huggingface" | "gemini" | "cloudflare";
  model: string;
  stage: 1 | 2 | 3 | 4;
  fallbackUsed: boolean;
  version?: string;
}

export class AyatrisyaImageModel {
  static readonly MODEL_ID = "Ayatrisya-Diffusion-v1";
  static readonly VERSION = "1.0.0-preview";
  static readonly ARCHITECTURE = "Latent Diffusion Transformer (DiT) / U-Net Foundation with Ametesx Conditioning Adapter";
  static readonly LICENSE = "Proprietary Ametesx Adapter Weights / OpenRAIL-M Foundation Base";

  getEndpoint(): string | null {
    return (
      process.env.AYATRISYA_IMAGE_MODEL_ENDPOINT?.trim() ||
      process.env.AYATRISYA_MODEL_ENDPOINT?.trim() ||
      null
    );
  }

  getApiKey(): string | null {
    return process.env.AYATRISYA_MODEL_API_KEY?.trim() || null;
  }

  /**
   * Health and readiness inspection.
   * Reports honestly whether dedicated Ayatrisya GPU inference workers are reachable.
   */
  async checkHealth(): Promise<{ operational: boolean; reason: string }> {
    const endpoint = this.getEndpoint();
    const apiKey = this.getApiKey();

    if (!endpoint || !apiKey) {
      return {
        operational: false,
        reason: "Ayatrisya proprietary weights and GPU inference instance are currently offline. Awaiting dedicated Ametesx self-hosted GPU runner (AYATRISYA_IMAGE_MODEL_ENDPOINT).",
      };
    }

    try {
      const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
      const url = new URL("health", base).toString();
      const res = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return {
          operational: false,
          reason: `Ayatrisya image endpoint health check returned status ${res.status}.`,
        };
      }

      return { operational: true, reason: "Ayatrisya proprietary image model active." };
    } catch (err: any) {
      return {
        operational: false,
        reason: `Ayatrisya proprietary image endpoint unreachable: ${err?.message || String(err)}`,
      };
    }
  }

  /**
   * Generates an image using the proprietary Ayatrisya model endpoint.
   */
  async generate(config: AyatrisyaImageConfig): Promise<ImageGenerationResult> {
    const endpoint = this.getEndpoint();
    const apiKey = this.getApiKey();

    if (!endpoint || !apiKey) {
      throw new Error(
        "Ayatrisya proprietary weights and GPU inference instance are currently offline. Awaiting dedicated Ametesx self-hosted GPU runner."
      );
    }

    const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
    const targetUrl = new URL("generate/image", base).toString();
    const payload = {
      prompt: config.prompt,
      negative_prompt: config.negativePrompt || "",
      format: config.format || "PNG",
      aspect_ratio: config.aspectRatio || "1:1",
      width: config.width || 1024,
      height: config.height || 1024,
      seed: config.seed,
      num_inference_steps: config.steps || 30,
      guidance_scale: config.guidanceScale || 7.5,
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, image/png, image/jpeg",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Ayatrisya image endpoint returned HTTP ${res.status}: ${errorText.slice(0, 200)}`);
    }

    const contentType = res.headers.get("content-type") || "";

    // Case A: Raw image binary response
    if (contentType.startsWith("image/")) {
      const arrayBuffer = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      const val = validateImageBuffer(buf);
      if (!val.valid) {
        throw new Error(val.error || "Corrupt image buffer returned by Ayatrisya model.");
      }

      const mimeType = val.mimeType!;
      const ext = val.ext!;
      return {
        fileName: `ayatrisya-own-${Date.now()}${ext}`,
        mimeType,
        dataBase64: buf.toString("base64"),
        provider: "ayatrisya-own-model",
        model: AyatrisyaImageModel.MODEL_ID,
        stage: 1,
        fallbackUsed: false,
        version: AyatrisyaImageModel.VERSION,
      };
    }

    // Case B: JSON response with base64 or URL
    const json = (await res.json()) as any;
    const base64Candidate = json.dataBase64 || json.image_base64 || json.image;
    if (base64Candidate && typeof base64Candidate === "string") {
      const cleanBase64 = base64Candidate.replace(/^data:image\/[^;]+;base64,/, "");
      const buf = Buffer.from(cleanBase64, "base64");
      const val = validateImageBuffer(buf);
      if (!val.valid) {
        throw new Error(val.error || "Corrupt image base64 returned by Ayatrisya model.");
      }

      return {
        fileName: json.fileName || `ayatrisya-own-${Date.now()}${val.ext}`,
        mimeType: val.mimeType || "image/png",
        dataBase64: cleanBase64,
        provider: "ayatrisya-own-model",
        model: json.model || AyatrisyaImageModel.MODEL_ID,
        stage: 1,
        fallbackUsed: false,
        version: AyatrisyaImageModel.VERSION,
      };
    }

    if (json.url || json.fileUrl) {
      const imgRes = await fetch(json.url || json.fileUrl);
      if (!imgRes.ok) {
        throw new Error(`Failed to fetch image binary from Ayatrisya URL: HTTP ${imgRes.status}`);
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const val = validateImageBuffer(buf);
      if (!val.valid) {
        throw new Error(val.error || "Corrupt binary downloaded from Ayatrisya model URL.");
      }
      return {
        fileName: `ayatrisya-own-${Date.now()}${val.ext}`,
        mimeType: val.mimeType!,
        dataBase64: buf.toString("base64"),
        provider: "ayatrisya-own-model",
        model: AyatrisyaImageModel.MODEL_ID,
        stage: 1,
        fallbackUsed: false,
        version: AyatrisyaImageModel.VERSION,
      };
    }

    throw new Error("Ayatrisya image endpoint returned unrecognized payload format.");
  }
}
