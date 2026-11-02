import type { LocalRepository } from "./repository";
import type { MemoryCategory, MemoryEntry } from "./types";
import { atomic } from "./resource-operations";

const timestamp = () => new Date().toISOString();

export interface CreateMemoryParams {
  category: MemoryCategory;
  content: string;
  sourceConversationId?: string | null;
  projectId?: string | null;
  pinned?: boolean;
  temporary?: boolean;
  expiresAt?: string | null;
  tags?: string[];
}

export interface UpdateMemoryParams {
  content?: string;
  category?: MemoryCategory;
  pinned?: boolean;
  temporary?: boolean;
  expiresAt?: string | null;
  tags?: string[];
}

export interface ListMemoriesOptions {
  category?: MemoryCategory;
  projectId?: string | null;
  pinnedOnly?: boolean;
  search?: string;
  includeExpired?: boolean;
}

/**
 * Filter out memories that have passed their expiration timestamp.
 */
function isExpired(entry: MemoryEntry): boolean {
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt).getTime() < Date.now();
}

export class MemoryEngine {
  constructor(private repo: LocalRepository) {}

  async createMemory(params: CreateMemoryParams): Promise<MemoryEntry> {
    const content = params.content.trim();
    if (!content || content.length > 5000) {
      throw new Error("Memory content must be between 1 and 5000 characters.");
    }

    const now = timestamp();
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      ownerId: this.repo.ownerId,
      category: params.category,
      content,
      sourceConversationId: params.sourceConversationId || null,
      projectId: params.projectId || null,
      pinned: Boolean(params.pinned),
      temporary: Boolean(params.temporary),
      expiresAt: params.expiresAt || null,
      tags: params.tags ? params.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };

    await atomic(this.repo, ["aiMemories"], async (tx, owner) => {
      await tx.objectStore("aiMemories").put(entry);
    });

    return entry;
  }

  async getMemory(id: string): Promise<MemoryEntry | undefined> {
    const entry = await this.repo.get<MemoryEntry>("aiMemories", id);
    if (!entry) return undefined;
    if (isExpired(entry)) return undefined;
    return entry;
  }

  async listMemories(options: ListMemoriesOptions = {}): Promise<MemoryEntry[]> {
    const owner = this.repo.ownerId;
    const all = await this.repo.all<MemoryEntry>("aiMemories", owner);

    return all.filter((entry) => {
      if (!options.includeExpired && isExpired(entry)) return false;
      if (options.category && entry.category !== options.category) return false;
      if (options.projectId !== undefined && entry.projectId !== options.projectId) return false;
      if (options.pinnedOnly && !entry.pinned) return false;
      if (options.search) {
        const q = options.search.trim().toLowerCase();
        const matchesContent = entry.content.toLowerCase().includes(q);
        const matchesTags = entry.tags.some((t) => t.includes(q));
        if (!matchesContent && !matchesTags) return false;
      }
      return true;
    }).sort((a, b) => {
      // Pinned first, then newest
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async updateMemory(id: string, patch: UpdateMemoryParams): Promise<MemoryEntry> {
    return atomic(this.repo, ["aiMemories"], async (tx, owner) => {
      const existing = (await tx.objectStore("aiMemories").get([owner, id])) as MemoryEntry | undefined;
      if (!existing) throw new Error("Memory entry not found.");

      const updated: MemoryEntry = {
        ...existing,
        content: patch.content !== undefined ? patch.content.trim() : existing.content,
        category: patch.category || existing.category,
        pinned: patch.pinned !== undefined ? patch.pinned : existing.pinned,
        temporary: patch.temporary !== undefined ? patch.temporary : existing.temporary,
        expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
        tags: patch.tags ? patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : existing.tags,
        updatedAt: timestamp(),
      };

      if (!updated.content || updated.content.length > 5000) {
        throw new Error("Memory content must be between 1 and 5000 characters.");
      }

      await tx.objectStore("aiMemories").put(updated);
      return updated;
    });
  }

  async deleteMemory(id: string): Promise<boolean> {
    return atomic(this.repo, ["aiMemories"], async (tx, owner) => {
      const existing = await tx.objectStore("aiMemories").get([owner, id]);
      if (!existing) return false;
      await tx.objectStore("aiMemories").delete([owner, id]);
      return true;
    });
  }

  async clearAllMemories(options: { category?: MemoryCategory; temporaryOnly?: boolean } = {}): Promise<number> {
    return atomic(this.repo, ["aiMemories"], async (tx, owner) => {
      const all = (await tx.objectStore("aiMemories").index("ownerId").getAll(owner)) as MemoryEntry[];
      let deletedCount = 0;
      for (const entry of all) {
        if (options.category && entry.category !== options.category) continue;
        if (options.temporaryOnly && !entry.temporary) continue;
        await tx.objectStore("aiMemories").delete([owner, entry.id]);
        deletedCount++;
      }
      return deletedCount;
    });
  }

  /**
   * Bounded context retrieval: finds relevant memories for a user query and project boundary.
   * Avoids polluting every prompt with unrequested context.
   */
  async retrieveContext(query: string, options: { projectId?: string | null; maxTokens?: number } = {}): Promise<MemoryEntry[]> {
    const maxTokens = options.maxTokens ?? 1000;
    const memories = await this.listMemories({ projectId: options.projectId });
    if (memories.length === 0) return [];

    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const scored = memories.map((m) => {
      let score = 0;
      if (m.pinned) score += 5; // Pinned entries get priority

      const contentLower = m.content.toLowerCase();
      for (const term of terms) {
        if (contentLower.includes(term)) score += 2;
        if (m.tags.includes(term)) score += 3;
      }

      return { entry: m, score };
    });

    // Filter relevant (either pinned or matching keywords)
    const candidates = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const selected: MemoryEntry[] = [];
    let approximateChars = 0;
    const maxChars = maxTokens * 4; // ~4 chars per token estimate

    for (const c of candidates) {
      const entryChars = c.entry.content.length + 50;
      if (approximateChars + entryChars > maxChars) break;
      selected.push(c.entry);
      approximateChars += entryChars;
    }

    return selected;
  }
}

