// Ayatrisya Storage & Memory Domain Interfaces
// Provider-Independent Contract for Local (IndexedDB/Desktop) and Cloud (D1/R2)

export interface UserStorageQuota {
  maxBytes: number;        // e.g. 500 MB (524,288,000 bytes) on free tier
  usedBytes: number;       // total bytes of active blobs/files
  maxRecords: number;      // e.g. 10,000 metadata entries
  recordCount: number;     // total records
  tier: "free" | "supporter" | "custom";
}

export interface CloudFileMetadata {
  id: string;              // unique UUID
  ownerId: string;         // verified Firebase UID
  name: string;            // sanitized original filename
  mimeType: string;        // validated MIME type
  sizeBytes: number;       // object size in bytes
  r2Key: string;           // internal storage key e.g. "users/{uid}/files/{id}"
  sha256?: string;         // content digest
  createdAt: string;       // ISO8601
  updatedAt: string;       // ISO8601
}

export interface CloudKnowledgeBase {
  id: string;              // unique UUID
  ownerId: string;         // verified Firebase UID
  title: string;           // title of KB
  description: string;     // overview
  tags: string[];          // searchable tags
  documentCount: number;   // count of associated docs/items
  createdAt: string;
  updatedAt: string;
}

export interface CloudSeedMemory {
  id: string;              // unique UUID
  ownerId: string;         // verified Firebase UID
  kbId?: string | null;    // optional parent Knowledge Base
  title: string;           // summary or topic
  category: "fact" | "preference" | "context" | "instruction" | "code_snippet";
  content: string;         // persistent memory text
  confidence: number;      // 0.0 to 1.0
  pinned: boolean;         // priority retention
  createdAt: string;
  updatedAt: string;
}

export interface GlobalStorageCapacity {
  totalStoredBytes: number;
  maxGlobalBytes: number;
  availableGlobalBytes: number;
  isNearCapacityLimit: boolean;
  isCapacityExhausted: boolean;
  reservedThresholdRatio: number;
}

export interface CloudConversation {
  id: string;              // unique UUID
  ownerId: string;         // verified Firebase UID
  title: string;           // title of conversation
  mode: "Normal" | "Savage" | "Joke";
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CloudMessage {
  id: string;              // unique UUID
  ownerId: string;         // verified Firebase UID
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachmentIds: string[];
  modelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudStorageInventory {
  quota: UserStorageQuota;
  globalCapacity?: GlobalStorageCapacity;
  knowledgeBasesCount: number;
  seedsCount: number;
  filesCount: number;
  conversationsCount?: number;
  totalStorageBytes: number;
  lastBackupAt?: string | null;
}

export interface CloudStorageExport {
  format: "ayatrisya-cloud-export";
  version: 1;
  exportedAt: string;
  ownerId: string;
  knowledgeBases: CloudKnowledgeBase[];
  seeds: CloudSeedMemory[];
  conversations?: CloudConversation[];
  messages?: CloudMessage[];
  files: (Omit<CloudFileMetadata, "r2Key"> & { downloadPath?: string })[];
}

export interface ICloudStorageProvider {
  // Conversations & Messages
  listConversations(ownerId: string, limit?: number, offset?: number): Promise<CloudConversation[]>;
  getConversation(ownerId: string, id: string): Promise<CloudConversation | null>;
  createConversation(ownerId: string, input: { title: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean }): Promise<CloudConversation>;
  updateConversation(ownerId: string, id: string, patch: Partial<{ title: string; mode: "Normal" | "Savage" | "Joke"; pinned: boolean; archived: boolean }>): Promise<CloudConversation>;
  deleteConversation(ownerId: string, id: string): Promise<boolean>;

  listMessages(ownerId: string, conversationId: string): Promise<CloudMessage[]>;
  addMessage(ownerId: string, conversationId: string, input: { role: "user" | "assistant"; content: string; attachmentIds?: string[]; modelId?: string }): Promise<CloudMessage>;
  deleteMessage(ownerId: string, messageId: string): Promise<boolean>;

  // Knowledge Bases
  listKnowledgeBases(ownerId: string, limit?: number, offset?: number): Promise<CloudKnowledgeBase[]>;
  getKnowledgeBase(ownerId: string, id: string): Promise<CloudKnowledgeBase | null>;
  createKnowledgeBase(ownerId: string, input: { title: string; description?: string; tags?: string[] }): Promise<CloudKnowledgeBase>;
  updateKnowledgeBase(ownerId: string, id: string, patch: Partial<{ title: string; description: string; tags: string[] }>): Promise<CloudKnowledgeBase>;
  deleteKnowledgeBase(ownerId: string, id: string): Promise<boolean>;

  // Seed Memories
  listSeeds(ownerId: string, filter?: { kbId?: string; category?: string; pinned?: boolean }, limit?: number, offset?: number): Promise<CloudSeedMemory[]>;
  getSeed(ownerId: string, id: string): Promise<CloudSeedMemory | null>;
  createSeed(ownerId: string, input: { kbId?: string | null; title: string; category?: CloudSeedMemory["category"]; content: string; confidence?: number; pinned?: boolean }): Promise<CloudSeedMemory>;
  updateSeed(ownerId: string, id: string, patch: Partial<{ title: string; category: CloudSeedMemory["category"]; content: string; confidence: number; pinned: boolean; kbId: string | null }>): Promise<CloudSeedMemory>;
  deleteSeed(ownerId: string, id: string): Promise<boolean>;

  // Cloud Files (R2 + D1)
  listFiles(ownerId: string, limit?: number, offset?: number): Promise<CloudFileMetadata[]>;
  getFileMetadata(ownerId: string, id: string): Promise<CloudFileMetadata | null>;
  saveFile(ownerId: string, input: { id?: string; name: string; mimeType: string; data: ArrayBuffer | Uint8Array }): Promise<CloudFileMetadata>;
  readFile(ownerId: string, id: string): Promise<{ metadata: CloudFileMetadata; data: ArrayBuffer | ReadableStream } | null>;
  deleteFile(ownerId: string, id: string): Promise<boolean>;

  // Inventory, Backup & Quotas
  getInventory(ownerId: string): Promise<CloudStorageInventory>;
  exportData(ownerId: string): Promise<CloudStorageExport>;
  importData(ownerId: string, exportPayload: CloudStorageExport): Promise<{ restoredKBs: number; restoredSeeds: number; restoredConversations?: number; restoredMessages?: number }>;
}

