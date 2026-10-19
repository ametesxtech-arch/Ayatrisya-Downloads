import type { IDBPTransaction } from "idb";
import { type LocalRepository, storageError } from "./repository";
import type { StoreName } from "./database";
import type { Attachment, Conversation, Message, Project, ProjectItem } from "./types";
import { validateFileContent } from "./files";

type Transaction=IDBPTransaction<unknown,StoreName[],"readwrite">;
const allContent:StoreName[]=["conversations","messages","projects","projectItems","attachments","blobs"];
const now=()=>new Date().toISOString();
const copyTitle=(title:string)=>`Copy of ${title}`.slice(0,200);
export async function atomic<T>(repo:LocalRepository,names:StoreName[],run:(tx:Transaction,owner:string)=>Promise<T>):Promise<T>{
  const owner=repo.ownerId,db=await repo.db();
  if(owner!==repo.ownerId)throw new Error("The active account changed. Retry in the current workspace.");
  const tx=db.transaction(names,"readwrite");
  try{const result=await run(tx,owner);await tx.done;repo.notify();return result;}
  catch(error){try{tx.abort();}catch{/* Already aborted. */}await tx.done.catch(()=>{});throw storageError(error);}
}
export async function updateConversation(repo:LocalRepository,id:string,patch:Partial<Pick<Conversation,"title"|"pinned"|"archived">>){
  await atomic(repo,["conversations"],async(tx,owner)=>{
    const old=await tx.objectStore("conversations").get([owner,id]);if(!old)throw new Error("Conversation not found.");
    const value={...old,...patch,updatedAt:now()};
    if(!value.title.trim()||value.title.length>200||typeof value.pinned!=="boolean"||typeof value.archived!=="boolean")throw new Error("Invalid conversation metadata.");
    value.title=value.title.trim();await tx.objectStore("conversations").put(value);
  });
}
export async function removeConversations(repo:LocalRepository,ids:string[],clear=false){
  const selected=new Set(ids);if(!selected.size)return;
  await atomic(repo,allContent,async(tx,owner)=>{
    const attachmentIds=new Set<string>();
    for(const file of await tx.objectStore("attachments").index("ownerId").getAll(owner)){
      if(!selected.has(file.conversationId))continue;
      attachmentIds.add(file.id);
      await tx.objectStore("attachments").delete([owner,file.id]);await tx.objectStore("blobs").delete([owner,file.id]);
    }
    for(const item of await tx.objectStore("projectItems").index("ownerId").getAll(owner))
      if(attachmentIds.has(item.attachmentId))await tx.objectStore("projectItems").delete([owner,item.id]);
    for(const message of await tx.objectStore("messages").index("ownerId").getAll(owner)){
      if(selected.has(message.conversationId))await tx.objectStore("messages").delete([owner,message.id]);
      else if(message.attachmentIds.some((id:string)=>attachmentIds.has(id)))
        await tx.objectStore("messages").put({...message,attachmentIds:message.attachmentIds.filter((id:string)=>!attachmentIds.has(id))});
    }
    for(const id of selected){
      if(clear){const old=await tx.objectStore("conversations").get([owner,id]);if(old)await tx.objectStore("conversations").put({...old,updatedAt:now()});}
      else await tx.objectStore("conversations").delete([owner,id]);
    }
  });
}
export async function deleteMessage(repo:LocalRepository,id:string){
  await atomic(repo,["messages","conversations"],async(tx,owner)=>{
    const message=await tx.objectStore("messages").get([owner,id]);if(!message)throw new Error("Message not found.");
    await tx.objectStore("messages").delete([owner,id]);
    const conversation=await tx.objectStore("conversations").get([owner,message.conversationId]);
    if(conversation)await tx.objectStore("conversations").put({...conversation,updatedAt:now()});
  });
}
async function cloneFile(tx:Transaction,owner:string,source:Attachment,projectId:string|null,conversationId:string|null){
  const blob=await tx.objectStore("blobs").get([owner,source.id]);if(!blob?.data)throw new Error("A file is missing locally. No copy was created.");
  const id=crypto.randomUUID(),time=now();
  const attachment={...source,id,ownerId:owner,createdAt:time,updatedAt:time,projectId,conversationId};
  await tx.objectStore("attachments").put(attachment);
  await tx.objectStore("blobs").put({id,ownerId:owner,data:blob.data});
  const original=await tx.objectStore("projectItems").get([owner,source.id]);
  const item:ProjectItem={id,ownerId:owner,createdAt:time,updatedAt:time,projectId,kind:"file",title:original?.title??source.name,content:"",tags:original?.tags??[],attachmentId:id};
  await tx.objectStore("projectItems").put(item);return item;
}
export async function duplicateConversation(repo:LocalRepository,id:string):Promise<Conversation>{
  return atomic(repo,allContent,async(tx,owner)=>{
    const old=await tx.objectStore("conversations").get([owner,id]);if(!old)throw new Error("Conversation not found.");
    const time=now(),copy:Conversation={...old,id:crypto.randomUUID(),title:copyTitle(old.title),createdAt:time,updatedAt:time,pinned:false,archived:false};
    await tx.objectStore("conversations").put(copy);
    const messages:Message[]=await tx.objectStore("messages").index("conversation").getAll([owner,id]);
    const wanted=new Set(messages.flatMap(m=>m.attachmentIds)),map=new Map<string,string>();
    for(const file of await tx.objectStore("attachments").index("ownerId").getAll(owner)){
      if(file.conversationId===id||wanted.has(file.id))map.set(file.id,(await cloneFile(tx,owner,file,null,copy.id)).attachmentId!);
    }
    for(const message of messages)await tx.objectStore("messages").put({...message,id:crypto.randomUUID(),conversationId:copy.id,attachmentIds:message.attachmentIds.map(fileId=>{const target=map.get(fileId);if(!target)throw new Error("An attachment is missing.");return target;})});
    return copy;
  });
}
export async function duplicateProject(repo:LocalRepository,id:string):Promise<Project>{
  return atomic(repo,allContent,async(tx,owner)=>{
    const old=await tx.objectStore("projects").get([owner,id]);if(!old)throw new Error("Project not found.");
    const time=now(),copy:Project={...old,id:crypto.randomUUID(),title:copyTitle(old.title),createdAt:time,updatedAt:time,pinned:false,archived:false};
    await tx.objectStore("projects").put(copy);
    const items:ProjectItem[]=await tx.objectStore("projectItems").index("ownerId").getAll(owner);
    const copied=new Map<string,string>();
    for(const file of await tx.objectStore("attachments").index("ownerId").getAll(owner)){
      if(file.projectId===id||items.some(i=>i.projectId===id&&i.attachmentId===file.id))copied.set(file.id,(await cloneFile(tx,owner,file,copy.id,null)).id);
    }
    for(const item of items.filter(i=>i.projectId===id)){
      if(item.attachmentId){if(!copied.has(item.attachmentId))throw new Error("A project file is missing.");continue;}
      await tx.objectStore("projectItems").put({...item,id:crypto.randomUUID(),projectId:copy.id,createdAt:time,updatedAt:time});
    }
    return copy;
  });
}
export async function duplicateItem(repo:LocalRepository,id:string,projectId?:string|null):Promise<ProjectItem>{
  return atomic(repo,allContent,async(tx,owner)=>{
    const old:ProjectItem|undefined=await tx.objectStore("projectItems").get([owner,id]);if(!old)throw new Error("Item not found.");
    const target=projectId===undefined?old.projectId:projectId;
    if(target&&!await tx.objectStore("projects").get([owner,target]))throw new Error("Project not found.");
    if(old.attachmentId){const attachment=await tx.objectStore("attachments").get([owner,old.attachmentId]);if(!attachment)throw new Error("File not found.");const item=await cloneFile(tx,owner,attachment,target,null);item.title=copyTitle(old.title);await tx.objectStore("projectItems").put(item);return item;}
    const time=now(),copy={...old,id:crypto.randomUUID(),title:copyTitle(old.title),projectId:target,createdAt:time,updatedAt:time};
    await tx.objectStore("projectItems").put(copy);return copy;
  });
}
export async function moveItem(repo:LocalRepository,id:string,projectId:string|null){
  await atomic(repo,["projectItems","projects","attachments"],async(tx,owner)=>{
    const item=await tx.objectStore("projectItems").get([owner,id]);if(!item)throw new Error("Item not found.");
    if(projectId&&!await tx.objectStore("projects").get([owner,projectId]))throw new Error("Project not found.");
    const updatedAt=now();await tx.objectStore("projectItems").put({...item,projectId,updatedAt});
    if(item.attachmentId){const file=await tx.objectStore("attachments").get([owner,item.attachmentId]);if(!file)throw new Error("File not found.");await tx.objectStore("attachments").put({...file,projectId,updatedAt});}
  });
}
export async function deleteItems(repo:LocalRepository,ids:string[]){
  const selected=new Set(ids);
  await atomic(repo,allContent,async(tx,owner)=>{
    const files=new Set<string>();
    for(const id of selected){const item=await tx.objectStore("projectItems").get([owner,id]);if(item?.attachmentId)files.add(item.attachmentId);await tx.objectStore("projectItems").delete([owner,id]);}
    for(const id of files){await tx.objectStore("attachments").delete([owner,id]);await tx.objectStore("blobs").delete([owner,id]);}
    for(const item of await tx.objectStore("projectItems").index("ownerId").getAll(owner))if(files.has(item.attachmentId))await tx.objectStore("projectItems").delete([owner,item.id]);
    for(const message of await tx.objectStore("messages").index("ownerId").getAll(owner))if(message.attachmentIds.some((id:string)=>files.has(id)))await tx.objectStore("messages").put({...message,attachmentIds:message.attachmentIds.filter((id:string)=>!files.has(id))});
  });
}
export async function deleteProject(repo:LocalRepository,id:string,policy:"delete"|"retain"){
  if(!["delete","retain"].includes(policy))throw new Error("Choose whether to retain or delete project content.");
  await atomic(repo,allContent,async(tx,owner)=>{
    const files=new Set<string>();
    for(const item of await tx.objectStore("projectItems").index("ownerId").getAll(owner)){
      if(item.projectId!==id)continue;
      if(policy==="retain")await tx.objectStore("projectItems").put({...item,projectId:null,updatedAt:now()});
      else{await tx.objectStore("projectItems").delete([owner,item.id]);if(item.attachmentId)files.add(item.attachmentId);}
    }
    for(const file of await tx.objectStore("attachments").index("ownerId").getAll(owner)){
      if(file.projectId!==id&&!files.has(file.id))continue;
      if(policy==="retain")await tx.objectStore("attachments").put({...file,projectId:null,updatedAt:now()});
      else{files.add(file.id);await tx.objectStore("attachments").delete([owner,file.id]);await tx.objectStore("blobs").delete([owner,file.id]);}
    }
    if(policy==="delete")for(const message of await tx.objectStore("messages").index("ownerId").getAll(owner))
      if(message.attachmentIds.some((id:string)=>files.has(id)))await tx.objectStore("messages").put({...message,attachmentIds:message.attachmentIds.filter((id:string)=>!files.has(id))});
    await tx.objectStore("projects").delete([owner,id]);
  });
}
export async function updateTextFile(repo:LocalRepository,id:string,content:string){
  const owner=repo.ownerId,item=await repo.getItem(id);
  if(!item?.attachmentId)throw new Error("This item has no local file.");
  const attachment=await repo.get<Attachment>("attachments",item.attachmentId);if(!attachment)throw new Error("File not found.");
  if(!/\.(txt|md|csv|json|ts|tsx|py|css|obj|gltf)$/i.test(attachment.name))throw new Error("This file format is not safe for text editing.");
  const file=new File([content],attachment.name,{type:attachment.mimeType});
  await validateFileContent(file);
  await atomic(repo,["projectItems","attachments","blobs"],async(tx,current)=>{
    if(owner!==current)throw new Error("The active account changed.");
    const existing=await tx.objectStore("projectItems").get([owner,id]);
    if(!existing||existing.updatedAt!==item.updatedAt)throw new Error("The file changed while editing. Reopen it before saving.");
    const updatedAt=now();await tx.objectStore("attachments").put({...attachment,size:file.size,updatedAt});
    await tx.objectStore("blobs").put({id:attachment.id,ownerId:owner,data:file.slice()});
    await tx.objectStore("projectItems").put({...existing,updatedAt});
  });
}
