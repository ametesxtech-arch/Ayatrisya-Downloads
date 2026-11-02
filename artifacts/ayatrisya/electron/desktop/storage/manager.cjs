const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const MANIFEST_FILE = "manifest.json";

function resolveDefaultModelsDir(userDataDir) {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return path.join(localAppData, "Ayatrisya", "models");
    }
  } else if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Ayatrisya", "models");
  } else {
    const xdgData = process.env.XDG_DATA_HOME;
    if (xdgData) {
      return path.join(xdgData, "Ayatrisya", "models");
    }
    return path.join(os.homedir(), ".local", "share", "Ayatrisya", "models");
  }
  return path.join(userDataDir || os.tmpdir(), "models");
}

class ModelStorageManager {
  constructor(options = {}) {
    this.userDataDir = options.userDataDir || "";
    this.modelsDir = options.customModelsDir || resolveDefaultModelsDir(this.userDataDir);
    this.manifestPath = path.join(this.modelsDir, MANIFEST_FILE);
    this.manifestCache = null;
  }

  async init() {
    await fs.mkdir(this.modelsDir, { recursive: true });
    await this.loadManifest();
  }

  getModelsDirectory() {
    return this.modelsDir;
  }

  async loadManifest() {
    try {
      const data = await fs.readFile(this.manifestPath, "utf8");
      this.manifestCache = JSON.parse(data);
    } catch (err) {
      this.manifestCache = {
        version: 1,
        modelsDir: this.modelsDir,
        installedModels: {},
        updatedAt: new Date().toISOString(),
      };
      await this.saveManifest();
    }
    return this.manifestCache;
  }

  async saveManifest() {
    if (!this.manifestCache) return;
    this.manifestCache.updatedAt = new Date().toISOString();
    const temp = `${this.manifestPath}.tmp`;
    await fs.mkdir(this.modelsDir, { recursive: true });
    await fs.writeFile(temp, JSON.stringify(this.manifestCache, null, 2), "utf8");
    await fs.rename(temp, this.manifestPath);
  }

  async listInstalledModels() {
    await this.loadManifest();
    const result = [];
    const models = this.manifestCache?.installedModels || {};

    for (const [id, meta] of Object.entries(models)) {
      try {
        const stat = await fs.stat(meta.filePath);
        if (stat.isFile()) {
          result.push({
            ...meta,
            fileSizeBytes: stat.size,
          });
        }
      } catch {
        // File was removed from disk manually
        delete this.manifestCache.installedModels[id];
      }
    }
    await this.saveManifest();
    return result;
  }

  async getInstalledModel(modelId) {
    await this.loadManifest();
    const meta = this.manifestCache?.installedModels[modelId];
    if (!meta) return null;
    try {
      const stat = await fs.stat(meta.filePath);
      if (stat.isFile()) return meta;
    } catch {
      delete this.manifestCache.installedModels[modelId];
      await this.saveManifest();
    }
    return null;
  }

  async recordInstalledModel(metadata) {
    await this.loadManifest();
    this.manifestCache.installedModels[metadata.id] = {
      ...metadata,
      installedAt: metadata.installedAt || new Date().toISOString(),
    };
    await this.saveManifest();
    return this.manifestCache.installedModels[metadata.id];
  }

  async deleteModel(modelId) {
    await this.loadManifest();
    const meta = this.manifestCache?.installedModels[modelId];
    if (meta) {
      try {
        await fs.unlink(meta.filePath);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
      delete this.manifestCache.installedModels[modelId];
      await this.saveManifest();
    }

    // Also remove any leftover .part file
    const partFile = path.join(this.modelsDir, `${modelId}.gguf.part`);
    try {
      await fs.unlink(partFile);
    } catch {}

    return true;
  }

  async verifyModelFile(modelId) {
    const meta = await this.getInstalledModel(modelId);
    if (!meta) return { valid: false, reason: "Model is not recorded in manifest." };

    try {
      const hash = crypto.createHash("sha256");
      const stream = fsSync.createReadStream(meta.filePath);
      for await (const chunk of stream) {
        hash.update(chunk);
      }
      const digest = hash.digest("hex");
      const valid = digest.toLowerCase() === meta.expectedSha256.toLowerCase();
      if (!valid) {
        meta.isCorrupted = true;
        await this.saveManifest();
      }
      return {
        valid,
        computedSha256: digest,
        expectedSha256: meta.expectedSha256,
      };
    } catch (err) {
      return { valid: false, reason: err.message };
    }
  }

  getModelFilePath(modelId, extension = ".gguf") {
    return path.join(this.modelsDir, `${modelId}${extension}`);
  }
}

module.exports = {
  ModelStorageManager,
  resolveDefaultModelsDir,
};
