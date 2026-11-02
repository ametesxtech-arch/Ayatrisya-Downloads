export type ChatMode = "Normal" | "Savage" | "Joke";
export type ModelId = "v1-fast" | "v2-best";
export type WorkspaceMode = "standard" | "focus" | "studio" | "developer" | "compact";
export type ItemKind = "note" | "document" | "presentation" | "file" | "task" | "code";
export type PersonalizationTone = "balanced" | "friendly" | "professional" | "direct" | "creative";
export type PersonalizationLength = "concise" | "balanced" | "detailed";
export type PersonalizationFormat = "automatic" | "paragraphs" | "bullets" | "steps";
export type PersonalizationExamples = "when-useful" | "often" | "rarely";
export type PersonalizationClarifying = "when-needed" | "assume" | "ask-first";
export type PersonalizationTechnicality = "accessible" | "balanced" | "technical";
export interface PersonalizationPreferences {
  enabled: boolean;
  useMemory: boolean;
  memorySummary: string;
  instructions: string;
  avoid: string;
  tone: PersonalizationTone;
  length: PersonalizationLength;
  format: PersonalizationFormat;
  examples: PersonalizationExamples;
  clarifying: PersonalizationClarifying;
  technicality: PersonalizationTechnicality;
}
export interface BaseRecord {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Conversation extends BaseRecord { title: string; pinned:boolean; archived:boolean; mode?: ChatMode }
export interface ConversationOptions extends ListOptions {
  archived?:boolean; pinned?:boolean; sort?:"newest"|"oldest"|"title"; pinnedFirst?:boolean;
}
export interface Message extends BaseRecord {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachmentIds: string[];
  modelId?: ModelId;
}
export interface Project extends BaseRecord {
  title: string;
  description: string;
  tags: string[];
  archived: boolean;
  pinned: boolean;
  color: "violet"|"cyan"|"rose"|"amber"|"emerald";
  icon: "folder"|"code"|"book"|"music"|"orbit";
}
export interface ProjectItem extends BaseRecord {
  projectId: string | null;
  kind: ItemKind;
  title: string;
  content: string;
  tags: string[];
  attachmentId?: string;
  completed?: boolean;
}
export interface Attachment extends BaseRecord {
  name: string;
  mimeType: string;
  size: number;
  projectId: string | null;
  conversationId: string | null;
}
export type AnswerStyle =
  | "concise"
  | "detailed"
  | "step-by-step"
  | "teaching"
  | "exam-ready"
  | "examples-first"
  | "creative";

export type ModelDataConsent = "allowed" | "ask" | "disabled";

export interface Preferences {
  theme: "Dark" | "Light" | "Follow system";
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  skipIntro: boolean;
  onboardingComplete: boolean;
  displayName: string;
  language: "English";
  mode: ChatMode;
  model: ModelId;
  enterToSend:boolean;
  historySort:"newest"|"oldest"|"title";
  historyPinnedFirst:boolean;
  animationIntensity:"full"|"subtle"|"none";
  logoIdle:boolean;
  projectView:"grid"|"list";
  workspaceMode: WorkspaceMode;
  homeDensity: "comfortable" | "compact";
  homeSections: { projects: boolean; conversations: boolean; items: boolean };
  recentCommands: string[];
  wallpaper: string;
  customWallpaperData: string;
  syncAcrossDevices: boolean;
  personalization: PersonalizationPreferences;
  answerStyle: AnswerStyle;
  modelDataConsent: ModelDataConsent;
}
export const defaultPreferences: Preferences = {
  theme: "Dark", sidebarCollapsed: false, reducedMotion: false, skipIntro: false,
  onboardingComplete: false, displayName: "", language: "English", mode: "Normal", model: "v1-fast",
  enterToSend:true,historySort:"newest",historyPinnedFirst:true,animationIntensity:"full",logoIdle:false,projectView:"grid",
  workspaceMode:"standard",homeDensity:"comfortable",homeSections:{projects:true,conversations:true,items:true},recentCommands:[],
  wallpaper:"none",customWallpaperData:"",syncAcrossDevices:false,
  personalization:{enabled:true,useMemory:true,memorySummary:"",instructions:"",avoid:"",tone:"balanced",length:"balanced",format:"automatic",examples:"when-useful",clarifying:"when-needed",technicality:"balanced"},
  answerStyle: "detailed",
  modelDataConsent: "allowed",
};
export interface ListOptions { search?: string; offset?: number; limit?: number }
export interface ItemOptions extends ListOptions {
  kind?: ItemKind; projectId?: string | null; sort?: "date" | "name" | "size";
}
export interface SyncOperation extends BaseRecord {
  remoteId?:string;
  kind: "upload" | "delete"; state: "pending" | "failed" | "conflict";
  attempts: number; nextAttemptAt: number; error?: string;
}
export interface SyncMetadata extends BaseRecord {
  remoteId: string; modifiedTime: string; checksum: string; lastSuccessAt: string;
}
export interface SearchResult {
  id:string;title:string;snippet:string;updatedAt:string;type:string;
  href:string;resource:"conversation"|"project"|"item";
}
export interface StorageStats {
  conversations: number; projects: number; items: number; attachments: number;
  usage?: number; quota?: number; persistent: boolean | null;
}

// ==========================================
// Phase 4: Structured AI Memory System
// ==========================================
export type MemoryCategory =
  | "user_preference"
  | "project_context"
  | "conversation_fact"
  | "work_preference"
  | "technical_decision";

export interface MemoryEntry extends BaseRecord {
  category: MemoryCategory;
  content: string;
  sourceConversationId?: string | null;
  projectId?: string | null;
  pinned: boolean;
  temporary: boolean;
  expiresAt?: string | null;
  tags: string[];
}

// ==========================================
// Phase 4: Knowledge Base & Document Chunks
// ==========================================
export interface KnowledgeBase extends BaseRecord {
  name: string;
  description: string;
  tags: string[];
  documentCount: number;
  totalBytes: number;
  isArchived: boolean;
}

export interface KnowledgeDocument extends BaseRecord {
  knowledgeBaseId: string;
  title: string;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  extractedText: string;
  chunkCount: number;
}

export interface KnowledgeChunk extends BaseRecord {
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCountEstimate: number;
  startCharIndex: number;
  endCharIndex: number;
  metadata: {
    documentTitle: string;
    fileName: string;
  };
}

export interface KnowledgeRetrievalMatch {
  chunk: KnowledgeChunk;
  score: number;
  citation: string;
}

// ==========================================
// Phase 4: Portable Knowledge Seeds
// ==========================================
export interface KnowledgeSeedManifest {
  format: "ayatrisya-seed";
  seedVersion: "1.0";
  id: string;
  name: string;
  description: string;
  createdAt: string;
  exportedBy: string;
  checksumSha256: string;
  itemCounts: {
    knowledgeBases: number;
    documents: number;
    chunks: number;
    memories: number;
  };
}

export interface KnowledgeSeedPackage {
  manifest: KnowledgeSeedManifest;
  knowledgeBases: KnowledgeBase[];
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
  memories: MemoryEntry[];
}

