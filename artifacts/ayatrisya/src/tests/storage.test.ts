import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { LocalRepository, storageError } from "../storage/repository";
import { exportBackup, inspectBackup, restoreBackup } from "../storage/backup";
import { validateFile } from "../storage/files";
import { defaultPreferences } from "../storage/types";

const active:LocalRepository[]=[];
function local(){const repo=new LocalRepository(`test-${crypto.randomUUID()}`);active.push(repo);return repo;}
afterEach(async()=>{vi.restoreAllMocks();for(const repo of active.splice(0))await repo.close();});
describe("IndexedDB local repository",()=>{
  it("persists conversations, messages, preferences and edits across reopening",async()=>{
    const name=`test-${crypto.randomUUID()}`;
    const first=new LocalRepository(name);active.push(first);
    const c=await first.createConversation();
    const message=await first.addMessage(c.id,"a private question");
    await first.editMessage(message.id,"edited private question");
    await first.savePreferences({
      theme:"Light",mode:"Savage",onboardingComplete:true,wallpaper:"preset-42",
      personalization:{...defaultPreferences.personalization,tone:"direct",memorySummary:"Learning TypeScript.",useMemory:true},
    });
    await first.close();
    const reopened=new LocalRepository(name);active.push(reopened);
    expect((await reopened.getConversation(c.id))?.title).toBe("a private question");
    expect((await reopened.getMessages(c.id))[0].content).toBe("edited private question");
    expect(await reopened.getPreferences()).toMatchObject({
      theme:"Light",mode:"Savage",onboardingComplete:true,wallpaper:"preset-42",
      personalization:{tone:"direct",memorySummary:"Learning TypeScript.",useMemory:true},
    });
  });
  it("creates, renames, archives and transactionally deletes projects and related content",async()=>{
    const repo=local();const p=await repo.createProject({title:"Project",tags:["local"]});
    const item=await repo.saveItem({title:"Note",kind:"note",content:"Actual note",projectId:p.id});
    const a=await repo.addFile(new File(["hello"],"notes.txt",{type:"text/plain"}),p.id);
    await repo.updateProject(p.id,{title:"Renamed",archived:true});
    expect((await repo.listProjects({archived:true}))[0].title).toBe("Renamed");
    expect(await (await repo.getFile(a.id))?.text()).toBe("hello");
    await repo.deleteProject(p.id);
    expect(await repo.getItem(item.id)).toBeUndefined();
    expect(await repo.getFile(a.id)).toBeUndefined();
    expect((await repo.stats()).projects).toBe(0);
  });
  it("supports history pagination and search from actual records",async()=>{
    const repo=local();for(const title of ["Alpha","Beta","Gamma"])await repo.createConversation(title);
    expect(await repo.listConversations({search:"beta"})).toHaveLength(1);
    expect(await repo.listConversations({limit:1,offset:1})).toHaveLength(1);
  });
  it("separates guest and Firebase owners and copies guest content only on explicit request",async()=>{
    const repo=local();repo.setOwner("guest");const c=await repo.createConversation("Guest");await repo.addMessage(c.id,"guest content");
    const project=await repo.createProject({title:"Guest project"});
    await repo.saveItem({title:"Guest note",kind:"note",projectId:project.id});
    repo.setOwner("firebase:user-a");expect(await repo.listConversations()).toHaveLength(0);
    expect(await repo.copyGuestToCurrent()).toBeGreaterThan(0);
    const imported=(await repo.listConversations())[0];expect(imported.id).not.toBe(c.id);
    expect((await repo.getMessages(imported.id))[0].content).toBe("guest content");
    expect(await repo.copyGuestToCurrent()).toBe(0);
    await repo.clearLocalData();expect(await repo.listConversations()).toHaveLength(0);
    repo.setOwner("guest");expect(await repo.getConversation(c.id)).toBeDefined();
  });
  it("starts without an account and blocks legacy import until sign-in",async()=>{
    const repo=local();
    expect(repo.ownerId).toBe("signed-out");
    await expect(repo.copyGuestToCurrent()).rejects.toThrow("Sign in before importing older browser-local content.");
    repo.setOwner("firebase:user-a");
    expect(await repo.copyGuestToCurrent()).toBe(0);
  });
  it("does not create orphan messages or files and cleans attachment references",async()=>{
    const repo=local();await expect(repo.addMessage("missing","hello")).rejects.toThrow("not found");
    const c=await repo.createConversation();const file=await repo.addFile(new File(["a"],"a.txt",{type:"text/plain"}),null,c.id);
    await repo.addMessage(c.id,"attached","user",[file.id]);
    await repo.deleteAttachment(file.id);
    expect((await repo.getMessages(c.id))[0].attachmentIds).toEqual([]);
    await repo.deleteConversation(c.id);expect(await repo.getMessages(c.id)).toEqual([]);
  });
  it("upgrades an existing v1 database without dropping stored conversations",async()=>{
    const name=`migration-${crypto.randomUUID()}`;
    const v1=await openDB(name,1,{upgrade(db){
      for(const store of ["profiles","conversations","messages","projects","projectItems","attachments","blobs","preferences"]){
        const s=db.createObjectStore(store,{keyPath:["ownerId","id"]});s.createIndex("ownerId","ownerId");
        if(store==="messages")s.createIndex("conversation",["ownerId","conversationId"]);
      }
    }});
    const now=new Date().toISOString();
    await v1.put("conversations",{id:"preserved",ownerId:"guest",title:"Keep me",createdAt:now,updatedAt:now});v1.close();
    const repo=new LocalRepository(name);active.push(repo);repo.setOwner("guest");
    expect((await repo.getConversation("preserved"))?.title).toBe("Keep me");
    expect((await repo.db()).version).toBe(4);
    expect((await repo.db()).objectStoreNames.contains("syncQueue")).toBe(true);
  });
  it("reports storage-quota errors without silently falling back to temporary state",()=>{
    expect(storageError(new DOMException("full","QuotaExceededError")).message).toContain("storage is full");
  });
  it("validates file types, sizes and active content",()=>{
    expect(()=>validateFile({name:"virus.exe",size:20,type:"application/octet-stream"})).toThrow("Unsupported");
    expect(()=>validateFile({name:"empty.txt",size:0,type:"text/plain"})).toThrow("empty");
    expect(()=>validateFile({name:"large.txt",size:11*1024*1024,type:"text/plain"})).toThrow("10 MB");
    expect(()=>validateFile({name:"renamed.txt",size:20,type:"text/html"})).toThrow("Active");
  });
});
describe("validated private backups",()=>{
  it("exports/restores actual text and binary files without losing their references",async()=>{
    const first=local(),second=local();const p=await first.createProject({title:"Project"});
    const c=await first.createConversation();const file=await first.addFile(new File(["binary contents"],"a.txt",{type:"text/plain"}),p.id,c.id);
    await first.savePreferences({wallpaper:"custom",customWallpaperData:"data:image/jpeg;base64,/9j/2Q=",personalization:{...defaultPreferences.personalization,memorySummary:"I prefer practical examples.",useMemory:true}});
    await first.addMessage(c.id,"attached","user",[file.id]);
    await first.saveItem({kind:"document",title:"My doc",content:"document content",projectId:p.id});
    const text=await (await exportBackup(first)).text();
    expect(inspectBackup(text)).toMatchObject({conversations:1,projects:1,attachments:1});
    await restoreBackup(text,"merge",second);
    expect(await (await second.getFile(file.id))!.text()).toBe("binary contents");
    expect((await second.getMessages(c.id))[0].attachmentIds).toEqual([file.id]);
    expect(await second.getPreferences()).toMatchObject({wallpaper:"custom",customWallpaperData:"data:image/jpeg;base64,/9j/2Q=",personalization:{memorySummary:"I prefer practical examples.",useMemory:true}});
    const repeat=await restoreBackup(text,"merge",second);expect(repeat.imported).toBe(0);expect(repeat.skipped).toBeGreaterThan(0);
  });
  it("merge preserves newer local edits; replace affects only the active owner",async()=>{
    const repo=local();const c=await repo.createConversation("Original");const text=await (await exportBackup(repo)).text();
    await repo.renameConversation(c.id,"Local edit");await restoreBackup(text,"merge",repo);
    expect((await repo.getConversation(c.id))?.title).toBe("Local edit");
    repo.setOwner("firebase:other");await repo.createConversation("Other profile");
    repo.setOwner("guest");await restoreBackup(text,"replace",repo);
    expect((await repo.getConversation(c.id))?.title).toBe("Original");
    repo.setOwner("firebase:other");expect((await repo.listConversations())[0].title).toBe("Other profile");
  });
  it("rejects invalid, duplicate-ID, incompatible and dangling-reference backups before deletion",async()=>{
    const repo=local();await repo.createConversation("Important");const original=await (await exportBackup(repo)).text();
    for(const malformed of ["not json",JSON.stringify({...JSON.parse(original),version:99})]){
      await expect(restoreBackup(malformed,"replace",repo)).rejects.toThrow();
      expect(await repo.listConversations()).toHaveLength(1);
    }
    const duplicate=JSON.parse(original);duplicate.conversations.push(duplicate.conversations[0]);
    await expect(restoreBackup(JSON.stringify(duplicate),"replace",repo)).rejects.toThrow("duplicate");
    const orphan=JSON.parse(original);orphan.messages.push({id:"m",ownerId:"guest",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),conversationId:"missing",role:"user",content:"x",attachmentIds:[]});
    await expect(restoreBackup(JSON.stringify(orphan),"replace",repo)).rejects.toThrow("missing");
    expect((await repo.listConversations())[0].title).toBe("Important");
  });
  it("aborts a replace restore on quota failure without deleting existing content",async()=>{
    const repo=local();await repo.createConversation("Do not lose me");
    const text=await (await exportBackup(repo)).text();
    const original=IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype,"put").mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore["put"]>){
      if(this.name==="conversations")throw new DOMException("full","QuotaExceededError");
      return original.apply(this,args);
    });
    await expect(restoreBackup(text,"replace",repo)).rejects.toThrow("storage is full");
    vi.restoreAllMocks();
    expect((await repo.listConversations())[0].title).toBe("Do not lose me");
  });
});
