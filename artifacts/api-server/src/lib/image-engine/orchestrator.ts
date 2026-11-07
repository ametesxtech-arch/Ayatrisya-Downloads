// Centralized Four-Stage Image Provider Orchestrator for Ayatrisya AI
// Priority Sequence:
// 1. AYATRISYA OWN IMAGE MODEL — PRIMARY
// 2. HUGGING FACE — SECONDARY
// 3. GOOGLE GEMINI — THIRD
// 4. CLOUDFLARE WORKERS AI — FINAL FALLBACK
//
// Copyright (c) AMETESX. All rights reserved.

import { AyatrisyaImageModel, type ImageGenerationResult, type AyatrisyaImageConfig } from "./ayatrisya-model";
import { HfImageProvider } from "./hf-provider";
import { GeminiImageProvider } from "./gemini-provider";
import { CloudflareImageProvider } from "./cloudflare-provider";
import { enrichImagePrompt, DEFAULT_NEGATIVE_PROMPT } from "./prompt-enhancer";

export interface StageAuditEntry {
  stage: 1 | 2 | 3 | 4;
  provider: "ayatrisya-own-model" | "huggingface" | "gemini" | "cloudflare";
  status: "success" | "failed" | "skipped";
  reason?: string;
  durationMs: number;
}

export interface OrchestratedImageResult extends ImageGenerationResult {
  stageAudit: StageAuditEntry[];
}

export class ImageProviderOrchestrator {
  private ayatrisyaModel: AyatrisyaImageModel;
  private hfProvider: HfImageProvider;
  private geminiProvider: GeminiImageProvider;
  private cfProvider: CloudflareImageProvider;

  constructor() {
    this.ayatrisyaModel = new AyatrisyaImageModel();
    this.hfProvider = new HfImageProvider();
    this.geminiProvider = new GeminiImageProvider();
    this.cfProvider = new CloudflareImageProvider();
  }

  /**
   * Generates an image following the mandatory 4-stage sequential fallback protocol.
   */
  async generateImage(config: AyatrisyaImageConfig): Promise<OrchestratedImageResult> {
    const stageAudit: StageAuditEntry[] = [];
    const rawPrompt = config.prompt?.trim();

    if (!rawPrompt) {
      throw new Error("Image generation requires a non-empty prompt.");
    }

    const prompt = enrichImagePrompt(rawPrompt);
    const negativePrompt = config.negativePrompt || DEFAULT_NEGATIVE_PROMPT;

    // ==========================================
    // STAGE 1: AYATRISYA PROPRIETARY IMAGE MODEL
    // ==========================================
    const stage1Start = Date.now();
    try {
      const endpoint = this.ayatrisyaModel.getEndpoint();
      const apiKey = this.ayatrisyaModel.getApiKey();
      if (!endpoint || !apiKey) {
        stageAudit.push({
          stage: 1,
          provider: "ayatrisya-own-model",
          status: "skipped",
          reason: "Ayatrisya proprietary weights and GPU inference instance are currently offline. Awaiting dedicated Ametesx self-hosted GPU runner (AYATRISYA_IMAGE_MODEL_ENDPOINT).",
          durationMs: Date.now() - stage1Start,
        });
      } else {
        const result = await this.ayatrisyaModel.generate({ ...config, prompt, negativePrompt });
        stageAudit.push({
          stage: 1,
          provider: "ayatrisya-own-model",
          status: "success",
          durationMs: Date.now() - stage1Start,
        });
        return { ...result, stageAudit };
      }
    } catch (err: any) {
      if (err.isSafetyRefusal) {
        // Immediate termination: Never fallback on safety refusals
        throw err;
      }
      stageAudit.push({
        stage: 1,
        provider: "ayatrisya-own-model",
        status: "failed",
        reason: err?.message || String(err),
        durationMs: Date.now() - stage1Start,
      });
    }

    // ==========================================
    // STAGE 2: HUGGING FACE INFERENCE API
    // ==========================================
    const stage2Start = Date.now();
    try {
      if (!this.hfProvider.isConfigured()) {
        stageAudit.push({
          stage: 2,
          provider: "huggingface",
          status: "skipped",
          reason: "Hugging Face token not configured (HF_TOKEN / HF_READ_TOKEN missing).",
          durationMs: Date.now() - stage2Start,
        });
      } else {
        const result = await this.hfProvider.generate({
          prompt,
          negativePrompt,
          format: config.format,
        });
        stageAudit.push({
          stage: 2,
          provider: "huggingface",
          status: "success",
          durationMs: Date.now() - stage2Start,
        });
        return { ...result, stageAudit };
      }
    } catch (err: any) {
      if (err.isSafetyRefusal) {
        throw err;
      }
      stageAudit.push({
        stage: 2,
        provider: "huggingface",
        status: "failed",
        reason: err?.message || String(err),
        durationMs: Date.now() - stage2Start,
      });
    }

    // ==========================================
    // STAGE 3: GOOGLE GEMINI (IMAGEN 3)
    // ==========================================
    const stage3Start = Date.now();
    try {
      if (!this.geminiProvider.isConfigured()) {
        stageAudit.push({
          stage: 3,
          provider: "gemini",
          status: "skipped",
          reason: "Gemini API key not configured (GEMINI_API_KEY missing).",
          durationMs: Date.now() - stage3Start,
        });
      } else {
        const result = await this.geminiProvider.generate({
          prompt,
          aspectRatio: config.aspectRatio,
          format: config.format,
        });
        stageAudit.push({
          stage: 3,
          provider: "gemini",
          status: "success",
          durationMs: Date.now() - stage3Start,
        });
        return { ...result, stageAudit };
      }
    } catch (err: any) {
      if (err.isSafetyRefusal) {
        throw err;
      }
      stageAudit.push({
        stage: 3,
        provider: "gemini",
        status: "failed",
        reason: err?.message || String(err),
        durationMs: Date.now() - stage3Start,
      });
    }

    // ==========================================
    // STAGE 4: CLOUDFLARE WORKERS AI (FINAL FALLBACK)
    // ==========================================
    const stage4Start = Date.now();
    try {
      if (!this.cfProvider.isConfigured()) {
        stageAudit.push({
          stage: 4,
          provider: "cloudflare",
          status: "skipped",
          reason: "Cloudflare Workers AI credentials missing (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN).",
          durationMs: Date.now() - stage4Start,
        });
      } else {
        const result = await this.cfProvider.generate({
          prompt,
          aspectRatio: config.aspectRatio,
          width: config.width,
          height: config.height,
          format: config.format,
        });
        stageAudit.push({
          stage: 4,
          provider: "cloudflare",
          status: "success",
          durationMs: Date.now() - stage4Start,
        });
        return { ...result, stageAudit };
      }
    } catch (err: any) {
      if (err.isSafetyRefusal || err.isRateLimit) {
        throw err;
      }
      stageAudit.push({
        stage: 4,
        provider: "cloudflare",
        status: "failed",
        reason: err?.message || String(err),
        durationMs: Date.now() - stage4Start,
      });
    }

    // ==========================================
    // ALL PROVIDERS FAILED
    // ==========================================
    const allSkipped = stageAudit.every((s) => s.status === "skipped");
    if (allSkipped) {
      const unconfiguredError = new Error(
        "No image generation model is configured. All 4 image generation stages failed. Configure AYATRISYA_IMAGE_MODEL_ENDPOINT, HF_TOKEN, GEMINI_API_KEY, or CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server to enable image generation."
      );
      (unconfiguredError as any).stageAudit = stageAudit;
      (unconfiguredError as any).status = 503;
      throw unconfiguredError;
    }

    const auditSummary = stageAudit
      .map((s) => `Stage ${s.stage} (${s.provider}): ${s.status}${s.reason ? ` - ${s.reason}` : ""}`)
      .join(" | ");

    const error = new Error(`All 4 image generation stages failed. Audit: ${auditSummary}`);
    (error as any).stageAudit = stageAudit;
    (error as any).status = 503;
    throw error;
  }
}

export const imageOrchestrator = new ImageProviderOrchestrator();
