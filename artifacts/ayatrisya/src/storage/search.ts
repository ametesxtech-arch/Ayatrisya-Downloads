import type { LocalRepository } from "./repository";
import type { Conversation, KnowledgeBase, MemoryEntry, Message, Project, ProjectItem, SearchResult } from "./types";
export async function searchAll(repo:LocalRepository,query:string,options:{types?:string[];limit?:number}={}):Promise<SearchResult[]>{
  const term=query.trim().toLocaleLowerCase();if(!term)return [];
  const owner=repo.ownerId;
  const [conversations,messages,projects,items,memories,kbs]=await Promise.all([
    repo.all<Conversation>("conversations",owner),
    repo.all<Message>("messages",owner),
    repo.all<Project>("projects",owner),
    repo.all<ProjectItem>("projectItems",owner),
    repo.all<MemoryEntry>("aiMemories",owner),
    repo.all<KnowledgeBase>("knowledgeBases",owner),
  ]);
  const results:SearchResult[]=[];
  const matches=(value:string)=>value.toLocaleLowerCase().includes(term);
  const snippet=(text:string)=>{const at=text.toLocaleLowerCase().indexOf(term);return text.slice(Math.max(0,at-35),Math.max(0,at-35)+180);};
  for(const record of conversations){const message=messages.find(m=>m.conversationId===record.id&&matches(m.content));if(matches(record.title)||message)results.push({id:record.id,title:record.title,snippet:message?snippet(message.content):record.archived?"Archived conversation":"Conversation",updatedAt:record.updatedAt,type:"conversation",resource:"conversation",href:`/workspace/chat/${record.id}`});}
  for(const record of projects)if(matches(`${record.title} ${record.description} ${record.tags.join(" ")}`))results.push({id:record.id,title:record.title,snippet:snippet(record.description),updatedAt:record.updatedAt,type:"project",resource:"project",href:`/workspace/projects/${record.id}`});
  for(const record of items)if(matches(`${record.title} ${record.content} ${record.tags.join(" ")}`))results.push({id:record.id,title:record.title,snippet:snippet(record.content),updatedAt:record.updatedAt,type:record.kind,resource:"item",href:record.kind==="document"?`/workspace/documents/${record.id}`:`/workspace/library?item=${encodeURIComponent(record.id)}`});
  for(const record of memories)if(matches(`${record.content} ${record.tags.join(" ")} ${record.category}`))results.push({id:record.id,title:`Memory (${record.category})`,snippet:snippet(record.content),updatedAt:record.updatedAt,type:"memory",resource:"item",href:`/workspace/personalization`});
  for(const record of kbs)if(matches(`${record.name} ${record.description} ${record.tags.join(" ")}`))results.push({id:record.id,title:record.name,snippet:snippet(record.description),updatedAt:record.updatedAt,type:"knowledge_base",resource:"item",href:`/workspace/research`});
  return results.filter(r=>!options.types?.length||options.types.includes(r.type)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,Math.min(500,Math.max(1,options.limit??80)));
}
