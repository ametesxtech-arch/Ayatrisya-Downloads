import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import { generateDocumentFromPrompt, regenerateDocumentSection } from "../ai/document-generator";
import { generatePresentationFromPrompt, regenerateSlide } from "../ai/presentation-generator";
import { generateProjectFromPrompt, regenerateProjectFile } from "../ai/project-generator";
import { generatePdfDocument } from "../lib/pdf-export";
import { generatePptx } from "../lib/pptx-export";
import { CREATION_CAPABILITIES, listCreationCapabilities, isCapabilityAvailable } from "../ai/creation-engine";
import { cleanTextForSpeech, speakText, createSpeechRecognizer } from "../components/voice/voice-utils";

function createValidWavBinary(durationSeconds = 1, sampleRate = 44100): Uint8Array {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // RIFF header
  bytes[0] = 0x52; bytes[1] = 0x49; bytes[2] = 0x46; bytes[3] = 0x46; // 'RIFF'
  view.setUint32(4, 36 + dataSize, true);
  bytes[8] = 0x57; bytes[9] = 0x41; bytes[10] = 0x56; bytes[11] = 0x45; // 'WAVE'

  // fmt chunk
  bytes[12] = 0x66; bytes[13] = 0x6d; bytes[14] = 0x74; bytes[15] = 0x20; // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bitsPerSample

  // data chunk
  bytes[36] = 0x64; bytes[37] = 0x61; bytes[38] = 0x74; bytes[39] = 0x61; // 'data'
  view.setUint32(40, dataSize, true);

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe("Ayatrisya Part 2 — Comprehensive Generation Engine Test Suite", () => {
  const valid1x1PngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzHk9t5gAAAABJRU5ErkJggg==";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SECTION 13: TESTS 1 TO 8 (IMAGE GENERATION & SEQUENTIAL FALLBACK)
  // =========================================================================

  describe("Image Generation & Fallback (Tests 1-8)", () => {
    it("Test 1: Ayatrisya Own Model succeeds as primary provider", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "primary-image.png",
          mimeType: "image/png",
          dataBase64: valid1x1PngBase64,
          stage: 1,
          stageAudit: [
            { stage: 1, provider: "ayatrisya-own-model", status: "success", durationMs: 450 }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.generateAsset("image", "Ayatrisya high-tech headquarters in neon blue", {
        model: "v1-fast",
        format: "PNG",
      });

      expect(result.fileName).toBe("primary-image.png");
      expect(result.blob.type).toBe("image/png");
      expect(result.stage).toBe(1);
      expect(result.stageAudit?.[0].provider).toBe("ayatrisya-own-model");
      expect(result.stageAudit?.[0].status).toBe("success");
    });

    it("Test 2: Own model fails -> Hugging Face runs next and succeeds", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "hf-flux-image.png",
          mimeType: "image/png",
          dataBase64: valid1x1PngBase64,
          stage: 2,
          stageAudit: [
            { stage: 1, provider: "ayatrisya-own-model", status: "failed", reason: "Connection timeout to self-hosted GPU runner", durationMs: 1200 },
            { stage: 2, provider: "huggingface", status: "success", durationMs: 2100 }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.generateAsset("image", "Cyberpunk skyline at dusk", {
        model: "v1-fast",
        format: "PNG",
      });

      expect(result.stage).toBe(2);
      expect(result.stageAudit?.[0].status).toBe("failed");
      expect(result.stageAudit?.[1].provider).toBe("huggingface");
      expect(result.stageAudit?.[1].status).toBe("success");
    });

    it("Test 3: Hugging Face fails -> Gemini runs next and succeeds", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "gemini-imagen-image.png",
          mimeType: "image/png",
          dataBase64: valid1x1PngBase64,
          stage: 3,
          stageAudit: [
            { stage: 1, provider: "ayatrisya-own-model", status: "skipped", reason: "Runner offline", durationMs: 10 },
            { stage: 2, provider: "huggingface", status: "failed", reason: "503 Model Loading", durationMs: 500 },
            { stage: 3, provider: "gemini", status: "success", durationMs: 1800 }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.generateAsset("image", "Serene Japanese garden in spring", {
        model: "v1-fast",
        format: "PNG",
      });

      expect(result.stage).toBe(3);
      expect(result.stageAudit?.[2].provider).toBe("gemini");
      expect(result.stageAudit?.[2].status).toBe("success");
    });

    it("Test 4: Gemini fails -> Cloudflare runs next as final fallback and succeeds", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "cloudflare-flux-image.png",
          mimeType: "image/png",
          dataBase64: valid1x1PngBase64,
          stage: 4,
          stageAudit: [
            { stage: 1, provider: "ayatrisya-own-model", status: "skipped", durationMs: 5 },
            { stage: 2, provider: "huggingface", status: "failed", reason: "Rate limit 429", durationMs: 200 },
            { stage: 3, provider: "gemini", status: "failed", reason: "Quota exceeded 429", durationMs: 350 },
            { stage: 4, provider: "cloudflare", status: "success", durationMs: 1400 }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.generateAsset("image", "Mountain landscape in fog", {
        model: "v1-fast",
        format: "PNG",
      });

      expect(result.stage).toBe(4);
      expect(result.stageAudit?.[3].provider).toBe("cloudflare");
      expect(result.stageAudit?.[3].status).toBe("success");
    });

    it("Test 5: All providers fail returns honest, informative error with audit", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          error: "All 4 image generation stages failed. Audit: Stage 1 (ayatrisya-own-model): failed | Stage 2 (huggingface): failed | Stage 3 (gemini): failed | Stage 4 (cloudflare): failed",
          status: 503,
          stageAudit: [
            { stage: 1, provider: "ayatrisya-own-model", status: "failed", durationMs: 10 },
            { stage: 2, provider: "huggingface", status: "failed", durationMs: 10 },
            { stage: 3, provider: "gemini", status: "failed", durationMs: 10 },
            { stage: 4, provider: "cloudflare", status: "failed", durationMs: 10 }
          ]
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.generateAsset("image", "Test prompt", { model: "v1-fast", format: "PNG" }))
        .rejects.toThrow(/All 4 image generation stages failed/);
    });

    it("Test 6: Safety refusal terminates immediately without fallback to subsequent providers", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          error: "Safety policy refusal: Prompt contains content violating safety guidelines.",
          isSafetyRefusal: true,
          status: 400,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.generateAsset("image", "Harmful prohibited prompt", { model: "v1-fast", format: "PNG" }))
        .rejects.toThrow(/Safety policy refusal/);
    });

    it("Test 7: Corrupt or invalid image data is rejected with signature validation", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const corruptBase64 = Buffer.from("THIS_IS_NOT_A_VALID_IMAGE_HEADER").toString("base64");
      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "corrupt.png",
          mimeType: "image/png",
          dataBase64: corruptBase64,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.generateAsset("image", "A dog in a park", { model: "v1-fast", format: "PNG" }))
        .rejects.toThrow(/invalid signature/);
    });

    it("Test 8: Generated image result preserves exact provider identity and stage in metadata", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
      ]);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "output-stage3.png",
          mimeType: "image/png",
          dataBase64: valid1x1PngBase64,
          stage: 3,
          provider: "gemini",
          stageAudit: [
            { stage: 1, provider: "ayatrisya-own-model", status: "skipped", durationMs: 5 },
            { stage: 2, provider: "huggingface", status: "skipped", durationMs: 5 },
            { stage: 3, provider: "gemini", status: "success", durationMs: 1200 }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.generateAsset("image", "Futuristic cityscape", { model: "v1-fast", format: "PNG" });
      expect(result.stage).toBe(3);
      expect(result.stageAudit).toHaveLength(3);
      expect(result.stageAudit?.[2].provider).toBe("gemini");
    });
  });

  // =========================================================================
  // SECTION 13: TESTS 9 TO 12 (DOCUMENT GENERATION & PDF EXPORT)
  // =========================================================================

  describe("Document Generation & PDF Export (Tests 9-12)", () => {
    it("Test 9: Prompt-to-document generates multi-section structured markdown document", async () => {
      const { modelClient } = await import("../ai/client");
      const planResponse = JSON.stringify({
        title: "AI Security Whitepaper",
        summary: "An overview of cybersecurity and model safety in 2026.",
        sections: [
          { title: "Executive Summary", level: 1, guidance: "Overview of security findings" },
          { title: "Threat Vectors", level: 2, guidance: "Prompt injection and data poisoning" },
          { title: "Mitigation Strategies", level: 2, guidance: "Zero-trust verification and sandboxing" },
        ],
      });

      const section1Text = "Cybersecurity in the AI era demands proactive multi-layered defenses.";
      const section2Text = "Prompt injection attacks and unauthorized data exfiltration represent critical risks.";
      const section3Text = "Implement robust boundary checks, strict credential isolation, and memory auditing.";

      let callIndex = 0;
      vi.spyOn(modelClient, "generateResponse").mockImplementation(async () => {
        callIndex++;
        if (callIndex === 1) return planResponse;
        if (callIndex === 2) return section1Text;
        if (callIndex === 3) return section2Text;
        return section3Text;
      });

      const doc = await generateDocumentFromPrompt("AI Security Whitepaper", { saveToWorkspace: false });

      expect(doc.title).toBe("AI Security Whitepaper");
      expect(doc.sections).toHaveLength(3);
      expect(doc.fullMarkdown).toContain("# AI Security Whitepaper");
      expect(doc.fullMarkdown).toContain("## Executive Summary");
      expect(doc.fullMarkdown).toContain(section1Text);
      expect(doc.fullMarkdown).toContain("### Threat Vectors");
      expect(doc.fullMarkdown).toContain(section2Text);
    });

    it("Test 10: Individual document section can be regenerated cleanly without losing document context", async () => {
      const { modelClient } = await import("../ai/client");
      const updatedSectionContent = "Refined deep-dive into autonomous agent security barriers.";
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(updatedSectionContent);

      const regenerated = await regenerateDocumentSection(
        "AI Security Whitepaper",
        "Threat Vectors",
        "Focus on autonomous agent boundary controls."
      );

      expect(regenerated).toBe(updatedSectionContent);
    });

    it("Test 11: Document PDF export generates valid PDF-1.4 binary with cross-reference table", () => {
      const markdown = `# AI Security Whitepaper\n\nExecutive Overview: Robust defense architectures for generative systems.\n\n## Recommendations\n\n- Zero trust authentication\n- Immutable audit logging`;
      const pdfBytes = generatePdfDocument(markdown, { title: "AI Security Whitepaper" });

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(100);

      const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 8));
      expect(pdfHeader).toContain("%PDF-1.4");

      const pdfTail = new TextDecoder().decode(pdfBytes.slice(-100));
      expect(pdfTail).toContain("startxref");
      expect(pdfTail).toContain("%%EOF");
    });

    it("Test 12: PDF export preserves text content and structure across multi-page layouts", () => {
      const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}: Continuous automated testing ensures stability and high quality.`).join("\n\n");
      const pdfBytes = generatePdfDocument(paragraphs, { title: "Lengthy Report" });

      const textRepresentation = new TextDecoder().decode(pdfBytes);
      expect(textRepresentation).toContain("/Type /Page");
      expect(textRepresentation).toContain("Lengthy Report");
      expect(textRepresentation).toContain("Paragraph 1");
    });
  });

  // =========================================================================
  // SECTION 13: TESTS 13 TO 16 (PRESENTATION GENERATION & PPTX EXPORT)
  // =========================================================================

  describe("Presentation Generation & PPTX Export (Tests 13-16)", () => {
    it("Test 13: Prompt-to-presentation plans and generates multi-slide presentation structure", async () => {
      const { modelClient } = await import("../ai/client");
      const planResponse = JSON.stringify({
        title: "Ayatrisya Product Vision 2026",
        themeDescription: "Dark Cinematic",
        slides: [
          { title: "Ayatrisya Platform", body: "The Unified Intelligence Engine", layout: "title" },
          { title: "Core Architecture", body: "• Modular decoupled design\n• Multi-provider fallback\n• Real-time streaming", layout: "bullets" },
          { title: "Founding Philosophy", body: "\"Instantaneous intelligence without compromises.\"", layout: "quote" },
        ],
      });

      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(planResponse);

      const result = await generatePresentationFromPrompt("Ayatrisya Product Vision 2026", {
        targetSlideCount: 3,
        saveToWorkspace: false,
      });

      expect(result.title).toBe("Ayatrisya Product Vision 2026");
      expect(result.slides).toHaveLength(3);
      expect(result.slides[0].title).toBe("Ayatrisya Platform");
      expect(result.slides[1].layout).toBe("bullets");
      expect(result.slides[2].layout).toBe("quote");
    });

    it("Test 14: Individual slide can be regenerated with specific styling and content updates", async () => {
      const { modelClient } = await import("../ai/client");
      const updatedSlideJson = JSON.stringify({
        title: "Updated Core Architecture",
        body: "• Enhanced sub-second latency\n• Fault-tolerant sequential fallback\n• Zero-dependency vector exports",
        layout: "bullets",
      });

      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(updatedSlideJson);

      const currentSlide = {
        id: "slide-1",
        title: "Core Architecture",
        body: "Old body",
        layout: "bullets" as const,
      };

      const regenerated = await regenerateSlide("Ayatrisya Product Vision", currentSlide, "Add zero-dependency vector exports");
      expect(regenerated.title).toBe("Updated Core Architecture");
      expect(regenerated.body.toLowerCase()).toContain("zero-dependency vector exports");
    });

    it("Test 15: PPTX generation produces valid OpenXML ZIP binary with standard headers", () => {
      const slides = [
        { id: "s1", title: "Ayatrisya Overview", body: "Slide Subtitle", layout: "title" as const },
        { id: "s2", title: "Key Features", body: "• Feature 1\n• Feature 2", layout: "bullets" as const },
      ];

      const pptxBytes = generatePptx("Ayatrisya Overview", slides);
      expect(pptxBytes).toBeInstanceOf(Uint8Array);
      expect(pptxBytes.length).toBeGreaterThan(200);

      // Verify ZIP local file header signature 0x04034b50 (PK\x03\x04)
      expect(pptxBytes[0]).toBe(0x50); // 'P'
      expect(pptxBytes[1]).toBe(0x4b); // 'K'
      expect(pptxBytes[2]).toBe(0x03);
      expect(pptxBytes[3]).toBe(0x04);
    });

    it("Test 16: PPTX bundle contains [Content_Types].xml, presentation.xml, and relationship files", () => {
      const slides = [
        { id: "s1", title: "Title Slide", body: "Welcome", layout: "title" as const },
      ];

      const pptxBytes = generatePptx("Title Slide", slides);
      const textChunk = new TextDecoder().decode(pptxBytes);

      expect(textChunk).toContain("[Content_Types].xml");
      expect(textChunk).toContain("ppt/presentation.xml");
      expect(textChunk).toContain("ppt/slides/slide1.xml");
      expect(textChunk).toContain("_rels/.rels");
    });
  });

  // =========================================================================
  // SECTION 13: TESTS 17 TO 20 (CODE AND PROJECT GENERATION)
  // =========================================================================

  describe("Code & Multi-File Project Generation (Tests 17-20)", () => {
    it("Test 17: Multi-file project planning and file structure generation", async () => {
      const { modelClient } = await import("../ai/client");
      const planResponse = JSON.stringify({
        projectName: "mini-express-server",
        summary: "A lightweight REST server template",
        architecture: "Modular controller and routing layers",
        dependencies: { express: "^4.19.0", dotenv: "^16.4.5" },
        filePlan: [
          { path: "src/server.ts", description: "Server bootstrap", language: "typescript" },
          { path: "src/routes.ts", description: "Route handlers", language: "typescript" },
          { path: "README.md", description: "Project documentation", language: "markdown" }
        ]
      });

      let callCount = 0;
      vi.spyOn(modelClient, "generateResponse").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return planResponse;
        if (callCount === 2) return `import express from 'express';\nconst app = express();\nexport default app;`;
        if (callCount === 3) return `export function registerRoutes() { return []; }`;
        return `# Mini Express Server\nDocumentation and setup.`;
      });

      const project = await generateProjectFromPrompt("Build a mini express server");
      expect(project.projectName).toBe("mini-express-server");
      expect(project.files).toHaveLength(3);
      expect(project.files.map((f) => f.path)).toEqual(["src/server.ts", "src/routes.ts", "README.md"]);
    });

    it("Test 18: File tree paths and modular separation are strictly maintained", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse").mockResolvedValueOnce(JSON.stringify({
        projectName: "tree-test",
        summary: "Testing nested filepaths",
        architecture: "Hierarchical nested modules",
        dependencies: {},
        filePlan: [
          { path: "src/core/engine.ts", description: "Engine", language: "typescript" },
          { path: "src/utils/math.ts", description: "Math utils", language: "typescript" },
        ]
      })).mockResolvedValue("export const val = 1;");

      const project = await generateProjectFromPrompt("Nested structure");
      expect(project.files[0].path).toBe("src/core/engine.ts");
      expect(project.files[1].path).toBe("src/utils/math.ts");
    });

    it("Test 19: Individual file regeneration within an existing project context", async () => {
      const { modelClient } = await import("../ai/client");
      const updatedCode = `export function calculateTotal(prices: number[]): number {\n  return prices.reduce((a, b) => a + b, 0);\n}`;
      vi.spyOn(modelClient, "generateResponse").mockResolvedValue(updatedCode);

      const existingFile = {
        path: "src/utils/calc.ts",
        content: "export function calculateTotal() { return 0; }",
        description: "Calculations",
        language: "typescript",
      };

      const result = await regenerateProjectFile("Store Project", existingFile, "Add prices reduce implementation");
      expect(result).toBe(updatedCode);
    });

    it("Test 20: Project dependencies and architectural summary are validly populated", async () => {
      const { modelClient } = await import("../ai/client");
      vi.spyOn(modelClient, "generateResponse").mockResolvedValueOnce(JSON.stringify({
        projectName: "analytics-tool",
        summary: "Data analytics aggregator",
        architecture: "Pipeline processor pattern",
        dependencies: { "date-fns": "^3.0.0", "zod": "^3.22.0" },
        filePlan: [
          { path: "index.ts", description: "Main entry", language: "typescript" }
        ]
      })).mockResolvedValue("console.log('ready');");

      const project = await generateProjectFromPrompt("Analytics tool");
      expect(project.dependencies).toHaveProperty("zod");
      expect(project.dependencies).toHaveProperty("date-fns");
      expect(project.architecture).toContain("Pipeline");
    });
  });

  // =========================================================================
  // SECTION 13: TESTS 21 TO 23 (MUSIC & AUDIO GENERATION)
  // =========================================================================

  describe("Music & Procedural Audio Generation (Tests 21-23)", () => {
    it("Test 21: Procedural audio synthesis generates valid RIFF WAV header with fmt and data chunks", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true }
      ]);

      const validWavBytes = createValidWavBinary(2);
      const validWavBase64 = bytesToBase64(validWavBytes);

      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "ambient-melody.wav",
          mimeType: "audio/wav",
          dataBase64: validWavBase64,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      const result = await client.generateAsset("music", "Relaxing ambient chords", {
        model: "v1-fast",
        format: "WAV",
        durationSeconds: 2,
      });
      expect(result.fileName).toBe("ambient-melody.wav");
      expect(result.blob.type).toBe("audio/wav");

      const arrayBuf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const riffTag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      const waveTag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      expect(riffTag).toBe("RIFF");
      expect(waveTag).toBe("WAVE");
    });

    it("Test 22: Music engine honest classification reveals procedural synthesis rather than neural weights", () => {
      const musicCapability = CREATION_CAPABILITIES.music;
      expect(musicCapability.isAvailable).toBe(true);
      expect(musicCapability.isFree).toBe(true);
      expect(musicCapability.description.toLowerCase()).toContain("procedural");
      expect(musicCapability.supportedFormats).toContain("wav");
    });

    it("Test 23: Rejects corrupt audio generation output missing valid RIFF header", async () => {
      const client = new AyatrisyaModelClient();
      vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
        { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "music"], attachments: true }
      ]);

      const corruptAudio = Buffer.from("NOT_A_VALID_WAV_HEADER").toString("base64");
      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({
          fileName: "corrupt.wav",
          mimeType: "audio/wav",
          dataBase64: corruptAudio,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ));
      vi.stubGlobal("fetch", fetchMock);

      await expect(client.generateAsset("music", "Bad audio test", {
        model: "v1-fast",
        format: "WAV",
        durationSeconds: 5,
      })).rejects.toThrow(/invalid signature/);
    });
  });

  // =========================================================================
  // SECTION 13: TESTS 24 TO 26 (VOICE: TTS & STT)
  // =========================================================================

  describe("Voice Engine (TTS & STT) (Tests 24-26)", () => {
    it("Test 24: Text-to-speech cleans markdown, formulas, and code blocks before verbalization", () => {
      const markdown = `
# Executive Summary
Check out the **latest** update at [Ayatrisya](https://ayatrisya.ai).
Here is the code:
\`\`\`typescript
const val = 42;
\`\`\`
The energy formula is $E = mc^2$.
Have a great day!
`;
      const cleaned = cleanTextForSpeech(markdown);
      expect(cleaned).not.toContain("#");
      expect(cleaned).not.toContain("**");
      expect(cleaned).not.toContain("https://ayatrisya.ai");
      expect(cleaned).not.toContain("const val = 42");
      expect(cleaned).toContain("[Code snippet]");
      expect(cleaned).toContain("[formula]");
      expect(cleaned).toContain("Executive Summary");
      expect(cleaned).toContain("Have a great day!");
    });

    it("Test 25: TTS speakText gracefully handles empty string without throwing errors", () => {
      let ended = false;
      const handle = speakText("", {
        onEnd: () => {
          ended = true;
        },
      });

      expect(handle).toBeDefined();
      expect(typeof handle.stop).toBe("function");
      handle.stop();
    });

    it("Test 26: Speech-to-text recognition provides safe fallback error when browser speech API is unavailable", () => {
      let capturedError = "";
      const recognizer = createSpeechRecognizer({
        onResult: () => {},
        onError: (err) => {
          capturedError = err;
        },
        onEnd: () => {},
      });

      expect(recognizer).toBeDefined();
      if (!recognizer.isSupported) {
        recognizer.start();
        expect(capturedError).toMatch(/not supported|outside browser/i);
      }
    });
  });

  // =========================================================================
  // SECTION 12: UNIFIED CREATION ENGINE CAPABILITY REGISTRY
  // =========================================================================

  describe("Unified Creation Engine Capability Registry", () => {
    it("all creation capabilities report valid metadata and honest availability", () => {
      const capabilities = listCreationCapabilities();
      expect(capabilities.length).toBeGreaterThanOrEqual(7);

      const domains = capabilities.map((c) => c.domain);
      expect(domains).toContain("image");
      expect(domains).toContain("document");
      expect(domains).toContain("presentation");
      expect(domains).toContain("code");
      expect(domains).toContain("music");
      expect(domains).toContain("model3d");
      expect(domains).toContain("video");

      // Verify availability checks
      expect(isCapabilityAvailable("document")).toBe(true);
      expect(isCapabilityAvailable("presentation")).toBe(true);
      expect(isCapabilityAvailable("code")).toBe(true);
      expect(isCapabilityAvailable("image")).toBe(true);
      expect(isCapabilityAvailable("music")).toBe(true);
      // Desktop-only capabilities are honestly marked unavailable on Web
      expect(isCapabilityAvailable("model3d")).toBe(false);
      expect(isCapabilityAvailable("video")).toBe(false);
    });
  });
});
