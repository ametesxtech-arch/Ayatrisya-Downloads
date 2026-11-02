import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ImageProviderOrchestrator } from "./orchestrator";
import { AyatrisyaImageModel } from "./ayatrisya-model";
import { HfImageProvider } from "./hf-provider";
import { GeminiImageProvider } from "./gemini-provider";
import { CloudflareImageProvider } from "./cloudflare-provider";

// Helper to create valid 1x1 PNG base64
const VALID_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("Ayatrisya 4-Stage Image Generation Orchestrator", () => {
  let orchestrator: ImageProviderOrchestrator;

  beforeEach(() => {
    orchestrator = new ImageProviderOrchestrator();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Stage 1: Uses Ayatrisya Proprietary Model when operational without fallback", async () => {
    vi.spyOn(AyatrisyaImageModel.prototype, "getEndpoint").mockReturnValue("https://models.ayatrisya.example");
    vi.spyOn(AyatrisyaImageModel.prototype, "getApiKey").mockReturnValue("test-key");

    vi.spyOn(AyatrisyaImageModel.prototype, "generate").mockResolvedValue({
      fileName: "ayatrisya-own-123.png",
      mimeType: "image/png",
      dataBase64: VALID_1X1_PNG_BASE64,
      provider: "ayatrisya-own-model",
      model: "Ayatrisya-Diffusion-v1",
      stage: 1,
      fallbackUsed: false,
      version: "1.0.0-preview",
    });

    const hfSpy = vi.spyOn(HfImageProvider.prototype, "generate");

    const result = await orchestrator.generateImage({
      prompt: "A beautiful cosmic nebula",
      format: "PNG",
    });

    expect(result.provider).toBe("ayatrisya-own-model");
    expect(result.model).toBe("Ayatrisya-Diffusion-v1");
    expect(result.stage).toBe(1);
    expect(result.fallbackUsed).toBe(false);
    expect(hfSpy).not.toHaveBeenCalled();
    expect(result.stageAudit).toHaveLength(1);
    expect(result.stageAudit[0].status).toBe("success");
  });

  it("Stage 2: Falls back to Hugging Face when Ayatrisya model is offline", async () => {
    vi.spyOn(AyatrisyaImageModel.prototype, "getEndpoint").mockReturnValue(null);

    vi.spyOn(HfImageProvider.prototype, "isConfigured").mockReturnValue(true);
    vi.spyOn(HfImageProvider.prototype, "generate").mockResolvedValue({
      fileName: "hf-456.png",
      mimeType: "image/png",
      dataBase64: VALID_1X1_PNG_BASE64,
      provider: "huggingface",
      model: "black-forest-labs/FLUX.1-schnell",
      stage: 2,
      fallbackUsed: true,
    });

    const geminiSpy = vi.spyOn(GeminiImageProvider.prototype, "generate");

    const result = await orchestrator.generateImage({
      prompt: "A futuristic skyline",
      format: "PNG",
    });

    expect(result.provider).toBe("huggingface");
    expect(result.model).toBe("black-forest-labs/FLUX.1-schnell");
    expect(result.stage).toBe(2);
    expect(result.fallbackUsed).toBe(true);
    expect(geminiSpy).not.toHaveBeenCalled();
    expect(result.stageAudit[0].status).toBe("skipped");
    expect(result.stageAudit[1].status).toBe("success");
  });

  it("Stage 3: Falls back to Google Gemini when Own Model and Hugging Face fail", async () => {
    vi.spyOn(AyatrisyaImageModel.prototype, "getEndpoint").mockReturnValue(null);

    vi.spyOn(HfImageProvider.prototype, "isConfigured").mockReturnValue(true);
    vi.spyOn(HfImageProvider.prototype, "generate").mockRejectedValue(
      new Error("HF rate limit exceeded (HTTP 429)")
    );

    vi.spyOn(GeminiImageProvider.prototype, "isConfigured").mockReturnValue(true);
    vi.spyOn(GeminiImageProvider.prototype, "generate").mockResolvedValue({
      fileName: "gemini-789.jpg",
      mimeType: "image/jpeg",
      dataBase64: VALID_1X1_PNG_BASE64,
      provider: "gemini",
      model: "imagen-3.0-generate-002",
      stage: 3,
      fallbackUsed: true,
    });

    const cfSpy = vi.spyOn(CloudflareImageProvider.prototype, "generate");

    const result = await orchestrator.generateImage({
      prompt: "A cybernetic tiger",
      format: "JPEG",
    });

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("imagen-3.0-generate-002");
    expect(result.stage).toBe(3);
    expect(result.fallbackUsed).toBe(true);
    expect(cfSpy).not.toHaveBeenCalled();
    expect(result.stageAudit).toHaveLength(3);
    expect(result.stageAudit[1].status).toBe("failed");
    expect(result.stageAudit[2].status).toBe("success");
  });

  it("Stage 4: Falls back to Cloudflare Workers AI as final fallback", async () => {
    vi.spyOn(AyatrisyaImageModel.prototype, "getEndpoint").mockReturnValue(null);

    vi.spyOn(HfImageProvider.prototype, "isConfigured").mockReturnValue(false);

    vi.spyOn(GeminiImageProvider.prototype, "isConfigured").mockReturnValue(true);
    vi.spyOn(GeminiImageProvider.prototype, "generate").mockRejectedValue(
      new Error("Gemini Imagen-3 returned 404 (model not accessible)")
    );

    vi.spyOn(CloudflareImageProvider.prototype, "isConfigured").mockReturnValue(true);
    vi.spyOn(CloudflareImageProvider.prototype, "generate").mockResolvedValue({
      fileName: "cf-101.png",
      mimeType: "image/png",
      dataBase64: VALID_1X1_PNG_BASE64,
      provider: "cloudflare",
      model: "@cf/black-forest-labs/flux-1-schnell",
      stage: 4,
      fallbackUsed: true,
    });

    const result = await orchestrator.generateImage({
      prompt: "A serene Japanese zen garden",
    });

    expect(result.provider).toBe("cloudflare");
    expect(result.model).toBe("@cf/black-forest-labs/flux-1-schnell");
    expect(result.stage).toBe(4);
    expect(result.fallbackUsed).toBe(true);
    expect(result.stageAudit).toHaveLength(4);
    expect(result.stageAudit[3].status).toBe("success");
  });

  it("Halts immediately on safety refusal without falling back", async () => {
    vi.spyOn(AyatrisyaImageModel.prototype, "getEndpoint").mockReturnValue(null);

    vi.spyOn(HfImageProvider.prototype, "isConfigured").mockReturnValue(true);
    const safetyError = new Error("Hugging Face safety refusal: Content policy violation on model.");
    (safetyError as any).isSafetyRefusal = true;
    vi.spyOn(HfImageProvider.prototype, "generate").mockRejectedValue(safetyError);

    const geminiSpy = vi.spyOn(GeminiImageProvider.prototype, "generate");
    const cfSpy = vi.spyOn(CloudflareImageProvider.prototype, "generate");

    await expect(
      orchestrator.generateImage({ prompt: "Prohibited content prompt" })
    ).rejects.toThrow("Hugging Face safety refusal");

    // Critical: Do NOT bypass safety by downgrading to downstream providers
    expect(geminiSpy).not.toHaveBeenCalled();
    expect(cfSpy).not.toHaveBeenCalled();
  });

  it("Throws descriptive aggregate error when all 4 providers fail", async () => {
    vi.spyOn(AyatrisyaImageModel.prototype, "getEndpoint").mockReturnValue(null);
    vi.spyOn(HfImageProvider.prototype, "isConfigured").mockReturnValue(false);
    vi.spyOn(GeminiImageProvider.prototype, "isConfigured").mockReturnValue(false);
    vi.spyOn(CloudflareImageProvider.prototype, "isConfigured").mockReturnValue(false);

    await expect(
      orchestrator.generateImage({ prompt: "A watercolor sunset" })
    ).rejects.toThrow(/All 4 image generation stages failed/);
  });
});
