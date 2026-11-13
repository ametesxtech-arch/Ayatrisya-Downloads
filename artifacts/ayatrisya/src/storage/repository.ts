import type { IDBPDatabase } from "idb";
import { openLocalDatabase, stores, type StoreName } from "./database";
import { defaultPreferences, type Attachment, type BaseRecord, type ChatMode, type Conversation, type ConversationOptions, type ItemOptions, type ListOptions, type Message, type Preferences, type Project, type ProjectItem, type StorageStats } from "./types";
import { validateFileContent } from "./files";
import * as operations from "./resource-operations";
import { searchAll } from "./search";
import { generateFallbackTitle } from "@/ai/conversation-title-fallback";

export function storageError(error: unknown): Error {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return new Error("Browser storage is full. Export a backup, then remove unneeded local files and retry.");
  return new Error(error instanceof Error ? error.message : "Local storage could not be accessed. Check browser privacy/storage settings.");
}
const checkedTitle = (title: string) => {
  const value = title.trim();
  if (!value || value.length > 200) throw new Error("Enter a title between 1 and 200 characters.");
  return value;
};
const timestamp = () => new Date().toISOString();
const paginate = <T,>(data: T[], options: ListOptions) => data.slice(Math.max(0, options.offset ?? 0), Math.max(0, options.offset ?? 0) + Math.min(500, Math.max(1, options.limit ?? 30)));

export class LocalRepository {
  ownerId = "signed-out";
  private connection?: Promise<IDBPDatabase>;
  private listeners = new Set<() => void>();
  private channel?: BroadcastChannel;
  constructor(private name = "ayatrisya-local") {
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`${name}-changes`);
      this.channel.onmessage = () => this.emit(false);
    }
  }
  async db() {
    try {
      this.connection ??= openLocalDatabase(this.name);
      return await this.connection;
    } catch (e) {
      this.connection = undefined;
      throw storageError(e);
    }
  }
  async close() { (await this.connection)?.close(); this.channel?.close(); this.connection = undefined; }
  setOwner(ownerId: string) {
    if (!ownerId || ownerId.length > 200) throw new Error("Invalid local profile.");
    this.ownerId = ownerId; this.emit(false);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  notify = () => this.emit();
  private emit(broadcast = true) { this.listeners.forEach(fn => fn()); if (broadcast) this.channel?.postMessage("changed"); }
  private base(): BaseRecord { const now = timestamp(); return { id: crypto.randomUUID(), ownerId: this.ownerId, createdAt: now, updatedAt: now }; }
  async all<T>(store: StoreName, ownerId = this.ownerId): Promise<T[]> { return (await this.db()).getAllFromIndex(store, "ownerId", ownerId); }
  async get<T>(store: StoreName, id: string): Promise<T | undefined> { const owner = this.ownerId; return (await this.db()).get(store, [owner, id]); }
  async put(store: StoreName, record: BaseRecord) {
    try { await (await this.db()).put(store, record); this.emit(); } catch(e) { throw storageError(e); }
  }
  async getPreferences(): Promise<Preferences> {
    const record = await this.get<{ value: Preferences }>("preferences", "ui");
    return {
      ...defaultPreferences,
      ...record?.value,
      homeSections: { ...defaultPreferences.homeSections, ...record?.value?.homeSections },
      personalization: { ...defaultPreferences.personalization, ...record?.value?.personalization },
    };
  }
  async savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    return operations.atomic(this,["preferences"],async(tx,owner)=>{
    const current=await tx.objectStore("preferences").get([owner,"ui"]);
    const value:Preferences = {
      ...defaultPreferences,...current?.value, ...patch,
      personalization: { ...defaultPreferences.personalization, ...current?.value?.personalization, ...patch.personalization },
    };
    if (!["Dark", "Light", "Follow system"].includes(value.theme) || !["Normal", "Savage", "Joke"].includes(value.mode) || !["v1-fast", "v2-best"].includes(value.model) || value.language !== "English" || value.displayName.length > 100)
      throw new Error("Invalid interface preferences.");
    if (value.answerStyle && !["concise", "detailed", "step-by-step", "teaching", "exam-ready", "examples-first", "creative"].includes(value.answerStyle))
      throw new Error("Invalid answer style preference.");
    if (value.modelDataConsent && !["allowed", "ask", "disabled"].includes(value.modelDataConsent))
      throw new Error("Invalid model consent preference.");
    if(!["newest","oldest","title"].includes(value.historySort)||!["full","subtle","none"].includes(value.animationIntensity)||!["grid","list"].includes(value.projectView)||["enterToSend","historyPinnedFirst","logoIdle","reducedMotion","sidebarCollapsed","skipIntro","onboardingComplete","syncAcrossDevices"].some(key=>typeof value[key as keyof Preferences]!=="boolean"))throw new Error("Invalid behavior preferences.");
    if(!["standard","focus","studio","developer","compact"].includes(value.workspaceMode)||!["comfortable","compact"].includes(value.homeDensity)||!value.homeSections||typeof value.homeSections!=="object"||["projects","conversations","items"].some(key=>typeof value.homeSections[key as keyof Preferences["homeSections"]]!=="boolean")||!Array.isArray(value.recentCommands)||value.recentCommands.length>20||value.recentCommands.some(command=>typeof command!=="string"||command.length>200))throw new Error("Invalid workspace preferences.");
    const personalization=value.personalization;
    if(typeof value.wallpaper!=="string"||!(/^(none|custom|preset-(?:[0-9]|[1-6][0-9]))$/.test(value.wallpaper))||typeof value.customWallpaperData!=="string"||value.customWallpaperData.length>1500000||(value.wallpaper==="custom"&&!value.customWallpaperData.startsWith("data:image/jpeg;base64,")))throw new Error("Invalid background preferences.");
    if(!personalization||typeof personalization!=="object"||typeof personalization.enabled!=="boolean"||typeof personalization.useMemory!=="boolean"||typeof personalization.memorySummary!=="string"||personalization.memorySummary.length>6000||typeof personalization.instructions!=="string"||personalization.instructions.length>2000||typeof personalization.avoid!=="string"||personalization.avoid.length>1000||!["balanced","friendly","professional","direct","creative"].includes(personalization.tone)||!["concise","balanced","detailed"].includes(personalization.length)||!["automatic","paragraphs","bullets","steps"].includes(personalization.format)||!["when-useful","often","rarely"].includes(personalization.examples)||!["when-needed","assume","ask-first"].includes(personalization.clarifying)||!["accessible","balanced","technical"].includes(personalization.technicality))throw new Error("Invalid personalization preferences.");
    await tx.objectStore("preferences").put({ ...this.base(), id: "ui", ownerId: owner, value });
    return value;
    });
  }
  async listConversations(options: ConversationOptions = {}): Promise<Conversation[]> {
    const owner=this.ownerId,offset=Math.max(0,options.offset??0),limit=Math.min(500,Math.max(1,options.limit??30));
    const matches=(record:Conversation)=>record.archived===(options.archived??false)&&(options.pinned===undefined||record.pinned===options.pinned)&&record.title.toLowerCase().includes((options.search??"").toLowerCase());
    if(options.pinnedFirst!==false||options.sort==="title"){
      const records=(await this.all<Conversation>("conversations",owner)).filter(matches);
      records.sort((a,b)=>(options.pinnedFirst!==false?Number(b.pinned)-Number(a.pinned):0)||(options.sort==="title"?a.title.localeCompare(b.title):options.sort==="oldest"?a.updatedAt.localeCompare(b.updatedAt):b.updatedAt.localeCompare(a.updatedAt))||a.id.localeCompare(b.id));
      return records.slice(offset,offset+limit);
    }
    const tx=(await this.db()).transaction("conversations","readonly");
    let cursor=await tx.store.index("recent").openCursor(IDBKeyRange.bound([owner,""],[owner,"\uffff"]),options.sort==="oldest"?"next":"prev");
    const result:Conversation[]=[];let matched=0;
    while(cursor&&result.length<limit){
      const record=cursor.value as Conversation;
      if(matches(record)){if(matched>=offset)result.push(record);matched++;}
      cursor=await cursor.continue();
    }
    await tx.done;return result;
  }
  getConversation(id: string) { return this.get<Conversation>("conversations", id); }
  async createConversation(title = "New conversation", mode: ChatMode = "Normal"): Promise<Conversation> {
    const conversation: Conversation = { ...this.base(), title: checkedTitle(title),pinned:false,archived:false, mode };
    await this.put("conversations", conversation); return conversation;
  }
  async renameConversation(id: string, title: string) {
    return this.updateConversation(id, { title: checkedTitle(title), manualTitle: true });
  }
  updateConversation(id: string, patch: Partial<Pick<Conversation, "title" | "pinned" | "archived" | "mode" | "autoTitled" | "manualTitle">>) {
    return operations.updateConversation(this, id, patch);
  }
  deleteConversations(ids:string[]){return operations.removeConversations(this,ids);}
  clearConversation(id:string){return operations.removeConversations(this,[id],true);}
  deleteMessage(id:string){return operations.deleteMessage(this,id);}
  duplicateConversation(id:string){return operations.duplicateConversation(this,id);}
  duplicateProject(id:string){return operations.duplicateProject(this,id);}
  duplicateItem(id:string,projectId?:string|null){return operations.duplicateItem(this,id,projectId);}
  moveItem(id:string,projectId:string|null){return operations.moveItem(this,id,projectId);}
  updateTextFile(id:string,content:string){return operations.updateTextFile(this,id,content);}
  deleteItems(ids:string[]){return operations.deleteItems(this,ids);}
  searchAll(query:string,options:{types?:string[];limit?:number}={}){return searchAll(this,query,options);}
  async getMessages(conversationId: string): Promise<Message[]> {
    const owner = this.ownerId;
    return (await (await this.db()).getAllFromIndex("messages", "conversation", [owner, conversationId])).sort((a: Message,b: Message) => a.createdAt.localeCompare(b.createdAt));
  }
  async addMessage(conversationId: string, content: string, role: "user" | "assistant" = "user", attachmentIds: string[] = []): Promise<Message> {
    if (content.length > 100000 || (!content.trim() && !attachmentIds.length)) throw new Error("Enter a message of up to 100,000 characters.");
    return operations.atomic(this,["conversations","messages","attachments"],async(tx,owner)=>{
      const conversation=await tx.objectStore("conversations").get([owner,conversationId]);if(!conversation)throw new Error("Conversation not found.");
      for(const id of attachmentIds)if(!await tx.objectStore("attachments").get([owner,id]))throw new Error("An attachment is no longer available locally.");
      const time=new Date(Math.max(Date.now(),Date.parse(conversation.updatedAt)+1)).toISOString();
      const message:Message={...this.base(),ownerId:owner,createdAt:time,updatedAt:time,conversationId,role,content,attachmentIds};
      await tx.objectStore("messages").put(message);

      // Derive title ONLY on the first meaningful user message (Requirements 1, 4, 5)
      const nextTitle =
        role === "user" &&
        conversation.title === "New conversation" &&
        !conversation.autoTitled &&
        !conversation.manualTitle
          ? generateFallbackTitle(content.trim())
          : conversation.title;

      await tx.objectStore("conversations").put({
        ...conversation,
        title: nextTitle,
        updatedAt: message.updatedAt,
      });
      return message;
    });
  }
  async editMessage(id: string, content: string) {
    const message = await this.get<Message>("messages", id);
    if (!message || message.role !== "user") throw new Error("Only your own stored messages can be edited.");
    if (!content.trim() || content.length > 100000) throw new Error("Enter a nonempty message of up to 100,000 characters.");
    await this.put("messages", { ...message, content, updatedAt: timestamp() } as Message);
  }
  async deleteConversation(id: string) {
    return this.deleteConversations([id]);
  }
  async listProjects(options: ListOptions & { archived?: boolean } = {}): Promise<Project[]> {
    return paginate((await this.all<Project>("projects")).filter(p => (options.archived === undefined || p.archived === options.archived) && `${p.title} ${p.description} ${p.tags.join(" ")}`.toLowerCase().includes((options.search ?? "").toLowerCase())).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), { limit: 500, ...options });
  }
  getProject(id: string) { return this.get<Project>("projects", id); }
  async createProject(input: { title: string; description?: string; tags?: string[];color?:Project["color"];icon?:Project["icon"];pinned?:boolean }): Promise<Project> {
    const record: Project = { ...this.base(), title: checkedTitle(input.title), description: (input.description ?? "").slice(0,10000), tags: (input.tags ?? []).slice(0,30), archived: false,pinned:input.pinned??false,color:input.color??"violet",icon:input.icon??"folder" };
    if(!["violet","cyan","rose","amber","emerald"].includes(record.color)||!["folder","code","book","music","orbit"].includes(record.icon))throw new Error("Unsupported project color or icon.");
    await this.put("projects", record); return record;
  }
  async updateProject(id: string, patch: Partial<Pick<Project,"title"|"description"|"tags"|"archived"|"pinned"|"color"|"icon">>) {
    const project = await this.getProject(id); if (!project) throw new Error("Project not found.");
    const record = { ...project, ...patch, updatedAt: timestamp() };
    record.title = checkedTitle(record.title);
    if (record.description.length > 10000 || record.tags.length > 30||record.tags.some(tag=>typeof tag!=="string"||tag.length>100)) throw new Error("Project description or tags are too long.");
    if(typeof record.pinned!=="boolean"||typeof record.archived!=="boolean"||!["violet","cyan","rose","amber","emerald"].includes(record.color)||!["folder","code","book","music","orbit"].includes(record.icon))throw new Error("Invalid project metadata.");
    await this.put("projects", record);
  }
  async deleteProject(id: string,policy:"delete"|"retain"="delete") {
    return operations.deleteProject(this,id,policy);
  }
  async listItems(options: ItemOptions = {}): Promise<ProjectItem[]> {
    const items = (await this.all<ProjectItem>("projectItems")).filter(i => (!options.kind || i.kind === options.kind) && (options.projectId === undefined || i.projectId === options.projectId) && `${i.title} ${i.content} ${i.tags.join(" ")}`.toLowerCase().includes((options.search ?? "").toLowerCase()));
    const sizes = options.sort === "size" ? new Map((await this.listAttachments()).map(a => [a.id,a.size])) : undefined;
    items.sort((a,b) => options.sort === "name" ? a.title.localeCompare(b.title) : sizes ? (sizes.get(b.attachmentId ?? "") ?? 0) - (sizes.get(a.attachmentId ?? "") ?? 0) : b.updatedAt.localeCompare(a.updatedAt));
    return paginate(items, { limit: 500, ...options });
  }
  getItem(id: string) { return this.get<ProjectItem>("projectItems", id); }
  async saveItem(input: {id?: string; title: string; kind: ProjectItem["kind"]; content?: string; projectId?: string|null; tags?: string[]; completed?: boolean; attachmentId?: string}): Promise<ProjectItem> {
    return operations.atomic(this,["projectItems","projects","attachments"],async(tx,owner)=>{
    const old:ProjectItem|undefined = input.id ? await tx.objectStore("projectItems").get([owner,input.id]) : undefined;
    if (input.id && !old) throw new Error("Item no longer exists.");
    if (input.projectId && !await tx.objectStore("projects").get([owner,input.projectId])) throw new Error("Project not found.");
    if (!["note","document","presentation","file","task","code"].includes(input.kind)) throw new Error("Unsupported item kind.");
    if ((input.content?.length ?? 0) > 2000000) throw new Error("Text content must be smaller than 2 million characters.");
    if(input.tags&&(input.tags.length>30||input.tags.some(tag=>typeof tag!=="string"||tag.length>100)))throw new Error("Use up to 30 tags, at most 100 characters each.");
    const item: ProjectItem = { ...this.base(), ...old, ...input,ownerId:owner, id: old?.id ?? this.base().id, title: checkedTitle(input.title), content: input.content ?? old?.content ?? "", projectId: input.projectId === undefined ? old?.projectId ?? null : input.projectId, tags: input.tags ?? old?.tags ?? [], updatedAt: timestamp() };
    if(item.attachmentId){
      const attachment=await tx.objectStore("attachments").get([owner,item.attachmentId]);if(!attachment)throw new Error("File no longer exists.");
      await tx.objectStore("attachments").put({...attachment,projectId:item.projectId,updatedAt:item.updatedAt});
    }
    await tx.objectStore("projectItems").put(item);
    return item;
    });
  }
  async deleteItem(id: string) {
    const item = await this.getItem(id); if (!item) return;
    if (item.attachmentId) return this.deleteAttachment(item.attachmentId);
    await (await this.db()).delete("projectItems", [item.ownerId,id]); this.emit();
  }
  async addFile(file: File, projectId: string|null = null, conversationId: string|null = null): Promise<Attachment> {
    const owner=this.ownerId;await validateFileContent(file);
    if(this.ownerId!==owner)throw new Error("The active account changed. Retry for the current workspace.");
    return operations.atomic(this,["attachments","blobs","projectItems","projects","conversations"],async(tx,owner)=>{
      if (projectId && !await tx.objectStore("projects").get([owner,projectId])) throw new Error("Project not found.");
      if (conversationId && !await tx.objectStore("conversations").get([owner,conversationId])) throw new Error("Conversation not found.");
      const attachment: Attachment = { ...this.base(),ownerId:owner, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, projectId, conversationId };
      await tx.objectStore("attachments").put(attachment);
      await tx.objectStore("blobs").put({ ...attachment, data: file.slice() });
      await tx.objectStore("projectItems").put({
        id: attachment.id, ownerId: attachment.ownerId, createdAt: attachment.createdAt,
        updatedAt: attachment.updatedAt, projectId, title: file.name,
        kind: "file", content: "", tags: [], attachmentId: attachment.id,
      });
      return attachment;
    });
  }
  listAttachments() { return this.all<Attachment>("attachments"); }
  async getFile(id: string): Promise<Blob | undefined> { return (await this.get<{data:Blob}>("blobs",id))?.data; }
  private async removeAttachmentInTransaction(tx: any, id: string, owner: string) {
    await tx.objectStore("attachments").delete([owner,id]);
    await tx.objectStore("blobs").delete([owner,id]);
    for (const item of await tx.objectStore("projectItems").index("ownerId").getAll(owner)) if (item.attachmentId === id) await tx.objectStore("projectItems").delete([owner,item.id]);
    if (tx.objectStoreNames.contains("messages")) {
      for (const message of await tx.objectStore("messages").index("ownerId").getAll(owner)) if (message.attachmentIds.includes(id)) await tx.objectStore("messages").put({ ...message, attachmentIds: message.attachmentIds.filter((a: string) => a !== id) });
    }
  }
  async deleteAttachment(id: string) {
    const owner = this.ownerId; const tx = (await this.db()).transaction(["attachments","blobs","projectItems","messages"],"readwrite");
    await this.removeAttachmentInTransaction(tx,id,owner); await tx.done; this.emit();
  }
  async stats(): Promise<StorageStats & { memories: number; knowledgeBases: number }> {
    const [conversations,projects,items,attachments,memories,kbs] = await Promise.all([
      this.all("conversations"),this.all("projects"),this.all("projectItems"),this.all("attachments"),
      this.all("aiMemories"),this.all("knowledgeBases"),
    ]);
    let estimate: StorageEstimate = {}; let persistent: boolean|null = null;
    if (typeof navigator !== "undefined" && navigator.storage) {
      try { estimate = await navigator.storage.estimate(); persistent = navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch { /* Unsupported estimates are reported as unavailable, not zero. */ }
    }
    return {
      conversations: conversations.length,
      projects: projects.length,
      items: items.length,
      attachments: attachments.length,
      memories: memories.length,
      knowledgeBases: kbs.length,
      usage: estimate.usage,
      quota: estimate.quota,
      persistent,
    };
  }
  async requestPersistence() { return typeof navigator !== "undefined" && !!navigator.storage?.persist ? navigator.storage.persist() : false; }
  async clearLocalData() {
    const owner = this.ownerId; const tx = (await this.db()).transaction([...stores],"readwrite");
    for (const name of stores) for (const key of await tx.objectStore(name).index("ownerId").getAllKeys(owner)) await tx.objectStore(name).delete(key);
    await tx.done; this.emit();
  }
  async copyGuestToCurrent(): Promise<number> {
    const owner = this.ownerId;
    if (owner === "guest" || owner === "signed-out") throw new Error("Sign in before importing older browser-local content.");
    const db = await this.db(); const tx = db.transaction([...stores],"readwrite");
    const pref = await tx.objectStore("profiles").get([owner,"guest-import"]);
    if (pref) { await tx.done; return 0; }
    const mappings = new Map<string,string>(); const source = new Map<StoreName,any[]>();
    for (const name of ["conversations","messages","projects","projectItems","attachments","blobs","aiMemories","knowledgeBases","knowledgeDocuments","knowledgeChunks"] as const) {
      const rows = await tx.objectStore(name).index("ownerId").getAll("guest"); source.set(name,rows);
      for (const row of rows) if (!mappings.has(row.id)) mappings.set(row.id,crypto.randomUUID());
    }
    let count = 0;
    for (const [name,rows] of source) for (const row of rows) {
      const record = { ...row, ownerId: owner, id: mappings.get(row.id) };
      for (const ref of ["projectId","conversationId","attachmentId"]) if (record[ref]) record[ref] = mappings.get(record[ref]);
      if (record.attachmentIds) record.attachmentIds = record.attachmentIds.map((id: string) => mappings.get(id));
      await tx.objectStore(name).put(record); count++;
    }
    await tx.objectStore("profiles").put({ ...this.base(), ownerId: owner, id: "guest-import" });
    await tx.done; this.emit(); return count;
  }
}
export const repository = new LocalRepository();
