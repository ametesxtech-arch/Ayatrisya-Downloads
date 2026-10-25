import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import { repository } from "../storage/repository";

function createValidGlbBinary(nodeName = "StylizedCat"): Uint8Array {
  const json = JSON.stringify({
    asset: { version: "2.0", generator: "Ayatrisya 3D Model Generator" },
    scenes: [{ nodes: [0] }],
    nodes: [{ name: nodeName }],
  });
  const jsonEncoded = new TextEncoder().encode(json);
  const pad = (4 - (jsonEncoded.length % 4)) % 4;
  const jsonPadded = new Uint8Array(jsonEncoded.length + pad);
  jsonPadded.set(jsonEncoded);
  for (let i = 0; i < pad; i++) jsonPadded[jsonEncoded.length + i] = 0x20;

  const totalLength = 12 + 8 + jsonPadded.length;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // glTF 2.0 Binary Header (12 bytes)
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);          // Version 2
  view.setUint32(8, totalLength, true);// Total byte length

  // Chunk 0 Header (8 bytes)
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'

  const bytes = new Uint8Array(buffer);
  bytes.set(jsonPadded, 20);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe("Real 3D Model Generation and GLB Export Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully decodes genuine GLB data and validates glTF 2.0 binary structure", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "3d"], attachments: true },
    ]);

    const validGlbBytes = createValidGlbBinary("StylizedCat");
    const validGlbBase64 = bytesToBase64(validGlbBytes);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "stylized-cat.glb",
        mimeType: "model/gltf-binary",
        dataBase64: validGlbBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("3d", "a small stylized cat", {
      model: "v1-fast",
      format: "GLB",
    });

    expect(result.fileName).toBe("stylized-cat.glb");
    expect(result.blob.type).toBe("model/gltf-binary");
    expect(result.blob.size).toBe(validGlbBytes.length);

    // Verify glTF 2.0 header and chunks
    const buf = await result.blob.arrayBuffer();
    const view = new DataView(buf);
    expect(view.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
    expect(view.getUint32(4, true)).toBe(2);          // version 2
    expect(view.getUint32(8, true)).toBe(validGlbBytes.length); // total length
    expect(view.getUint32(16, true)).toBe(0x4e4f534a); // chunk 0 is JSON
  });

  it("supports JSON metadata containing a downloadable file URL", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "3d"], attachments: true },
    ]);

    const validGlbBytes = createValidGlbBinary("DownloadableCat");
    const downloadUrl = "https://models.ayatrisya.example/downloads/cat-asset.glb";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/generate/3d")) {
        return new Response(JSON.stringify({
          fileName: "cat-asset.glb",
          mimeType: "model/gltf-binary",
          fileUrl: downloadUrl,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === downloadUrl) {
        return new Response(validGlbBytes, {
          status: 200,
          headers: { "Content-Type": "model/gltf-binary" },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.generateAsset("3d", "a small stylized cat", {
      model: "v1-fast",
      format: "GLB",
    });

    expect(result.fileName).toBe("cat-asset.glb");
    expect(result.blob.type).toBe("model/gltf-binary");
    expect(result.blob.size).toBe(validGlbBytes.length);
  });

  it("rejects HTML error responses without crashing", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "3d"], attachments: true },
    ]);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      "<!DOCTYPE html><html><body>Error 500: Server Down</body></html>",
      { status: 500, headers: { "Content-Type": "text/html" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.generateAsset("3d", "cat", { model: "v1-fast", format: "GLB" }))
      .rejects.toThrow(/HTML|JSON/);
  });

  it("rejects truncated or corrupted GLB binary data", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "3d"], attachments: true },
    ]);

    const validGlbBytes = createValidGlbBinary("Cat");
    // Truncate to create length mismatch
    const truncatedBytes = validGlbBytes.subarray(0, 24);
    const truncatedBase64 = bytesToBase64(truncatedBytes);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "cat.glb",
        mimeType: "model/gltf-binary",
        dataBase64: truncatedBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.generateAsset("3d", "cat", { model: "v1-fast", format: "GLB" }))
      .rejects.toThrow(/truncated|length/i);
  });

  it("rejects PNG images disguised as GLB models", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "3d"], attachments: true },
    ]);

    const fakePng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    ]);
    const fakeBase64 = bytesToBase64(fakePng);

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        fileName: "cat.glb",
        mimeType: "model/gltf-binary",
        dataBase64: fakeBase64,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.generateAsset("3d", "cat", { model: "v1-fast", format: "GLB" }))
      .rejects.toThrow(/image|signature|magic/i);
  });

  it("rejects output format mismatches with helpful actionable error", async () => {
    const client = new AyatrisyaModelClient();
    vi.spyOn(client, "getModelCapabilities").mockResolvedValue([
      { id: "v1-fast", label: "V1 Fast", available: true, streaming: false, modalities: ["chat", "3d"], attachments: true },
    ]);

    // Requesting PNG for 3D must be cleanly rejected
    await expect(client.generateAsset("3d", "cat", { model: "v1-fast", format: "PNG" as any }))
      .rejects.toThrow(/not supported for 3d generation/i);
  });

  it("persists genuine GLB model to IndexedDB library preserving exact binary", async () => {
    const validGlbBytes = createValidGlbBinary("PersianCat");
    const file = new File([validGlbBytes], "persian-cat.glb", { type: "model/gltf-binary" });

    const saved = await repository.addFile(file);
    expect(saved.name).toBe("persian-cat.glb");
    expect(saved.id).toBeTruthy();
    expect(saved.mimeType).toBe("model/gltf-binary");

    const retrieved = await repository.getFile(saved.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.size).toBe(validGlbBytes.length);

    const retrievedBytes = new Uint8Array(await retrieved!.arrayBuffer());
    expect(retrievedBytes).toEqual(validGlbBytes);
  });
});
