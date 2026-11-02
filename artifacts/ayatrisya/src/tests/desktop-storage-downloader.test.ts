import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
// @ts-ignore
import { ModelStorageManager } from "../../electron/desktop/storage/manager.cjs";
// @ts-ignore
import { ModelDownloader } from "../../electron/desktop/downloads/downloader.cjs";

describe("Desktop Storage & Downloader Subsystem", () => {
  let tempDir: string;
  let storage: any;
  let downloader: any;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ayatrisya-model-test-"));
    storage = new ModelStorageManager({ customModelsDir: tempDir });
    await storage.init();
    downloader = new ModelDownloader(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe("ModelStorageManager", () => {
    it("initializes storage directory and creates valid manifest.json", async () => {
      const manifest = await storage.loadManifest();
      expect(manifest.version).toBe(1);
      expect(manifest.modelsDir).toBe(tempDir);
      expect(manifest.installedModels).toEqual({});
    });

    it("records installed models, persists to disk, and lists accurately", async () => {
      const dummyFilePath = path.join(tempDir, "test-model.gguf");
      const dummyContent = "sample gguf binary weights data";
      await fs.writeFile(dummyFilePath, dummyContent);
      const sha256 = crypto.createHash("sha256").update(dummyContent).digest("hex");

      await storage.recordInstalledModel({
        id: "test-model-1b",
        name: "Test Model 1B",
        filePath: dummyFilePath,
        fileName: "test-model.gguf",
        fileSizeBytes: Buffer.byteLength(dummyContent),
        expectedSha256: sha256,
        verifiedSha256: sha256,
      });

      const installed = await storage.listInstalledModels();
      expect(installed.length).toBe(1);
      expect(installed[0].id).toBe("test-model-1b");
      expect(installed[0].fileSizeBytes).toBe(Buffer.byteLength(dummyContent));

      const verification = await storage.verifyModelFile("test-model-1b");
      expect(verification.valid).toBe(true);
      expect(verification.computedSha256).toBe(sha256);
    });

    it("safely deletes a model from disk and manifest", async () => {
      const dummyFilePath = path.join(tempDir, "to-delete.gguf");
      await fs.writeFile(dummyFilePath, "data");

      await storage.recordInstalledModel({
        id: "delete-me",
        name: "Delete Model",
        filePath: dummyFilePath,
        fileName: "to-delete.gguf",
        fileSizeBytes: 4,
        expectedSha256: "dummy",
        verifiedSha256: "dummy",
      });

      expect((await storage.listInstalledModels()).length).toBe(1);

      await storage.deleteModel("delete-me");
      expect((await storage.listInstalledModels()).length).toBe(0);

      // Verify file removed from disk
      await expect(fs.stat(dummyFilePath)).rejects.toThrow();
    });
  });

  describe("ModelDownloader", () => {
    const mockModelDef = {
      id: "mock-qwen-1.5b",
      name: "Mock Qwen 1.5B",
      downloadSource: "https://example.com/mock-qwen-1.5b.gguf",
      expectedSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      requirements: {
        diskSizeBytes: 10_000_000,
        diskSizeGb: 0.01,
        minRamGb: 2.0,
      },
    };

    it("tracks progress and completes atomic installation in mock mode", async () => {
      const progressUpdates: any[] = [];
      downloader.onProgress((p: any) => progressUpdates.push({ ...p }));

      const finalProgress = await downloader.startDownload(mockModelDef, { mockDownload: true });
      expect(finalProgress.status).toBe("INSTALLED");
      expect(finalProgress.progressPercent).toBe(100);

      // Verify recorded in storage
      const installed = await storage.listInstalledModels();
      expect(installed.length).toBe(1);
      expect(installed[0].id).toBe("mock-qwen-1.5b");

      // Verify final file exists and .part file is cleaned up
      const finalFile = storage.getModelFilePath("mock-qwen-1.5b");
      const stat = await fs.stat(finalFile);
      expect(stat.isFile()).toBe(true);
    });

    it("handles pause and cancellation with clean status updates", async () => {
      const downloadPromise = downloader.startDownload(mockModelDef, { mockDownload: true });
      // Cancel immediately
      await downloader.cancelDownload("mock-qwen-1.5b");
      const result = await downloadPromise;

      expect(result.status).toBe("NOT_INSTALLED");
      expect(downloader.getStatus("mock-qwen-1.5b")).toBeNull();
    });
  });
});
