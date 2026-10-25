import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import { repository } from "../storage/repository";

describe("Real AI Image Generation Workflow & Diagnostics", () => {
  const valid1x1PngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzHk9t5gAAAABJRU5ErkJggg==";
  const validJpegBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully parses genuine base64 image data and validates PNG signature", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "cat-on-window.png",
        mimeType: "image/png",
        dataBase64: valid1x1PngBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("image", "A ginger tabby cat on a windowsill", {
      model: "v1-fast",
      format: "PNG",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
    });

    expect(result.fileName).toBe("cat-on-window.png");
    expect(result.blob.type).toBe("image/png");
    expect(result.blob.size).toBeGreaterThan(0);

    // Verify raw bytes have exact PNG magic bytes
    const arrayBuf = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it("successfully parses genuine JPEG image data and validates JPEG signature", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "cat.jpg",
        mimeType: "image/jpeg",
        dataBase64: validJpegBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("image", "A ginger cat", {
      model: "v1-fast",
      format: "JPEG",
      aspectRatio: "1:1",
      width: 512,
      height: 512,
    });

    expect(result.fileName).toBe("cat.jpg");
    expect(result.blob.type).toBe("image/jpeg");
    const arrayBuf = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
  });

  it("rejects responses with mismatched or invalid image signatures", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    // Corrupted data (ASCII text instead of PNG binary signature)
    const corruptBase64 = Buffer.from("NOT_A_VALID_PNG_SIGNATURE").toString("base64");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "fake.png",
        mimeType: "image/png",
        dataBase64: corruptBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )));

    await expect(
      client.generateAsset("image", "A ginger cat", {
        model: "v1-fast",
        format: "PNG",
        aspectRatio: "1:1",
        width: 512,
        height: 512,
      })
    ).rejects.toThrow(/invalid signature/);
  });

  it("rejects empty or corrupt image payloads", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "empty.png",
        mimeType: "image/png",
        dataBase64: "",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )));

    await expect(
      client.generateAsset("image", "A ginger cat", {
        model: "v1-fast",
        format: "PNG",
        aspectRatio: "1:1",
        width: 512,
        height: 512,
      })
    ).rejects.toThrow();
  });

  it("handles provider 503 / 429 quota exhaustion with honest diagnostic error", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    const quotaDiagnostic = "The configured Gemini API key does not have image generation quota on Google AI Free Tier (requests/day limit is 0).";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: quotaDiagnostic }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )));

    await expect(
      client.generateAsset("image", "A ginger cat", {
        model: "v1-fast",
        format: "PNG",
        aspectRatio: "1:1",
        width: 512,
        height: 512,
      })
    ).rejects.toThrow(quotaDiagnostic);
  });

  it("preserves exact image bytes when saving to Library and downloading", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "ginger-cat.png",
        mimeType: "image/png",
        dataBase64: valid1x1PngBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )));

    const generated = await client.generateAsset("image", "ginger cat", {
      model: "v1-fast",
      format: "PNG",
      aspectRatio: "1:1",
      width: 512,
      height: 512,
    });

    // Save to library
    const file = new File([generated.blob], generated.fileName, { type: generated.blob.type });
    const saved = await repository.addFile(file);
    expect(saved.id).toBeTruthy();

    expect(saved.mimeType).toBe("image/png");
    const retrievedBlob = await repository.getFile(saved.id);
    expect(retrievedBlob).toBeTruthy();
    expect(retrievedBlob!.size).toBe(generated.blob.size);

    const retrievedBytes = new Uint8Array(await retrievedBlob!.arrayBuffer());
    const originalBytes = new Uint8Array(await generated.blob.arrayBuffer());
    expect(retrievedBytes).toEqual(originalBytes);
  });

  it("does not report image capability when model only supports chat", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: true, modalities: ["chat"], attachments: true }
    ]);

    await expect(
      client.generateAsset("image", "ginger cat", {
        model: "v1-fast",
        format: "PNG",
        aspectRatio: "1:1",
        width: 512,
        height: 512,
      })
    ).rejects.toThrow(/does not report image generation/);
  });

  it("handles Cloudflare FLUX.1 Schnell JPEG generation output seamlessly", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "ayatrisya-generated.jpg",
        mimeType: "image/jpeg",
        dataBase64: validJpegBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("image", "A cinematic shot of a red panda in an astronaut helmet", {
      model: "v1-fast",
      format: "JPEG",
    });

    expect(result.fileName).toContain(".jpg");
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("persists generated image to a conversation thread and verifies attachment link", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "image"], attachments: true }
    ]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "cloud-generated.png",
        mimeType: "image/png",
        dataBase64: valid1x1PngBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )));

    // 1. Generate image
    const asset = await client.generateAsset("image", "A cyberpunk skyline", {
      model: "v1-fast",
      format: "PNG",
    });

    // 2. Add to repository under a conversation
    const conv = await repository.createConversation("Image test conversation");
    const file = new File([asset.blob], asset.fileName, { type: asset.blob.type });
    const savedFile = await repository.addFile(file, null, conv.id);
    expect(savedFile.id).toBeTruthy();

    // 3. Add assistant message with attachment
    const msg = await repository.addMessage(
      conv.id,
      "Here is your generated image:",
      "assistant",
      [savedFile.id]
    );

    expect(msg.attachmentIds).toContain(savedFile.id);

    // 4. Verify conversation messages
    const convMsgs = await repository.getMessages(conv.id);
    expect(convMsgs.length).toBe(1);
    expect(convMsgs[0].attachmentIds).toContain(savedFile.id);

    // 5. Verify image blob is retrievable
    const blob = await repository.getFile(savedFile.id);
    expect(blob).toBeTruthy();
    expect(blob!.size).toBe(asset.blob.size);
  });
});

