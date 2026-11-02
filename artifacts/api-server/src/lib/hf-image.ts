// Hugging Face Inference API Image Generation Provider for Ayatrisya AI
import type { Response } from "express";

export const HF_DEFAULT_IMAGE_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "segmind/tiny-sd",
];

export function getHfToken(): string | null {
  const token = process.env.HF_TOKEN?.trim() || process.env.HF_READ_TOKEN?.trim();
  return token || null;
}

export function isHfImageConfigured(): boolean {
  return getHfToken() !== null;
}

/**
 * Generates an image using Hugging Face Serverless Inference API.
 * Supports FLUX.1-schnell, SDXL, and tiny-sd fallbacks.
 */
export async function generateHfImage(
  res: Response,
  data: { prompt: string; format?: "PNG" | "JPEG"; model?: string }
): Promise<boolean> {
  const token = getHfToken();
  const prompt = data.prompt?.trim();

  if (!prompt) {
    res.status(400).json({ error: "Image generation requires a non-empty prompt." });
    return true;
  }

  const modelsToTry = data.model
    ? [data.model, ...HF_DEFAULT_IMAGE_MODELS.filter((m) => m !== data.model)]
    : HF_DEFAULT_IMAGE_MODELS;

  let lastErrorMsg = "";

  for (const modelId of modelsToTry) {
    try {
      const endpoint = `https://api-inference.huggingface.co/models/${modelId}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "image/png, image/jpeg, application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs: prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastErrorMsg = `HF ${modelId} returned ${response.status}: ${errorText.slice(0, 150)}`;
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const dataBase64 = buf.toString("base64");
        const mimeType = contentType.includes("jpeg") ? "image/jpeg" : "image/png";

        res.status(200).json({
          dataBase64,
          mimeType,
          format: mimeType === "image/jpeg" ? "JPEG" : "PNG",
          provider: "huggingface-inference",
          model: modelId,
        });
        return true;
      }

      // If JSON returned with error or model loading
      const json = (await response.json()) as any;
      if (json.error) {
        lastErrorMsg = json.error;
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || String(err);
    }
  }

  res.status(503).json({
    error: `Hugging Face image generation unavailable: ${lastErrorMsg || "Model endpoints did not respond with image."}`,
  });
  return true;
}

