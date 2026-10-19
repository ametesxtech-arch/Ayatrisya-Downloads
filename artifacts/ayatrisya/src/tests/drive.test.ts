import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({
  configured:true,connected:true,connect:vi.fn(),disconnect:vi.fn(),
  folder:vi.fn(),find:vi.fn(),metadata:vi.fn(),upload:vi.fn(),download:vi.fn(),uploadContent:vi.fn(),downloadBlob:vi.fn(),trash:vi.fn(),
}));
vi.mock("../integrations/google-drive/client",()=>({driveApi:api}));
import { driveSync } from "../integrations/google-drive/sync";
import { repository } from "../storage/repository";
import { exportBackup } from "../storage/backup";
import type { SyncMetadata, SyncOperation } from "../storage/types";
let remote="";
let remoteResource:Blob=new Blob();
beforeEach(async()=>{
  vi.clearAllMocks();
  repository.setOwner("unit-test-drive");
  await repository.clearLocalData();
  await driveSync.resume();
  api.folder.mockResolvedValue("folder-id");
  api.find.mockResolvedValue(null);
  api.metadata.mockResolvedValue({id:"backup-id",modifiedTime:new Date().toISOString(),etag:"version-1"});
  api.upload.mockImplementation(async(blob:Blob)=>{remote=await blob.text();return {id:"backup-id",modifiedTime:new Date().toISOString()};});
  api.download.mockImplementation(async()=>remote);
  api.uploadContent.mockImplementation(async(_name:string,blob:Blob)=>{remoteResource=blob;return {id:"resource-id",modifiedTime:new Date().toISOString()};});
  api.downloadBlob.mockImplementation(async()=>remoteResource);
  api.trash.mockResolvedValue(undefined);
});
describe("explicit per-resource Drive actions with a mocked API",()=>{
  it("uploads actual file bytes, confirms the remote copy, and detects local edits",async()=>{
    const file=await repository.addFile(new File(["real file bytes"],"asset.txt",{type:"text/plain"}));
    expect((await driveSync.itemStatus(file.id)).state).toBe("local");
    await driveSync.syncItem(file.id);
    expect(await remoteResource.text()).toBe("real file bytes");expect(api.uploadContent.mock.calls[0][0]).toContain("asset.txt");
    expect((await driveSync.itemStatus(file.id)).state).toBe("synced");
    await repository.updateTextFile(file.id,"edited bytes");expect((await driveSync.itemStatus(file.id)).state).toBe("local");
    expect(await(await driveSync.downloadItem(file.id)).text()).toBe("real file bytes");
  });
  it("exports complete project content and avoids timestamp-only duplicate uploads",async()=>{
    const project=await repository.createProject({title:"Project"});
    await repository.saveItem({kind:"note",title:"A note",content:"Private data",projectId:project.id});
    await driveSync.syncProject(project.id);expect(JSON.parse(await remoteResource.text()).items[0].content).toBe("Private data");
    expect((await driveSync.projectStatus(project.id)).state).toBe("synced");
    await driveSync.syncProject(project.id);expect(api.uploadContent).toHaveBeenCalledTimes(1);
  });
  it("retains unknown remote conflicts, allows review, and replaces only explicitly",async()=>{
    const item=await repository.saveItem({kind:"note",title:"Local",content:"Local content"});
    remoteResource=new Blob(["different remote bytes"]);api.find.mockResolvedValue({id:"resource-id"});
    await expect(driveSync.syncItem(item.id)).rejects.toThrow("differs");
    expect(api.uploadContent).not.toHaveBeenCalled();expect((await driveSync.itemStatus(item.id)).state).toBe("conflict");
    expect(await(await driveSync.downloadItem(item.id)).text()).toBe("different remote bytes");
    expect((await repository.getItem(item.id))?.content).toBe("Local content");
    await driveSync.resolveItemConflict(item.id,"local");expect(api.uploadContent).toHaveBeenCalledOnce();expect((await driveSync.itemStatus(item.id)).state).toBe("synced");
  });
  it("queues failed per-item uploads with backoff rather than reporting success",async()=>{
    const item=await repository.saveItem({kind:"note",title:"Queued"});api.uploadContent.mockRejectedValue(new Error("Offline"));
    await expect(driveSync.syncItem(item.id)).rejects.toThrow("Offline");
    expect(await repository.get("syncQueue",`item:${item.id}`)).toMatchObject({state:"failed",attempts:1});
    await expect(driveSync.syncItem(item.id)).rejects.toThrow("Wait briefly");expect((await driveSync.itemStatus(item.id)).state).toBe("failed");
  });
  it("deletes a Drive copy only with its current token while retaining local content",async()=>{
    const item=await repository.saveItem({kind:"note",title:"Keep locally"});await driveSync.syncItem(item.id);
    api.metadata.mockResolvedValue({id:"resource-id",etag:"version-current"});
    await driveSync.deleteRemoteItem(item.id);expect(api.trash).toHaveBeenCalledWith("resource-id","version-current");
    expect(await repository.getItem(item.id)).toBeTruthy();expect((await driveSync.itemStatus(item.id)).state).toBe("local");
  });
  it("does not save a success marker when read-back verification fails",async()=>{
    const item=await repository.saveItem({kind:"note",title:"Not confirmed"});api.downloadBlob.mockResolvedValue(new Blob(["wrong bytes"]));
    await expect(driveSync.syncItem(item.id)).rejects.toThrow("verification");
    expect(await repository.get("syncMetadata",`item:${item.id}`)).toBeUndefined();expect((await driveSync.itemStatus(item.id)).state).toBe("failed");
  });
});
afterAll(async()=>{await repository.clearLocalData();await repository.close();});
describe("Drive snapshot queue using a mocked API, never a live Google account",()=>{
  it("records success only after downloaded content confirms the upload",async()=>{
    await repository.createConversation("Local private record");
    await driveSync.syncNow();
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.download).toHaveBeenCalledWith("backup-id");
    expect(await repository.all("syncQueue")).toEqual([]);
    const meta=await repository.get<SyncMetadata>("syncMetadata","backup");
    expect(meta?.remoteId).toBe("backup-id");
    expect(meta?.checksum).toHaveLength(64);
    expect((await driveSync.status()).lastSuccess).toBeTruthy();
  });
  it("keeps a failed operation queued with backoff, not a false success",async()=>{
    api.folder.mockRejectedValue(new Error("Offline"));
    await expect(driveSync.syncNow()).rejects.toThrow("Offline");
    const queued=await repository.get<SyncOperation>("syncQueue","backup");
    expect(queued).toMatchObject({state:"failed",attempts:1});
    expect(queued!.nextAttemptAt).toBeGreaterThan(Date.now());
    expect((await driveSync.status()).lastSuccess).toBeNull();
    expect(api.upload).not.toHaveBeenCalled();
    await expect(driveSync.syncNow()).rejects.toThrow("Wait briefly");
    expect((await repository.get<SyncOperation>("syncQueue","backup"))?.attempts).toBe(1);
  });
  it("retains conflicts and never overwrites an unknown different remote copy",async()=>{
    await repository.createConversation("Remote version");
    remote=await (await exportBackup()).text();
    await repository.clearLocalData();
    await repository.createConversation("Local version");
    api.find.mockResolvedValue({id:"backup-id"});
    await expect(driveSync.syncNow()).rejects.toThrow("differs");
    expect(api.upload).not.toHaveBeenCalled();
    expect(await repository.get("syncQueue","backup")).toMatchObject({state:"conflict"});
    expect((await driveSync.status()).conflicts).toBe(1);
    expect(await driveSync.resolveConflict("remote")).toBe(remote);
    expect((await repository.listConversations())[0].title).toBe("Local version");
  });
  it("persists pause and requires resume before uploading",async()=>{
    await driveSync.pause();
    expect((await driveSync.status()).paused).toBe(true);
    await expect(driveSync.syncNow()).rejects.toThrow("paused");
    expect(api.upload).not.toHaveBeenCalled();
    await driveSync.resume();
    expect((await driveSync.status()).paused).toBe(false);
  });
});
