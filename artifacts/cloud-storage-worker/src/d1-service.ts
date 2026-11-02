// D1 Database Service Layer for Ayatrisya Cloud Storage Worker
// Handles KBs, Seeds, Files, Quotas, and Anti-Orphan cleanup

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  FIREBASE_PROJECT_ID?: string;
  SESSION_SECRET?: string;
  DEFAULT_QUOTA_BYTES?: number | string;
  MAX_FILE_BYTES?: number | string;
  GLOBAL_STORAGE_QUOTA_BYTES?: number | string;
  RESERVED_CAPACITY_RATIO?: number | string;
}

export interface GlobalCapacityState {
  totalStoredBytes: number;
  maxGlobalBytes: number;
  reservedThresholdRatio: number;
  reservedThresholdBytes: number;
  isCapacityExhausted: boolean;
  isNearCapacityLimit: boolean;
  availableGlobalBytes: number;
  totalFilesCount: number;
  totalUsersCount: number;
}

export class D1StorageService {
  constructor(
    private db: D1Database,
    private defaultQuotaBytes = 524_288_000,
    private defaultGlobalQuotaBytes = 10_737_418_240, // 10 GB
    private defaultReservedRatio = 0.90 // 90%
  ) {}

  async getGlobalCapacityState(): Promise<GlobalCapacityState> {
    const row = await this.db
      .prepare("SELECT total_stored_bytes, max_global_bytes, reserved_threshold_ratio, total_files_count, total_users_count FROM system_storage_state WHERE id = 'global'")
      .first<{
        total_stored_bytes: number;
        max_global_bytes: number;
        reserved_threshold_ratio: number;
        total_files_count: number;
        total_users_count: number;
      }>();

    const maxGlobalBytes = row ? row.max_global_bytes : this.defaultGlobalQuotaBytes;
    const reservedRatio = row ? row.reserved_threshold_ratio : this.defaultReservedRatio;
    const totalStoredBytes = row ? row.total_stored_bytes : 0;
    const totalFilesCount = row ? row.total_files_count : 0;
    const totalUsersCount = row ? row.total_users_count : 0;

    const reservedThresholdBytes = Math.floor(maxGlobalBytes * reservedRatio);
    const availableGlobalBytes = Math.max(0, maxGlobalBytes - totalStoredBytes);
    const isNearCapacityLimit = totalStoredBytes >= reservedThresholdBytes;
    const isCapacityExhausted = totalStoredBytes >= maxGlobalBytes;

    if (!row) {
      const now = new Date().toISOString();
      await this.db
        .prepare(
          "INSERT OR IGNORE INTO system_storage_state (id, total_stored_bytes, max_global_bytes, reserved_threshold_ratio, total_files_count, total_users_count, updated_at) VALUES ('global', 0, ?, ?, 0, 0, ?)"
        )
        .bind(this.defaultGlobalQuotaBytes, this.defaultReservedRatio, now)
        .run();
    }

    return {
      totalStoredBytes,
      maxGlobalBytes,
      reservedThresholdRatio: reservedRatio,
      reservedThresholdBytes,
      isCapacityExhausted,
      isNearCapacityLimit,
      availableGlobalBytes,
      totalFilesCount,
      totalUsersCount,
    };
  }

  async getOrCreateQuota(ownerId: string): Promise<{
    ownerId: string;
    maxBytes: number;
    usedBytes: number;
    maxRecords: number;
    recordCount: number;
    tier: string;
  }> {
    const row = await this.db
      .prepare("SELECT owner_id, max_bytes, used_bytes, max_records, record_count, tier FROM user_quotas WHERE owner_id = ?")
      .bind(ownerId)
      .first<{
        owner_id: string;
        max_bytes: number;
        used_bytes: number;
        max_records: number;
        record_count: number;
        tier: string;
      }>();

    if (row) {
      return {
        ownerId: row.owner_id,
        maxBytes: row.max_bytes,
        usedBytes: row.used_bytes,
        maxRecords: row.max_records,
        recordCount: row.record_count,
        tier: row.tier,
      };
    }

    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT OR IGNORE INTO user_quotas (owner_id, max_bytes, used_bytes, max_records, record_count, tier, updated_at) VALUES (?, ?, 0, 10000, 0, 'free', ?)"
        )
        .bind(ownerId, this.defaultQuotaBytes, now),
      this.db
        .prepare("UPDATE system_storage_state SET total_users_count = total_users_count + 1, updated_at = ? WHERE id = 'global'")
        .bind(now),
    ]);

    return {
      ownerId,
      maxBytes: this.defaultQuotaBytes,
      usedBytes: 0,
      maxRecords: 10000,
      recordCount: 0,
      tier: "free",
    };
  }


  // Knowledge Bases CRUD
  async listKnowledgeBases(ownerId: string, limit = 50, offset = 0) {
    const lim = Math.min(Math.max(1, limit), 100);
    const off = Math.max(0, offset);
    const result = await this.db
      .prepare("SELECT id, owner_id, title, description, tags, document_count, created_at, updated_at FROM knowledge_bases WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?")
      .bind(ownerId, lim, off)
      .all<{
        id: string;
        owner_id: string;
        title: string;
        description: string;
        tags: string;
        document_count: number;
        created_at: string;
        updated_at: string;
      }>();

    return (result.results || []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      description: r.description,
      tags: JSON.parse(r.tags || "[]") as string[],
      documentCount: r.document_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getKnowledgeBase(ownerId: string, id: string) {
    const r = await this.db
      .prepare("SELECT id, owner_id, title, description, tags, document_count, created_at, updated_at FROM knowledge_bases WHERE owner_id = ? AND id = ?")
      .bind(ownerId, id)
      .first<{
        id: string;
        owner_id: string;
        title: string;
        description: string;
        tags: string;
        document_count: number;
        created_at: string;
        updated_at: string;
      }>();

    if (!r) return null;
    return {
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      description: r.description,
      tags: JSON.parse(r.tags || "[]") as string[],
      documentCount: r.document_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async createKnowledgeBase(ownerId: string, input: { title: string; description?: string; tags?: string[] }) {
    const quota = await this.getOrCreateQuota(ownerId);
    if (quota.recordCount >= quota.maxRecords) {
      throw new Error(`Quota exceeded: maximum record count limit of ${quota.maxRecords} reached.`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify((input.tags || []).slice(0, 30));

    await this.db.batch([
      this.db
        .prepare("INSERT INTO knowledge_bases (id, owner_id, title, description, tags, document_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
        .bind(id, ownerId, input.title.trim().slice(0, 200), (input.description || "").slice(0, 5000), tagsJson, now, now),
      this.db
        .prepare("UPDATE user_quotas SET record_count = record_count + 1, updated_at = ? WHERE owner_id = ?")
        .bind(now, ownerId),
    ]);

    return {
      id,
      ownerId,
      title: input.title.trim().slice(0, 200),
      description: (input.description || "").slice(0, 5000),
      tags: input.tags || [],
      documentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateKnowledgeBase(ownerId: string, id: string, patch: { title?: string; description?: string; tags?: string[] }) {
    const existing = await this.getKnowledgeBase(ownerId, id);
    if (!existing) return null;

    const title = patch.title !== undefined ? patch.title.trim().slice(0, 200) : existing.title;
    const description = patch.description !== undefined ? patch.description.slice(0, 5000) : existing.description;
    const tags = patch.tags !== undefined ? patch.tags.slice(0, 30) : existing.tags;
    const now = new Date().toISOString();

    await this.db
      .prepare("UPDATE knowledge_bases SET title = ?, description = ?, tags = ?, updated_at = ? WHERE owner_id = ? AND id = ?")
      .bind(title, description, JSON.stringify(tags), now, ownerId, id)
      .run();

    return {
      ...existing,
      title,
      description,
      tags,
      updatedAt: now,
    };
  }

  async deleteKnowledgeBase(ownerId: string, id: string) {
    const existing = await this.getKnowledgeBase(ownerId, id);
    if (!existing) return false;

    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare("DELETE FROM knowledge_bases WHERE owner_id = ? AND id = ?").bind(ownerId, id),
      this.db.prepare("UPDATE seed_memories SET kb_id = NULL, updated_at = ? WHERE owner_id = ? AND kb_id = ?").bind(now, ownerId, id),
      this.db.prepare("UPDATE user_quotas SET record_count = MAX(0, record_count - 1), updated_at = ? WHERE owner_id = ?").bind(now, ownerId),
    ]);

    return true;
  }

  // Seed Memories CRUD
  async listSeeds(ownerId: string, filter?: { kbId?: string; category?: string; pinned?: boolean }, limit = 50, offset = 0) {
    const lim = Math.min(Math.max(1, limit), 200);
    const off = Math.max(0, offset);

    let query = "SELECT id, owner_id, kb_id, title, category, content, confidence, pinned, created_at, updated_at FROM seed_memories WHERE owner_id = ?";
    const params: unknown[] = [ownerId];

    if (filter?.kbId) {
      query += " AND kb_id = ?";
      params.push(filter.kbId);
    }
    if (filter?.category) {
      query += " AND category = ?";
      params.push(filter.category);
    }
    if (filter?.pinned !== undefined) {
      query += " AND pinned = ?";
      params.push(filter.pinned ? 1 : 0);
    }

    query += " ORDER BY pinned DESC, updated_at DESC LIMIT ? OFFSET ?";
    params.push(lim, off);

    const result = await this.db.prepare(query).bind(...params).all<{
      id: string;
      owner_id: string;
      kb_id: string | null;
      title: string;
      category: string;
      content: string;
      confidence: number;
      pinned: number;
      created_at: string;
      updated_at: string;
    }>();

    return (result.results || []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      kbId: r.kb_id,
      title: r.title,
      category: r.category as "fact" | "preference" | "context" | "instruction" | "code_snippet",
      content: r.content,
      confidence: r.confidence,
      pinned: r.pinned === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getSeed(ownerId: string, id: string) {
    const r = await this.db
      .prepare("SELECT id, owner_id, kb_id, title, category, content, confidence, pinned, created_at, updated_at FROM seed_memories WHERE owner_id = ? AND id = ?")
      .bind(ownerId, id)
      .first<{
        id: string;
        owner_id: string;
        kb_id: string | null;
        title: string;
        category: string;
        content: string;
        confidence: number;
        pinned: number;
        created_at: string;
        updated_at: string;
      }>();

    if (!r) return null;
    return {
      id: r.id,
      ownerId: r.owner_id,
      kbId: r.kb_id,
      title: r.title,
      category: r.category as "fact" | "preference" | "context" | "instruction" | "code_snippet",
      content: r.content,
      confidence: r.confidence,
      pinned: r.pinned === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async createSeed(ownerId: string, input: {
    kbId?: string | null;
    title: string;
    category?: string;
    content: string;
    confidence?: number;
    pinned?: boolean;
  }) {
    const quota = await this.getOrCreateQuota(ownerId);
    if (quota.recordCount >= quota.maxRecords) {
      throw new Error(`Quota exceeded: maximum record count limit of ${quota.maxRecords} reached.`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = input.category || "fact";
    const confidence = typeof input.confidence === "number" ? Math.max(0, Math.min(1, input.confidence)) : 1.0;
    const pinned = input.pinned ? 1 : 0;

    const batches = [
      this.db
        .prepare("INSERT INTO seed_memories (id, owner_id, kb_id, title, category, content, confidence, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, ownerId, input.kbId || null, input.title.trim().slice(0, 200), category, input.content.slice(0, 50000), confidence, pinned, now, now),
      this.db
        .prepare("UPDATE user_quotas SET record_count = record_count + 1, updated_at = ? WHERE owner_id = ?")
        .bind(now, ownerId),
    ];

    if (input.kbId) {
      batches.push(
        this.db.prepare("UPDATE knowledge_bases SET document_count = document_count + 1, updated_at = ? WHERE owner_id = ? AND id = ?").bind(now, ownerId, input.kbId)
      );
    }

    await this.db.batch(batches);

    return {
      id,
      ownerId,
      kbId: input.kbId || null,
      title: input.title.trim().slice(0, 200),
      category: category as "fact" | "preference" | "context" | "instruction" | "code_snippet",
      content: input.content.slice(0, 50000),
      confidence,
      pinned: pinned === 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateSeed(ownerId: string, id: string, patch: {
    title?: string;
    category?: string;
    content?: string;
    confidence?: number;
    pinned?: boolean;
    kbId?: string | null;
  }) {
    const existing = await this.getSeed(ownerId, id);
    if (!existing) return null;

    const title = patch.title !== undefined ? patch.title.trim().slice(0, 200) : existing.title;
    const category = patch.category !== undefined ? patch.category : existing.category;
    const content = patch.content !== undefined ? patch.content.slice(0, 50000) : existing.content;
    const confidence = typeof patch.confidence === "number" ? Math.max(0, Math.min(1, patch.confidence)) : existing.confidence;
    const pinned = patch.pinned !== undefined ? (patch.pinned ? 1 : 0) : (existing.pinned ? 1 : 0);
    const kbId = patch.kbId !== undefined ? patch.kbId : existing.kbId;
    const now = new Date().toISOString();

    await this.db
      .prepare("UPDATE seed_memories SET title = ?, category = ?, content = ?, confidence = ?, pinned = ?, kb_id = ?, updated_at = ? WHERE owner_id = ? AND id = ?")
      .bind(title, category, content, confidence, pinned, kbId, now, ownerId, id)
      .run();

    return {
      ...existing,
      title,
      category: category as "fact" | "preference" | "context" | "instruction" | "code_snippet",
      content,
      confidence,
      pinned: pinned === 1,
      kbId,
      updatedAt: now,
    };
  }

  async deleteSeed(ownerId: string, id: string) {
    const existing = await this.getSeed(ownerId, id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const batches = [
      this.db.prepare("DELETE FROM seed_memories WHERE owner_id = ? AND id = ?").bind(ownerId, id),
      this.db.prepare("UPDATE user_quotas SET record_count = MAX(0, record_count - 1), updated_at = ? WHERE owner_id = ?").bind(now, ownerId),
    ];

    if (existing.kbId) {
      batches.push(
        this.db.prepare("UPDATE knowledge_bases SET document_count = MAX(0, document_count - 1), updated_at = ? WHERE owner_id = ? AND id = ?").bind(now, ownerId, existing.kbId)
      );
    }

    await this.db.batch(batches);
    return true;
  }

  // Cloud Files (D1 metadata)
  async listFiles(ownerId: string, limit = 50, offset = 0) {
    const lim = Math.min(Math.max(1, limit), 100);
    const off = Math.max(0, offset);

    const result = await this.db
      .prepare("SELECT id, owner_id, name, mime_type, size_bytes, r2_key, sha256, created_at, updated_at FROM cloud_files WHERE owner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .bind(ownerId, lim, off)
      .all<{
        id: string;
        owner_id: string;
        name: string;
        mime_type: string;
        size_bytes: number;
        r2_key: string;
        sha256: string | null;
        created_at: string;
        updated_at: string;
      }>();

    return (result.results || []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      r2Key: r.r2_key,
      sha256: r.sha256 || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getFile(ownerId: string, id: string) {
    const r = await this.db
      .prepare("SELECT id, owner_id, name, mime_type, size_bytes, r2_key, sha256, created_at, updated_at FROM cloud_files WHERE owner_id = ? AND id = ?")
      .bind(ownerId, id)
      .first<{
        id: string;
        owner_id: string;
        name: string;
        mime_type: string;
        size_bytes: number;
        r2_key: string;
        sha256: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!r) return null;
    return {
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      r2Key: r.r2_key,
      sha256: r.sha256 || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async recordFileSaved(ownerId: string, metadata: {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    r2Key: string;
    sha256?: string;
  }) {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare("INSERT INTO cloud_files (id, owner_id, name, mime_type, size_bytes, r2_key, sha256, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(metadata.id, ownerId, metadata.name, metadata.mimeType, metadata.sizeBytes, metadata.r2Key, metadata.sha256 || null, now, now),
      this.db
        .prepare("UPDATE user_quotas SET used_bytes = used_bytes + ?, record_count = record_count + 1, updated_at = ? WHERE owner_id = ?")
        .bind(metadata.sizeBytes, now, ownerId),
      this.db
        .prepare("UPDATE system_storage_state SET total_stored_bytes = total_stored_bytes + ?, total_files_count = total_files_count + 1, updated_at = ? WHERE id = 'global'")
        .bind(metadata.sizeBytes, now),
    ]);
  }

  async recordFileDeleted(ownerId: string, id: string, sizeBytes: number) {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare("DELETE FROM cloud_files WHERE owner_id = ? AND id = ?").bind(ownerId, id),
      this.db
        .prepare("UPDATE user_quotas SET used_bytes = MAX(0, used_bytes - ?), record_count = MAX(0, record_count - 1), updated_at = ? WHERE owner_id = ?")
        .bind(sizeBytes, now, ownerId),
      this.db
        .prepare("UPDATE system_storage_state SET total_stored_bytes = MAX(0, total_stored_bytes - ?), total_files_count = MAX(0, total_files_count - 1), updated_at = ? WHERE id = 'global'")
        .bind(sizeBytes, now),
    ]);
  }

  // Reliable Upload Recovery & Pending Uploads (Anti-Orphan Tracking)
  async createPendingUpload(upload: {
    id: string;
    ownerId: string;
    r2Key: string;
    sizeBytes: number;
    ttlSeconds?: number;
  }) {
    const now = new Date().toISOString();
    const ttl = upload.ttlSeconds || 3600; // 1 hour default
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;

    await this.db
      .prepare(
        "INSERT INTO pending_uploads (id, owner_id, r2_key, size_bytes, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'initiated', ?, ?, ?)"
      )
      .bind(upload.id, upload.ownerId, upload.r2Key, upload.sizeBytes, expiresAt, now, now)
      .run();

    return {
      id: upload.id,
      ownerId: upload.ownerId,
      r2Key: upload.r2Key,
      sizeBytes: upload.sizeBytes,
      status: "initiated",
      expiresAt,
    };
  }

  async updatePendingUploadStatus(id: string, ownerId: string, status: "uploading" | "completed" | "aborted") {
    const now = new Date().toISOString();
    await this.db
      .prepare("UPDATE pending_uploads SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .bind(status, now, id, ownerId)
      .run();
  }

  async finalizePendingUpload(id: string, ownerId: string) {
    await this.db
      .prepare("DELETE FROM pending_uploads WHERE id = ? AND owner_id = ?")
      .bind(id, ownerId)
      .run();
  }

  async getExpiredPendingUploads(limit = 100) {
    const nowSec = Math.floor(Date.now() / 1000);
    const result = await this.db
      .prepare("SELECT id, owner_id, r2_key, size_bytes, status, expires_at FROM pending_uploads WHERE expires_at < ? OR status = 'aborted' LIMIT ?")
      .bind(nowSec, limit)
      .all<{
        id: string;
        owner_id: string;
        r2_key: string;
        size_bytes: number;
        status: string;
        expires_at: number;
      }>();

    return result.results || [];
  }

  async purgePendingUploadRecord(id: string) {
    await this.db.prepare("DELETE FROM pending_uploads WHERE id = ?").bind(id).run();
  }

  // Reconciliation: Recalculate true stored bytes across all files
  async reconcileStorageAccounting(): Promise<{ totalStoredBytes: number; totalFiles: number }> {
    const sumResult = await this.db
      .prepare("SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes, COUNT(*) AS file_count FROM cloud_files")
      .first<{ total_bytes: number; file_count: number }>();

    const totalStoredBytes = sumResult?.total_bytes || 0;
    const totalFiles = sumResult?.file_count || 0;
    const now = new Date().toISOString();

    await this.db
      .prepare(
        "UPDATE system_storage_state SET total_stored_bytes = ?, total_files_count = ?, updated_at = ? WHERE id = 'global'"
      )
      .bind(totalStoredBytes, totalFiles, now)
      .run();

    return { totalStoredBytes, totalFiles };
  }

  // 8. Conversations & Messages
  async listConversations(ownerId: string, limit = 50, offset = 0) {
    const lim = Math.min(Math.max(1, limit), 100);
    const off = Math.max(0, offset);
    const result = await this.db
      .prepare("SELECT id, owner_id, title, mode, pinned, archived, created_at, updated_at FROM cloud_conversations WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?")
      .bind(ownerId, lim, off)
      .all<{
        id: string;
        owner_id: string;
        title: string;
        mode: string;
        pinned: number;
        archived: number;
        created_at: string;
        updated_at: string;
      }>();

    return (result.results || []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      mode: r.mode as "Normal" | "Savage" | "Joke",
      pinned: r.pinned === 1,
      archived: r.archived === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getConversation(ownerId: string, id: string) {
    const r = await this.db
      .prepare("SELECT id, owner_id, title, mode, pinned, archived, created_at, updated_at FROM cloud_conversations WHERE owner_id = ? AND id = ?")
      .bind(ownerId, id)
      .first<{
        id: string;
        owner_id: string;
        title: string;
        mode: string;
        pinned: number;
        archived: number;
        created_at: string;
        updated_at: string;
      }>();

    if (!r) return null;
    return {
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      mode: r.mode as "Normal" | "Savage" | "Joke",
      pinned: r.pinned === 1,
      archived: r.archived === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async createConversation(ownerId: string, input: { title: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean }) {
    const quota = await this.getOrCreateQuota(ownerId);
    if (quota.recordCount >= quota.maxRecords) {
      throw new Error(`Quota exceeded: maximum record count limit of ${quota.maxRecords} reached.`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const mode = input.mode || "Normal";
    const pinned = input.pinned ? 1 : 0;

    await this.db.batch([
      this.db
        .prepare("INSERT INTO cloud_conversations (id, owner_id, title, mode, pinned, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
        .bind(id, ownerId, input.title.trim().slice(0, 200), mode, pinned, now, now),
      this.db
        .prepare("UPDATE user_quotas SET record_count = record_count + 1, updated_at = ? WHERE owner_id = ?")
        .bind(now, ownerId),
    ]);

    return {
      id,
      ownerId,
      title: input.title.trim().slice(0, 200),
      mode: mode as "Normal" | "Savage" | "Joke",
      pinned: pinned === 1,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateConversation(ownerId: string, id: string, patch: { title?: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean; archived?: boolean }) {
    const existing = await this.getConversation(ownerId, id);
    if (!existing) return null;

    const title = patch.title !== undefined ? patch.title.trim().slice(0, 200) : existing.title;
    const mode = patch.mode !== undefined ? patch.mode : existing.mode;
    const pinned = patch.pinned !== undefined ? (patch.pinned ? 1 : 0) : (existing.pinned ? 1 : 0);
    const archived = patch.archived !== undefined ? (patch.archived ? 1 : 0) : (existing.archived ? 1 : 0);
    const now = new Date().toISOString();

    await this.db
      .prepare("UPDATE cloud_conversations SET title = ?, mode = ?, pinned = ?, archived = ?, updated_at = ? WHERE owner_id = ? AND id = ?")
      .bind(title, mode, pinned, archived, now, ownerId, id)
      .run();

    return {
      ...existing,
      title,
      mode,
      pinned: pinned === 1,
      archived: archived === 1,
      updatedAt: now,
    };
  }

  async deleteConversation(ownerId: string, id: string) {
    const existing = await this.getConversation(ownerId, id);
    if (!existing) return false;

    // Count messages that will be deleted to maintain record count
    const msgCountRow = await this.db
      .prepare("SELECT COUNT(*) as cnt FROM cloud_messages WHERE owner_id = ? AND conversation_id = ?")
      .bind(ownerId, id)
      .first<{ cnt: number }>();
    const msgCount = msgCountRow?.cnt || 0;
    const totalRecordsToRemove = 1 + msgCount;

    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare("DELETE FROM cloud_conversations WHERE owner_id = ? AND id = ?").bind(ownerId, id),
      this.db.prepare("DELETE FROM cloud_messages WHERE owner_id = ? AND conversation_id = ?").bind(ownerId, id),
      this.db
        .prepare("UPDATE user_quotas SET record_count = MAX(0, record_count - ?), updated_at = ? WHERE owner_id = ?")
        .bind(totalRecordsToRemove, now, ownerId),
    ]);
    return true;
  }

  async listMessages(ownerId: string, conversationId: string) {
    const result = await this.db
      .prepare("SELECT id, owner_id, conversation_id, role, content, attachment_ids, model_id, created_at, updated_at FROM cloud_messages WHERE owner_id = ? AND conversation_id = ? ORDER BY created_at ASC")
      .bind(ownerId, conversationId)
      .all<{
        id: string;
        owner_id: string;
        conversation_id: string;
        role: string;
        content: string;
        attachment_ids: string;
        model_id: string | null;
        created_at: string;
        updated_at: string;
      }>();

    return (result.results || []).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      conversationId: r.conversation_id,
      role: r.role as "user" | "assistant",
      content: r.content,
      attachmentIds: JSON.parse(r.attachment_ids || "[]") as string[],
      modelId: r.model_id || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async addMessage(ownerId: string, conversationId: string, input: { role: "user" | "assistant"; content: string; attachmentIds?: string[]; modelId?: string }) {
    const quota = await this.getOrCreateQuota(ownerId);
    if (quota.recordCount >= quota.maxRecords) {
      throw new Error(`Quota exceeded: maximum record count limit of ${quota.maxRecords} reached.`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const attachmentIdsJson = JSON.stringify(input.attachmentIds || []);

    await this.db.batch([
      this.db
        .prepare("INSERT INTO cloud_messages (id, owner_id, conversation_id, role, content, attachment_ids, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, ownerId, conversationId, input.role, input.content, attachmentIdsJson, input.modelId || null, now, now),
      this.db
        .prepare("UPDATE cloud_conversations SET updated_at = ? WHERE owner_id = ? AND id = ?")
        .bind(now, ownerId, conversationId),
      this.db
        .prepare("UPDATE user_quotas SET record_count = record_count + 1, updated_at = ? WHERE owner_id = ?")
        .bind(now, ownerId),
    ]);

    return {
      id,
      ownerId,
      conversationId,
      role: input.role,
      content: input.content,
      attachmentIds: input.attachmentIds || [],
      modelId: input.modelId,
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteMessage(ownerId: string, messageId: string) {
    const now = new Date().toISOString();
    const res = await this.db.batch([
      this.db.prepare("DELETE FROM cloud_messages WHERE owner_id = ? AND id = ?").bind(ownerId, messageId),
      this.db
        .prepare("UPDATE user_quotas SET record_count = MAX(0, record_count - 1), updated_at = ? WHERE owner_id = ?")
        .bind(now, ownerId),
    ]);
    return true;
  }
}


