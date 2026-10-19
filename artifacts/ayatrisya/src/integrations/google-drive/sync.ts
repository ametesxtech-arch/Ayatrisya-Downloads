import { driveApi } from "./client";
import { exportBackup, exportProject, inspectBackup } from "@/storage/backup";
import { safeFilename } from "@/storage/files";
import { repository } from "@/storage/repository";
import type { Attachment, SyncMetadata, SyncOperation } from "@/storage/types";

export function decideSync(localChecksum:string,remoteChecksum:string|null,lastChecksum:string|null):"upload"|"unchanged"|"conflict" {
  if(!remoteChecksum)return "upload";
  if(localChecksum===remoteChecksum)return "unchanged";
  if(remoteChecksum!==lastChecksum)return "conflict";
  return "upload";
}
export const retryDelay=(attempt:number)=>Math.min(3600000,1000*2**Math.min(attempt,12));
async function checksum(text:string) {
  // Ignore export time: the same records do not become a change merely by exporting.
  const data=JSON.parse(text);delete data.exportedAt;
  for(const field of ["conversations","messages","projects","items","attachments","assets"]) data[field]?.sort((a:{id:string},b:{id:string})=>a.id.localeCompare(b.id));
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(data)));
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function blobChecksum(blob:Blob){
  if(blob.type.includes("json")){try{const text=await blob.text();if(JSON.parse(text).format==="ayatrisya-backup")return checksum(text);}catch{/* Other content is hashed byte-for-byte. */}}
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,"0")).join("");
}
type ResourceStatus={remoteId?:string;lastSuccessAt?:string;state:"local"|"pending"|"failed"|"conflict"|"synced";error?:string};
class DriveSync {
  private running=false;
  private async control(){const record=await repository.get<{paused:boolean}>("syncMetadata","control");return record?.paused??false;}
  async status(){
    const operations=await repository.all<SyncOperation>("syncQueue");
    const metadata=await repository.get<SyncMetadata>("syncMetadata","backup");
    return {configured:driveApi.configured,connected:driveApi.connected,paused:await this.control(),pending:operations.length,lastSuccess:metadata?.lastSuccessAt??null,conflicts:operations.filter(o=>o.state==="conflict").length,message:!driveApi.configured?"Google Drive OAuth is not configured. Backups stay local unless you explicitly connect and sync.":!driveApi.connected?"Disconnected. No content is uploaded.":"Connected for manual backup/restore only. Sync does not run automatically."};
  }
  async connect(){await driveApi.connect();repository.notify();}
  disconnect(){driveApi.disconnect();repository.notify();}
  async pause(){await this.saveControl(true);}
  async resume(){await this.saveControl(false);}
  private async saveControl(paused:boolean){
    const now=new Date().toISOString();
    const control={id:"control",ownerId:repository.ownerId,createdAt:now,updatedAt:now,paused};
    await repository.put("syncMetadata",control);
  }
  async syncNow(){return this.upload(false);}
  private async upload(force:boolean){
    if(this.running)throw new Error("A Drive operation is already running.");
    if(!driveApi.connected)throw new Error("Google Drive is not connected. Nothing was uploaded.");
    if(await this.control())throw new Error("Drive backup is paused. Resume before syncing.");
    this.running=true;const owner=repository.ownerId;
    const now=new Date().toISOString();
    let operation:SyncOperation={id:"backup",ownerId:owner,createdAt:now,updatedAt:now,kind:"upload",state:"pending",attempts:0,nextAttemptAt:0};
    let retryBlocked=false;
    try{
      const previous=await repository.get<SyncOperation>("syncQueue","backup");
      if(!force && previous && previous.nextAttemptAt>Date.now() && previous.state!=="conflict"){retryBlocked=true;throw new Error("A previous operation failed. Wait briefly before retrying.");}
      operation={...operation,...previous,state:"pending",updatedAt:now};
      await repository.put("syncQueue",operation);
      const blob=await exportBackup(),local=await blob.text(),localHash=await checksum(local);
      const root=await driveApi.folder("Ayatrisya"),folder=await driveApi.folder("Backups",root);
      const found=await driveApi.find("workspace-backup.json",folder);
      const remote=found?await driveApi.metadata(found.id):undefined;
      const remoteText=remote?await driveApi.download(remote.id):null;
      if(remoteText)inspectBackup(remoteText);
      const saved=await repository.get<SyncMetadata>("syncMetadata","backup");
      const decision=decideSync(localHash,remoteText?await checksum(remoteText):null,saved?.checksum??null);
      if(decision==="conflict"&&!force){
        operation.state="conflict";operation.error="Remote backup differs from the last confirmed backup. Choose local or remote explicitly.";
        await repository.put("syncQueue",operation);throw new Error(operation.error);
      }
      if(repository.ownerId!==owner)throw new Error("The active account changed. Reconnect and retry for the current profile.");
      const uploaded=decision==="unchanged"&&remote?remote:await driveApi.upload(blob,folder,remote);
      const confirmed=await driveApi.download(uploaded.id);
      if(await checksum(confirmed)!==localHash)throw new Error("Drive returned different backup content after upload. No successful sync was recorded.");
      const completed=new Date().toISOString();
      await repository.put("syncMetadata",{id:"backup",ownerId:owner,createdAt:now,updatedAt:completed,remoteId:uploaded.id,modifiedTime:uploaded.modifiedTime??completed,checksum:localHash,lastSuccessAt:completed} as SyncMetadata);
      await (await repository.db()).delete("syncQueue",[owner,"backup"]);repository.notify();
    }catch(error){
      if(!retryBlocked&&operation.state!=="conflict"){
        operation={...operation,state:"failed",attempts:operation.attempts+1,error:error instanceof Error?error.message:"Drive backup failed.",nextAttemptAt:Date.now()+retryDelay(operation.attempts+1)};
        await repository.put("syncQueue",operation);
      }
      throw error;
    }finally{this.running=false;}
  }
  async downloadRemote():Promise<string>{
    if(!driveApi.connected)throw new Error("Connect Google Drive first.");
    const root=await driveApi.find("Ayatrisya",undefined,"application/vnd.google-apps.folder");
    if(!root)throw new Error("No Ayatrisya backup folder was found.");
    const folder=await driveApi.find("Backups",root.id,"application/vnd.google-apps.folder");
    if(!folder)throw new Error("No Backups folder was found.");
    const file=await driveApi.find("workspace-backup.json",folder.id);
    if(!file)throw new Error("No workspace backup was found.");
    const text=await driveApi.download(file.id);inspectBackup(text);return text;
  }
  async resolveConflict(choice:"local"|"remote"):Promise<string|void>{
    if(choice==="local")return this.upload(true);
    return this.downloadRemote(); // UI must preview and confirm merge/replace; never auto-restore.
  }
  private async itemBlob(id:string):Promise<Blob>{
    const item=await repository.getItem(id);if(!item)throw new Error("Local item no longer exists.");
    if(item.attachmentId){const blob=await repository.getFile(item.attachmentId);if(!blob)throw new Error("File data is not available locally.");return blob;}
    return new Blob([JSON.stringify({format:"ayatrisya-item",version:1,item})],{type:"application/json"});
  }
  private async resourceStatus(key:string,load:()=>Promise<Blob>):Promise<ResourceStatus>{
    const [queued,meta]=await Promise.all([repository.get<SyncOperation>("syncQueue",key),repository.get<SyncMetadata>("syncMetadata",key)]);
    if(queued)return {remoteId:queued.remoteId??meta?.remoteId,lastSuccessAt:meta?.lastSuccessAt,state:queued.state,error:queued.error};
    if(!meta)return {state:"local"};
    const unchanged=meta.checksum===await blobChecksum(await load());
    return {remoteId:meta.remoteId,lastSuccessAt:meta.lastSuccessAt,state:unchanged?"synced":"local"};
  }
  itemStatus(id:string){return this.resourceStatus(`item:${id}`,()=>this.itemBlob(id));}
  projectStatus(id:string){return this.resourceStatus(`project:${id}`,()=>exportProject(id));}
  async syncItem(id:string){return this.uploadItem(id,false);}
  private async uploadItem(id:string,force:boolean){
    const item=await repository.getItem(id);if(!item)throw new Error("Item not found.");
    const attachment=item.attachmentId?await repository.get<Attachment>("attachments",item.attachmentId):undefined;
    const name=attachment?`${id}-${safeFilename(attachment.name)}`:`${id}.json`;
    return this.uploadResource(`item:${id}`,name,"Files",()=>this.itemBlob(id),force);
  }
  syncProject(id:string){return this.uploadResource(`project:${id}`,`${id}.json`,"Projects",()=>exportProject(id),false);}
  private async uploadResource(key:string,name:string,folderName:string,load:()=>Promise<Blob>,force:boolean):Promise<void>{
    if(this.running)throw new Error("A Drive operation is already running.");
    if(!driveApi.connected)throw new Error("Google Drive is not connected. Nothing was uploaded.");
    if(await this.control())throw new Error("Drive sync is paused. Resume before uploading.");
    this.running=true;
    const owner=repository.ownerId,time=new Date().toISOString();
    let operation:SyncOperation={id:key,ownerId:owner,createdAt:time,updatedAt:time,kind:"upload",state:"pending",attempts:0,nextAttemptAt:0};
    let retryBlocked=false;
    try{
      const previous=await repository.get<SyncOperation>("syncQueue",key);
      if(!force&&previous&&previous.nextAttemptAt>Date.now()&&previous.state!=="conflict"){retryBlocked=true;throw new Error("Wait briefly before retrying this failed upload.");}
      operation={...operation,...previous,state:"pending",updatedAt:time};
      await repository.put("syncQueue",operation);
      const blob=await load(),localHash=await blobChecksum(blob);
      const root=await driveApi.folder("Ayatrisya"),folder=await driveApi.folder(folderName,root);
      const saved=await repository.get<SyncMetadata>("syncMetadata",key);
      const found=saved?{id:saved.remoteId}:await driveApi.find(name,folder);
      const remote=found?await driveApi.metadata(found.id):undefined;
      if(remote?.trashed)throw new Error("The Drive copy was deleted. Review that deletion before creating another copy.");
      const remoteBlob=remote?await driveApi.downloadBlob(remote.id):undefined;
      const decision=decideSync(localHash,remoteBlob?await blobChecksum(remoteBlob):null,saved?.checksum??null);
      if(decision==="conflict"&&!force){
        operation.state="conflict";operation.remoteId=remote!.id;operation.error="The Drive version differs from the last confirmed copy. Review both versions.";
        await repository.put("syncQueue",operation);throw new Error(operation.error);
      }
      if(repository.ownerId!==owner)throw new Error("The active account changed. Reconnect for the current workspace.");
      const uploaded=decision==="unchanged"&&remote?remote:await driveApi.uploadContent(name,blob,folder,remote);
      if(await blobChecksum(await driveApi.downloadBlob(uploaded.id))!==localHash)throw new Error("Read-back verification failed. No successful sync was recorded.");
      const completed=new Date().toISOString();
      await repository.put("syncMetadata",{id:key,ownerId:owner,createdAt:time,updatedAt:completed,remoteId:uploaded.id,modifiedTime:uploaded.modifiedTime??completed,checksum:localHash,lastSuccessAt:completed} as SyncMetadata);
      await(await repository.db()).delete("syncQueue",[owner,key]);repository.notify();
    }catch(error){
      if(!retryBlocked&&operation.state!=="conflict")await repository.put("syncQueue",{...operation,state:"failed",attempts:operation.attempts+1,error:error instanceof Error?error.message:"Drive upload failed.",nextAttemptAt:Date.now()+retryDelay(operation.attempts+1)} as SyncOperation);
      throw error;
    }finally{this.running=false;}
  }
  private async downloadResource(key:string):Promise<Blob>{
    if(!driveApi.connected)throw new Error("Connect Google Drive before downloading.");
    const meta=await repository.get<SyncMetadata>("syncMetadata",key),pending=await repository.get<SyncOperation>("syncQueue",key);
    const remoteId=pending?.remoteId??meta?.remoteId;if(!remoteId)throw new Error("No Drive copy is tracked for this item.");
    return driveApi.downloadBlob(remoteId);
  }
  downloadItem(id:string){return this.downloadResource(`item:${id}`);}
  downloadProject(id:string){return this.downloadResource(`project:${id}`);}
  async resolveItemConflict(id:string,choice:"local"|"remote"):Promise<Blob|void>{return choice==="local"?this.uploadItem(id,true):this.downloadItem(id);}
  async resolveProjectConflict(id:string,choice:"local"|"remote"):Promise<Blob|void>{return choice==="local"?this.uploadResource(`project:${id}`,`${id}.json`,"Projects",()=>exportProject(id),true):this.downloadProject(id);}
  private async deleteRemote(key:string):Promise<void>{
    if(this.running)throw new Error("A Drive operation is already running.");
    const owner=repository.ownerId;
    const meta=await repository.get<SyncMetadata>("syncMetadata",key);if(!meta)throw new Error("No confirmed remote copy is tracked.");
    this.running=true;
    const time=new Date().toISOString(),operation:SyncOperation={id:key,ownerId:owner,createdAt:time,updatedAt:time,kind:"delete",state:"pending",attempts:0,nextAttemptAt:0};
    try{
      await repository.put("syncQueue",operation);
      const remote=await driveApi.metadata(meta.remoteId);
      if(repository.ownerId!==owner)throw new Error("The active account changed.");
      if(!remote.trashed)await driveApi.trash(remote.id,remote.etag);
      const tx=(await repository.db()).transaction(["syncMetadata","syncQueue"],"readwrite");
      await tx.objectStore("syncMetadata").delete([owner,key]);await tx.objectStore("syncQueue").delete([owner,key]);await tx.done;repository.notify();
    }catch(error){await repository.put("syncQueue",{...operation,state:"failed",attempts:1,nextAttemptAt:Date.now()+retryDelay(1),error:error instanceof Error?error.message:"Remote deletion failed."} as SyncOperation);throw error;}
    finally{this.running=false;}
  }
  deleteRemoteItem(id:string){return this.deleteRemote(`item:${id}`);}
  deleteRemoteProject(id:string){return this.deleteRemote(`project:${id}`);}
}
export const driveSync = new DriveSync();
