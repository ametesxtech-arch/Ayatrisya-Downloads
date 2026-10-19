export type ChatMode = "Normal" | "Savage" | "Joke";
export type ModelId = "v1-fast" | "v2-best";
export type ItemKind = "note" | "document" | "presentation" | "file" | "task" | "code";
export interface BaseRecord {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Conversation extends BaseRecord { title: string; pinned:boolean; archived:boolean }
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
}
export const defaultPreferences: Preferences = {
  theme: "Dark", sidebarCollapsed: false, reducedMotion: false, skipIntro: false,
  onboardingComplete: false, displayName: "", language: "English", mode: "Normal", model: "v1-fast",
  enterToSend:true,historySort:"newest",historyPinnedFirst:true,animationIntensity:"full",logoIdle:false,projectView:"grid",
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
