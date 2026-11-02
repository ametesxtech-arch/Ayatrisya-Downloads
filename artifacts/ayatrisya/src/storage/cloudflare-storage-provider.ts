import type {
  CloudConversation,
  CloudFileMetadata,
  CloudKnowledgeBase,
  CloudMessage,
  CloudSeedMemory,
  CloudStorageExport,
  CloudStorageInventory,
  ICloudStorageProvider,
} from "./cloud-storage-contract";

export class CloudflareStorageProvider implements ICloudStorageProvider {
  constructor(
    private workerBaseUrl: string,
    private getToken: () => Promise<string | null>
  ) {
    this.workerBaseUrl = workerBaseUrl.replace(/\/+$/, "");
  }

  private async fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    if (!token) {
      throw new Error("Sign in with your Ayatrisya account to access cloud storage.");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${this.workerBaseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errJson?.error || `Cloud storage request failed with status ${res.status}.`);
    }

    return res;
  }

  // Conversations & Messages
  async listConversations(ownerId: string, limit = 50, offset = 0): Promise<CloudConversation[]> {
    const res = await this.fetchWithAuth(`/api/storage/conversations?limit=${limit}&offset=${offset}`);
    const data = (await res.json()) as { conversations: CloudConversation[] };
    return data.conversations;
  }

  async getConversation(ownerId: string, id: string): Promise<CloudConversation | null> {
    try {
      const res = await this.fetchWithAuth(`/api/storage/conversations/${id}`);
      return (await res.json()) as CloudConversation;
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw e;
    }
  }

  async createConversation(ownerId: string, input: { title: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean }): Promise<CloudConversation> {
    const res = await this.fetchWithAuth("/api/storage/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as CloudConversation;
  }

  async updateConversation(ownerId: string, id: string, patch: Partial<{ title: string; mode: "Normal" | "Savage" | "Joke"; pinned: boolean; archived: boolean }>): Promise<CloudConversation> {
    const res = await this.fetchWithAuth(`/api/storage/conversations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return (await res.json()) as CloudConversation;
  }

  async deleteConversation(ownerId: string, id: string): Promise<boolean> {
    await this.fetchWithAuth(`/api/storage/conversations/${id}`, { method: "DELETE" });
    return true;
  }

  async listMessages(ownerId: string, conversationId: string): Promise<CloudMessage[]> {
    const res = await this.fetchWithAuth(`/api/storage/conversations/${conversationId}/messages`);
    const data = (await res.json()) as { messages: CloudMessage[] };
    return data.messages;
  }

  async addMessage(ownerId: string, conversationId: string, input: { role: "user" | "assistant"; content: string; attachmentIds?: string[]; modelId?: string }): Promise<CloudMessage> {
    const res = await this.fetchWithAuth(`/api/storage/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as CloudMessage;
  }

  async deleteMessage(ownerId: string, messageId: string): Promise<boolean> {
    await this.fetchWithAuth(`/api/storage/messages/${messageId}`, { method: "DELETE" });
    return true;
  }

  // Knowledge Bases
  async listKnowledgeBases(ownerId: string, limit = 50, offset = 0): Promise<CloudKnowledgeBase[]> {
    const res = await this.fetchWithAuth(`/api/storage/kb?limit=${limit}&offset=${offset}`);
    const data = (await res.json()) as { knowledgeBases: CloudKnowledgeBase[] };
    return data.knowledgeBases;
  }


  async getKnowledgeBase(ownerId: string, id: string): Promise<CloudKnowledgeBase | null> {
    try {
      const res = await this.fetchWithAuth(`/api/storage/kb/${id}`);
      return (await res.json()) as CloudKnowledgeBase;
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw e;
    }
  }

  async createKnowledgeBase(ownerId: string, input: { title: string; description?: string; tags?: string[] }): Promise<CloudKnowledgeBase> {
    const res = await this.fetchWithAuth("/api/storage/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as CloudKnowledgeBase;
  }

  async updateKnowledgeBase(ownerId: string, id: string, patch: Partial<{ title: string; description: string; tags: string[] }>): Promise<CloudKnowledgeBase> {
    const res = await this.fetchWithAuth(`/api/storage/kb/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return (await res.json()) as CloudKnowledgeBase;
  }

  async deleteKnowledgeBase(ownerId: string, id: string): Promise<boolean> {
    await this.fetchWithAuth(`/api/storage/kb/${id}`, { method: "DELETE" });
    return true;
  }

  // Seed Memories
  async listSeeds(ownerId: string, filter?: { kbId?: string; category?: string; pinned?: boolean }, limit = 50, offset = 0): Promise<CloudSeedMemory[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filter?.kbId) params.set("kbId", filter.kbId);
    if (filter?.category) params.set("category", filter.category);
    if (filter?.pinned !== undefined) params.set("pinned", String(filter.pinned));

    const res = await this.fetchWithAuth(`/api/storage/seeds?${params.toString()}`);
    const data = (await res.json()) as { seeds: CloudSeedMemory[] };
    return data.seeds;
  }

  async getSeed(ownerId: string, id: string): Promise<CloudSeedMemory | null> {
    try {
      const res = await this.fetchWithAuth(`/api/storage/seeds/${id}`);
      return (await res.json()) as CloudSeedMemory;
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw e;
    }
  }

  async createSeed(ownerId: string, input: { kbId?: string | null; title: string; category?: CloudSeedMemory["category"]; content: string; confidence?: number; pinned?: boolean }): Promise<CloudSeedMemory> {
    const res = await this.fetchWithAuth("/api/storage/seeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as CloudSeedMemory;
  }

  async updateSeed(ownerId: string, id: string, patch: Partial<{ title: string; category: CloudSeedMemory["category"]; content: string; confidence: number; pinned: boolean; kbId: string | null }>): Promise<CloudSeedMemory> {
    const res = await this.fetchWithAuth(`/api/storage/seeds/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return (await res.json()) as CloudSeedMemory;
  }

  async deleteSeed(ownerId: string, id: string): Promise<boolean> {
    await this.fetchWithAuth(`/api/storage/seeds/${id}`, { method: "DELETE" });
    return true;
  }

  // Cloud Files (R2)
  async listFiles(ownerId: string, limit = 50, offset = 0): Promise<CloudFileMetadata[]> {
    const res = await this.fetchWithAuth(`/api/storage/files?limit=${limit}&offset=${offset}`);
    const data = (await res.json()) as { files: CloudFileMetadata[] };
    return data.files;
  }

  async getFileMetadata(ownerId: string, id: string): Promise<CloudFileMetadata | null> {
    // Inventory or file details
    const files = await this.listFiles(ownerId, 100, 0);
    return files.find((f) => f.id === id) || null;
  }

  async saveFile(ownerId: string, input: { name: string; mimeType: string; data: ArrayBuffer | Uint8Array }): Promise<CloudFileMetadata> {
    const headers = new Headers();
    headers.set("Content-Type", input.mimeType);
    headers.set("X-Filename", encodeURIComponent(input.name));
    headers.set("X-Mimetype", input.mimeType);

    const res = await this.fetchWithAuth("/api/storage/files", {
      method: "POST",
      headers,
      body: input.data as BodyInit,
    });
    return (await res.json()) as CloudFileMetadata;
  }

  async readFile(ownerId: string, id: string): Promise<{ metadata: CloudFileMetadata; data: ArrayBuffer } | null> {
    try {
      const res = await this.fetchWithAuth(`/api/storage/files/${id}`);
      const data = await res.arrayBuffer();
      const meta: CloudFileMetadata = {
        id,
        ownerId,
        name: decodeURIComponent(res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "file"),
        mimeType: res.headers.get("Content-Type") || "application/octet-stream",
        sizeBytes: data.byteLength,
        r2Key: `users/${ownerId}/files/${id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { metadata: meta, data };
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw e;
    }
  }

  async deleteFile(ownerId: string, id: string): Promise<boolean> {
    await this.fetchWithAuth(`/api/storage/files/${id}`, { method: "DELETE" });
    return true;
  }

  // Inventory, Backup & Restore
  async getInventory(ownerId: string): Promise<CloudStorageInventory> {
    const res = await this.fetchWithAuth("/api/storage/inventory");
    const data = (await res.json()) as { inventory: CloudStorageInventory; globalCapacity?: any };
    return {
      ...data.inventory,
      globalCapacity: data.globalCapacity,
    };
  }

  async exportData(ownerId: string): Promise<CloudStorageExport> {
    const res = await this.fetchWithAuth("/api/storage/export");
    return (await res.json()) as CloudStorageExport;
  }

  async importData(ownerId: string, exportPayload: CloudStorageExport): Promise<{ restoredKBs: number; restoredSeeds: number }> {
    const res = await this.fetchWithAuth("/api/storage/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knowledgeBases: exportPayload.knowledgeBases,
        seeds: exportPayload.seeds,
      }),
    });
    const result = (await res.json()) as { restoredKBs: number; restoredSeeds: number };
    return result;
  }
}

