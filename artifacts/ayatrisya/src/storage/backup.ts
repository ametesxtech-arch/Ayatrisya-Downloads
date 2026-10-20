import { z } from "zod";
import { repository, storageError, type LocalRepository } from "./repository";
import { defaultPreferences } from "./types";
import { safeFilename, validateFile, validateFileBytes } from "./files";
import { stores, type StoreName } from "./database";

const text = z.string().max(2000000);
const base = { id: z.string().min(1).max(200), ownerId: z.string().max(200), createdAt: z.string().datetime(), updatedAt: z.string().datetime() };
const tags = z.array(z.string().max(100)).max(30);
const ref = z.string().min(1).max(200);
const title = z.string().trim().min(1).max(200);
const prefsSchema = z.object({
  theme: z.enum(["Dark","Light","Follow system"]), sidebarCollapsed: z.boolean(), reducedMotion: z.boolean(), skipIntro:z.boolean(), onboardingComplete:z.boolean(), displayName:z.string().max(100), language:z.literal("English"), mode:z.enum(["Normal","Savage","Joke"]), model:z.enum(["v1-fast","v2-best"]),
  enterToSend:z.boolean().default(true),historySort:z.enum(["newest","oldest","title"]).default("newest"),historyPinnedFirst:z.boolean().default(true),
  animationIntensity:z.enum(["full","subtle","none"]).default("full"),logoIdle:z.boolean().default(false),projectView:z.enum(["grid","list"]).default("grid"),
  workspaceMode:z.enum(["standard","focus","studio","developer","compact"]).default("standard"),
  homeDensity:z.enum(["comfortable","compact"]).default("comfortable"),
  homeSections:z.object({projects:z.boolean().default(true),conversations:z.boolean().default(true),items:z.boolean().default(true)}).default({projects:true,conversations:true,items:true}),
  recentCommands:z.array(z.string().max(200)).max(20).default([]),
  wallpaper:z.string().regex(/^(none|custom|preset-(?:[0-9]|[1-6][0-9]))$/).default("none"),
  customWallpaperData:z.string().max(1500000).default(""),
  syncAcrossDevices:z.boolean().default(false),
  personalization:z.object({
    enabled:z.boolean().default(true),useMemory:z.boolean().default(true),memorySummary:z.string().max(6000).default(""),
    instructions:z.string().max(2000).default(""),avoid:z.string().max(1000).default(""),
    tone:z.enum(["balanced","friendly","professional","direct","creative"]).default("balanced"),
    length:z.enum(["concise","balanced","detailed"]).default("balanced"),
    format:z.enum(["automatic","paragraphs","bullets","steps"]).default("automatic"),
    examples:z.enum(["when-useful","often","rarely"]).default("when-useful"),
    clarifying:z.enum(["when-needed","assume","ask-first"]).default("when-needed"),
    technicality:z.enum(["accessible","balanced","technical"]).default("balanced"),
  }).default({enabled:true,useMemory:true,memorySummary:"",instructions:"",avoid:"",tone:"balanced",length:"balanced",format:"automatic",examples:"when-useful",clarifying:"when-needed",technicality:"balanced"}),
}).strict();
const backupSchema = z.object({
  format: z.literal("ayatrisya-backup"), version: z.union([z.literal(1),z.literal(2)]), exportedAt: z.string().datetime(),
  preferences: prefsSchema,
  conversations: z.array(z.object({...base,title,pinned:z.boolean().default(false),archived:z.boolean().default(false)}).strict()).max(100000),
  messages: z.array(z.object({...base,conversationId:ref,role:z.enum(["user","assistant"]),content:text,attachmentIds:z.array(ref).max(50),modelId:z.enum(["v1-fast","v2-best"]).optional()}).strict()).max(500000),
  projects: z.array(z.object({...base,title,description:z.string().max(10000),tags,archived:z.boolean(),pinned:z.boolean().default(false),color:z.enum(["violet","cyan","rose","amber","emerald"]).default("violet"),icon:z.enum(["folder","code","book","music","orbit"]).default("folder")}).strict()).max(100000),
  items: z.array(z.object({...base,title,projectId:ref.nullable(),kind:z.enum(["note","document","presentation","file","task","code"]),content:text,tags,attachmentId:ref.optional(),completed:z.boolean().optional()}).strict()).max(100000),
  attachments: z.array(z.object({...base,name:z.string().max(255),mimeType:z.string().max(200),size:z.number().int().positive().max(10485760),projectId:ref.nullable(),conversationId:ref.nullable()}).strict()).max(10000),
  assets: z.array(z.object({id:ref,base64:z.string().max(14000000)}).strict()).max(10000),
}).strict();
type Backup = z.infer<typeof backupSchema>;
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
function parseBackup(input: string): Backup {
  if (new TextEncoder().encode(input).length > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 100 MB import limit.");
  let raw: unknown;
  try { raw = JSON.parse(input); } catch { throw new Error("This file is not valid JSON. No local data was changed."); }
  const result = backupSchema.safeParse(raw);
  if (!result.success) throw new Error("Malformed or incompatible Ayatrisya backup. No local data was changed.");
  const data = result.data;
  const groups = [data.conversations,data.messages,data.projects,data.items,data.attachments,data.assets];
  for (const rows of groups) if (new Set(rows.map(r=>r.id)).size !== rows.length) throw new Error("Backup contains duplicate IDs within a record type.");
  const conversations = new Set(data.conversations.map(r=>r.id));
  const projects = new Set(data.projects.map(r=>r.id));
  const attachments = new Set(data.attachments.map(r=>r.id));
  const assets = new Set(data.assets.map(r=>r.id));
  for (const message of data.messages) if (!conversations.has(message.conversationId) || message.attachmentIds.some(id=>!attachments.has(id))) throw new Error("Backup contains a message with a missing conversation or attachment.");
  for (const item of data.items) if ((item.projectId && !projects.has(item.projectId)) || (item.attachmentId && !attachments.has(item.attachmentId))) throw new Error("Backup contains an item with a missing project or file.");
  for (const attachment of data.attachments) {
    validateFile({name:attachment.name,type:attachment.mimeType,size:attachment.size});
    if (!assets.has(attachment.id) || (attachment.projectId && !projects.has(attachment.projectId)) || (attachment.conversationId && !conversations.has(attachment.conversationId))) throw new Error("Backup is missing a file or its parent record.");
  }
  for (const asset of data.assets) {
    if (!attachments.has(asset.id)) throw new Error("Backup contains an unreferenced file.");
    const attachment = data.attachments.find(a=>a.id===asset.id)!;
    try {
      if (atob(asset.base64).length !== attachment.size) throw new Error("mismatch");
      validateFileBytes({name:attachment.name,size:attachment.size,type:attachment.mimeType},decode(asset.base64));
    } catch { throw new Error("Backup contains corrupt binary data."); }
  }
  return data;
}
function encode(bytes: Uint8Array): string {
  let output = "";
  for (let i=0;i<bytes.length;i+=8192) output += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(output);
}
function decode(value:string) {
  const raw = atob(value); const bytes = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
export async function exportBackup(repo: LocalRepository = repository): Promise<Blob> {
  const owner = repo.ownerId; const tx = (await repo.db()).transaction([...stores],"readonly");
  const read = (store:StoreName) => tx.objectStore(store).index("ownerId").getAll(owner);
  const [conversations,messages,projects,items,attachments,blobs,preferences] = await Promise.all([
    read("conversations"),read("messages"),read("projects"),read("projectItems"),read("attachments"),read("blobs"),tx.objectStore("preferences").get([owner,"ui"]),
  ]);
  await tx.done;
  const assets = await Promise.all(blobs.map(async (row:{id:string;data:Blob}) => ({id:row.id,base64:encode(new Uint8Array(await row.data.arrayBuffer()))})));
  const backup = {format:"ayatrisya-backup",version:2,exportedAt:new Date().toISOString(),preferences:{...defaultPreferences,...preferences?.value},conversations,messages,projects,items,attachments,assets};
  const json = JSON.stringify(backup,null,2);
  parseBackup(json); // Do not emit a backup that cannot be restored by this app.
  return new Blob([json],{type:"application/json"});
}
export function inspectBackup(input:string) {
  const data = parseBackup(input);
  return {conversations:data.conversations.length,projects:data.projects.length,items:data.items.length,attachments:data.attachments.length};
}
export async function exportConversation(id:string,repo:LocalRepository=repository):Promise<Blob>{
  const backup=parseBackup(await(await exportBackup(repo)).text());
  if(!backup.conversations.some(row=>row.id===id))throw new Error("Conversation not found.");
  backup.conversations=backup.conversations.filter(row=>row.id===id);
  backup.messages=backup.messages.filter(row=>row.conversationId===id);
  const wanted=new Set(backup.messages.flatMap(row=>row.attachmentIds));
  backup.attachments=backup.attachments.filter(row=>row.conversationId===id||wanted.has(row.id)).map(row=>({...row,projectId:null,conversationId:id}));
  const files=new Set(backup.attachments.map(row=>row.id));
  backup.items=backup.items.filter(row=>row.attachmentId&&files.has(row.attachmentId)).map(row=>({...row,projectId:null}));
  backup.assets=backup.assets.filter(row=>files.has(row.id));backup.projects=[];backup.preferences=defaultPreferences;
  const json=JSON.stringify(backup,null,2);parseBackup(json);return new Blob([json],{type:"application/json"});
}
export async function exportProject(id:string,repo:LocalRepository=repository):Promise<Blob>{
  const backup=parseBackup(await(await exportBackup(repo)).text());
  if(!backup.projects.some(row=>row.id===id))throw new Error("Project not found.");
  backup.projects=backup.projects.filter(row=>row.id===id);backup.conversations=[];backup.messages=[];
  backup.items=backup.items.filter(row=>row.projectId===id);
  const wanted=new Set(backup.items.flatMap(row=>row.attachmentId?[row.attachmentId]:[]));
  backup.attachments=backup.attachments.filter(row=>row.projectId===id||wanted.has(row.id)).map(row=>({...row,projectId:id,conversationId:null}));
  const files=new Set(backup.attachments.map(row=>row.id));backup.assets=backup.assets.filter(row=>files.has(row.id));backup.preferences=defaultPreferences;
  const json=JSON.stringify(backup,null,2);parseBackup(json);return new Blob([json],{type:"application/json"});
}
export async function restoreBackup(input:string, mode:"merge"|"replace", repo:LocalRepository = repository): Promise<{imported:number;skipped:number}> {
  if (mode !== "merge" && mode !== "replace") throw new Error("Choose merge or replace.");
  const data = parseBackup(input); const owner = repo.ownerId;
  // Decode/validate all binary data BEFORE entering the atomic write transaction.
  const assets = data.assets.map(asset => ({...asset,data:new Blob([decode(asset.base64)],{type:data.attachments.find(a=>a.id===asset.id)!.mimeType})}));
  let transaction: {abort():void;done:Promise<void>} | undefined;
  try {
    const tx = (await repo.db()).transaction([...stores],"readwrite");
    transaction = tx;
    if (mode === "replace") for (const name of stores) for (const key of await tx.objectStore(name).index("ownerId").getAllKeys(owner)) await tx.objectStore(name).delete(key);
    let imported = 0, skipped = 0;
    const groups = { conversations:data.conversations,messages:data.messages,projects:data.projects,projectItems:data.items,attachments:data.attachments };
    const keptAttachments = new Set<string>();
    for (const [name,rows] of Object.entries(groups)) for (const record of rows) {
      const store = tx.objectStore(name as StoreName);
      if (mode === "merge" && await store.get([owner,record.id])) { skipped++; if (name === "attachments") keptAttachments.add(record.id); continue; }
      await store.put({...record,ownerId:owner}); imported++;
    }
    for (const asset of assets) if (!keptAttachments.has(asset.id)) await tx.objectStore("blobs").put({id:asset.id,ownerId:owner,data:asset.data});
    if (mode === "replace" || !await tx.objectStore("preferences").get([owner,"ui"])) {
      await tx.objectStore("preferences").put({id:"ui",ownerId:owner,value:data.preferences});
    }
    await tx.done; repo.notify(); return {imported,skipped};
  } catch(e) {
    if(transaction){try{transaction.abort();}catch{/* Already aborted/completed. */}await transaction.done.catch(()=>{});}
    throw storageError(e);
  }
}
export function downloadBlob(blob:Blob, filename:string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = safeFilename(filename);
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
