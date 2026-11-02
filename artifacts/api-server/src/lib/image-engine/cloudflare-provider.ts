// Cloudflare Workers AI Image Generation Provider (Stage 4 - Final Fallback)
// Copyright (c) AMETESX. All rights reserved.

import {
  getCloudflareConfig,
  isCloudflareConfigured,
  validateImageBuffer,
  CLOUDFLARE_PRIMARY_IMAGE_MODEL,
  CLOUDFLARE_FALLBACK_IMAGE_MODELS,
} from "../cloudflare-image";
import type { ImageGenerationResult } from "./ayatrisya-model";

export class CloudflareImageProvider {
  isConfigured(): boolean {
    return isCloudflareConfigured();
  }

  async generate(data: {
    prompt: string;
    aspectRatio?: string;
    width?: number;
    height?: number;
    format?: "PNG" | "JPEG";
  }): Promise<ImageGenerationResult> {
    const config = getCloudflareConfig();
    if (!config) {
      throw new Error(
        "Cloudflare Workers AI credentials are not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN."
      );
    }

    const prompt = data.prompt.trim();
    if (!prompt) {
      throw new Error("Prompt cannot be empty for Cloudflare image generation.");
    }

    const modelsToTry = [CLOUDFLARE_PRIMARY_IMAGE_MODEL, ...CLOUDFLARE_FALLBACK_IMAGE_MODELS];
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
        const bodyPayload: Record<string, any> = { prompt };
        if (data.width) bodyPayload.width = data.width;
        if (data.height) bodyPayload.height = data.height;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
            Accept: "image/png, image/jpeg, application/json",
          },
          body: JSON.stringify(bodyPayload),
          signal: AbortSignal.timeout(35000),
        });

        if (response.status === 429) {
          const errJson = (await response.json().catch(() => ({}))) as any;
          const cfMsg = errJson?.errors?.[0]?.message || "";
          const quotaErr = new Error(
            `Cloudflare Workers AI daily quota exceeded or rate limit reached (10,000 free Neurons/day limit reached). Cloudflare free tier resets at 00:00 UTC. ${cfMsg}`.trim()
          );
          (quotaErr as any).status = 429;
          (quotaErr as any).isRateLimit = true;
          throw quotaErr;
        }

        const contentType = response.headers.get("content-type") || "";
        let buffer: Buffer;

        if (contentType.startsWith("image/")) {
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else {
          const json = (await response.json()) as any;
          if (json.result?.image) {
            buffer = Buffer.from(json.result.image, "base64");
          } else if (json.image) {
            buffer = Buffer.from(json.image, "base64");
          } else {
            lastError = `Cloudflare ${model} returned unexpected JSON structure.`;
            continue;
          }
        }

        const validation = validateImageBuffer(buffer);
        if (!validation.valid) {
          lastError = `Cloudflare ${model} returned invalid image: ${validation.error}`;
          continue;
        }

        return {
          fileName: `cf-${Date.now()}${validation.ext}`,
          mimeType: validation.mimeType!,
          dataBase64: buffer.toString("base64"),
          provider: "cloudflare",
          model,
          stage: 4,
          fallbackUsed: true,
        };
      } catch (err: any) {
        if (err.isSafetyRefusal || err.isRateLimit) throw err;
        lastError = err?.message || String(err);
      }
    }

    throw new Error(`Cloudflare Workers AI generation failed: ${lastError || "All candidate models failed."}`);
  }
}
