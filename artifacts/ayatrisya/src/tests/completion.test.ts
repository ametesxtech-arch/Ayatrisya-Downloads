import "fake-indexeddb/auto";
import {afterEach,describe,expect,it} from "vitest";
import {LocalRepository} from "../storage/repository";
import {exportBackup,exportConversation,exportProject,restoreBackup} from "../storage/backup";
import {validateFileContent} from "../storage/files";
const opened:LocalRepository[]=[];
function local(){const repo=new LocalRepository(`completion-${crypto.randomUUID()}`);opened.push(repo);return repo;}
afterEach(async()=>{for(const repo of opened)await repo.close();opened.length=0;});
const textFile=(text="real bytes")=>new File([text],"actual.txt",{type:"text/plain"});
describe("complete local data lifecycle",()=>{
  it("persists pin/archive metadata and filters archived history by default",async()=>{
    const repo=local(),a=await repo.createConversation("Z"),b=await repo.createConversation("A");
    await repo.updateConversation(a.id,{pinned:true});expect((await repo.listConversations())[0].id).toBe(a.id);
    expect((await repo.listConversations({sort:"title",pinnedFirst:false})).map(c=>c.title)).toEqual(["A","Z"]);
    await repo.updateConversation(a.id,{archived:true});expect((await repo.listConversations()).map(c=>c.id)).toEqual([b.id]);
    expect((await repo.listConversations({archived:true}))[0]).toMatchObject({id:a.id,pinned:true});
    await repo.updateConversation(a.id,{archived:false});expect((await repo.listConversations()).length).toBe(2);
  });
  it("duplicates a conversation and file bytes with independent IDs",async()=>{
    const repo=local(),conv=await repo.createConversation("Original"),file=await repo.addFile(textFile(),null,conv.id);
    await repo.addMessage(conv.id,"Private","user",[file.id]);
    const copy=await repo.duplicateConversation(conv.id),messages=await repo.getMessages(copy.id);
    expect(copy.id).not.toBe(conv.id);expect(messages[0].content).toBe("Private");expect(messages[0].attachmentIds[0]).not.toBe(file.id);
    await repo.deleteConversation(conv.id);expect(await(await repo.getFile(messages[0].attachmentIds[0]))!.text()).toBe("real bytes");
    expect(await repo.getMessages(copy.id)).toHaveLength(1);
  });
  it("keeps attachment bytes in the Library after individual message deletion",async()=>{
    const repo=local(),conv=await repo.createConversation(),file=await repo.addFile(textFile(),null,conv.id);
    const message=await repo.addMessage(conv.id,"Remove this message","user",[file.id]);
    await repo.deleteMessage(message.id);expect(await repo.getMessages(conv.id)).toEqual([]);expect(await repo.getFile(file.id)).toBeTruthy();
  });
  it("clears a conversation without deleting its record and bulk deletes related content",async()=>{
    const repo=local(),a=await repo.createConversation("A"),b=await repo.createConversation("B"),c=await repo.createConversation("C");
    const file=await repo.addFile(textFile(),null,a.id);await repo.addMessage(a.id,"x","user",[file.id]);
    await repo.clearConversation(a.id);expect(await repo.getConversation(a.id)).toBeTruthy();expect(await repo.getFile(file.id)).toBeUndefined();
    await repo.deleteConversations([a.id,b.id]);expect((await repo.listConversations()).map(row=>row.id)).toEqual([c.id]);
  });
  it("duplicates project content and metadata without sharing file storage IDs",async()=>{
    const repo=local(),project=await repo.createProject({title:"Research",icon:"book",color:"cyan",pinned:true});
    await repo.saveItem({kind:"note",title:"Finding",content:"Independent copy",projectId:project.id});
    const file=await repo.addFile(textFile(),project.id),copy=await repo.duplicateProject(project.id),items=await repo.listItems({projectId:copy.id});
    expect(copy).toMatchObject({icon:"book",color:"cyan",pinned:false});
    expect(items).toHaveLength(2);const copiedFile=items.find(i=>i.kind==="file")!;expect(copiedFile.attachmentId).not.toBe(file.id);
    await repo.deleteProject(project.id);expect(await(await repo.getFile(copiedFile.attachmentId!))!.text()).toBe("real bytes");
  });
  it("retains project content in Library when selected, including file metadata",async()=>{
    const repo=local(),project=await repo.createProject({title:"Retain me"});
    const note=await repo.saveItem({kind:"note",title:"Keep",projectId:project.id}),file=await repo.addFile(textFile(),project.id);
    await repo.deleteProject(project.id,"retain");expect(await repo.getProject(project.id)).toBeUndefined();
    expect((await repo.getItem(note.id))?.projectId).toBeNull();expect((await repo.listAttachments())[0].projectId).toBeNull();expect(await repo.getFile(file.id)).toBeTruthy();
  });
  it("moves file and item associations together and edits actual bytes",async()=>{
    const repo=local(),project=await repo.createProject({title:"Destination"}),file=await repo.addFile(textFile());
    await repo.moveItem(file.id,project.id);expect((await repo.listAttachments())[0].projectId).toBe(project.id);
    await repo.updateTextFile(file.id,"new UTF-8 bytes ✓");expect(await(await repo.getFile(file.id))!.text()).toBe("new UTF-8 bytes ✓");
    expect((await repo.listAttachments())[0].size).toBe(new TextEncoder().encode("new UTF-8 bytes ✓").length);
    await repo.saveItem({id:file.id,kind:"file",title:"A readable title",projectId:null});
    expect((await repo.getItem(file.id))?.attachmentId).toBe(file.id);expect((await repo.listAttachments())[0].projectId).toBeNull();
  });
  it("duplicates items, then bulk deletes originals without harming copies",async()=>{
    const repo=local(),file=await repo.addFile(textFile()),copy=await repo.duplicateItem(file.id),note=await repo.saveItem({kind:"note",title:"Delete"});
    await repo.deleteItems([file.id,note.id]);expect(await repo.listItems()).toHaveLength(1);expect(await(await repo.getFile(copy.attachmentId!))!.text()).toBe("real bytes");
  });
  it("searches conversation bodies, project metadata and item contents by type",async()=>{
    const repo=local(),conv=await repo.createConversation("Discussion");
    await repo.addMessage(conv.id,"Nebula message");await repo.createProject({title:"Plan",tags:["nebula"]});
    await repo.saveItem({kind:"document",title:"Draft",content:"Nebula document"});
    expect((await repo.searchAll("nebula")).map(r=>r.resource).sort()).toEqual(["conversation","item","project"]);
    expect((await repo.searchAll("nebula",{types:["document"]}))[0].href).toContain("/workspace/documents/");
    expect(await repo.searchAll("  ")).toEqual([]);repo.setOwner("other");expect(await repo.searchAll("nebula")).toEqual([]);
  });
  it("exports portable conversation and project backups with real file content",async()=>{
    const repo=local(),project=await repo.createProject({title:"Portable"}),conv=await repo.createConversation("Chat");
    const file=await repo.addFile(textFile(),project.id,conv.id);await repo.addMessage(conv.id,"Message","user",[file.id]);
    const restored=local();await restoreBackup(await(await exportProject(project.id,repo)).text(),"replace",restored);
    expect(await restored.listProjects()).toHaveLength(1);expect(await restored.listConversations()).toHaveLength(0);expect(await(await restored.getFile(file.id))!.text()).toBe("real bytes");
    await restoreBackup(await(await exportConversation(conv.id,repo)).text(),"replace",restored);
    expect(await restored.listConversations()).toHaveLength(1);expect(await restored.listProjects()).toHaveLength(0);
    expect((await restored.getMessages(conv.id))[0].attachmentIds).toEqual([file.id]);
  });
  it("imports old backup versions with additive preference and metadata defaults",async()=>{
    const repo=local(),conv=await repo.createConversation("Legacy");await repo.createProject({title:"Old project"});
    const data=JSON.parse(await(await exportBackup(repo)).text());expect(data.version).toBe(2);data.version=1;
    delete data.conversations[0].pinned;delete data.conversations[0].archived;
    for(const key of ["pinned","color","icon"])delete data.projects[0][key];
    for(const key of ["enterToSend","historySort","historyPinnedFirst","animationIntensity","logoIdle","projectView"])delete data.preferences[key];
    await restoreBackup(JSON.stringify(data),"replace",repo);
    expect(await repo.getConversation(conv.id)).toMatchObject({pinned:false,archived:false});expect((await repo.getPreferences()).enterToSend).toBe(true);
  });
  it("rejects a duplicate transaction atomically if its file bytes are missing",async()=>{
    const repo=local();repo.setOwner("guest");const conv=await repo.createConversation("Incomplete"),file=await repo.addFile(textFile(),null,conv.id);
    await(await repo.db()).delete("blobs",["guest",file.id]);
    await expect(repo.duplicateConversation(conv.id)).rejects.toThrow("missing");expect(await repo.listConversations()).toHaveLength(1);
  });
});
describe("file content validation",()=>{
  it("rejects disguised binary formats, mismatched MIME and invalid UTF-8",async()=>{
    await expect(validateFileContent(new File(["not a PNG"],"photo.png",{type:"image/png"}))).rejects.toThrow("contents");
    await expect(validateFileContent(new File([new Uint8Array([137,80,78,71,13,10,26,10])],"photo.png",{type:"image/jpeg"}))).rejects.toThrow("MIME");
    await expect(validateFileContent(new File([new Uint8Array([255,254])],"note.txt",{type:"text/plain"}))).rejects.toThrow("UTF-8");
  });
  it("validates JSON and refuses models that reference external content",async()=>{
    await expect(validateFileContent(new File(["{bad"],"data.json",{type:"application/json"}))).rejects.toThrow("malformed");
    await expect(validateFileContent(new File([JSON.stringify({asset:{version:"2.0"},buffers:[{uri:"https://example.test/private"}]})],"model.gltf",{type:"model/gltf+json"}))).rejects.toThrow("External");
    await expect(validateFileContent(textFile("valid text ✓"))).resolves.toBeUndefined();
  });
});
