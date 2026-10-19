interface TokenResponse { access_token?:string; expires_in?:number; error?:string; scope?:string }
interface GoogleIdentity {
  accounts:{oauth2:{
    initTokenClient(options:{client_id:string;scope:string;callback:(response:TokenResponse)=>void;error_callback:(error:unknown)=>void}):{requestAccessToken(options:{prompt:string}):void};
    revoke(token:string,callback:()=>void):void;
  }};
}
declare global { interface Window { google?:GoogleIdentity } }
export interface DriveFile { id:string;name:string;modifiedTime?:string;trashed?:boolean;etag?:string }
export class DriveApi {
  private token?:string;
  private expiresAt=0;
  readonly clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
  get configured(){return !!this.clientId;}
  get connected(){return !!this.token&&Date.now()<this.expiresAt;}
  async connect() {
    if(!this.configured)throw new Error("Google Drive OAuth is not configured. Local storage and downloaded backups work without it.");
    if(!window.google)await new Promise<void>((resolve,reject)=>{
      const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error("Google authorization could not be loaded."));
      document.head.appendChild(script);
    });
    await new Promise<void>((resolve,reject)=>{
      const client=window.google!.accounts.oauth2.initTokenClient({
        client_id:this.clientId,scope:"https://www.googleapis.com/auth/drive.file",
        callback:result=>{
          if(result.error||!result.access_token||!result.scope?.split(" ").includes("https://www.googleapis.com/auth/drive.file")){reject(new Error("Drive authorization was not granted. Nothing was uploaded."));return;}
          this.token=result.access_token;this.expiresAt=Date.now()+Math.max(0,(result.expires_in??3600)-60)*1000;resolve();
        },error_callback:()=>reject(new Error("Drive authorization was cancelled or blocked. No connection was made.")),
      });
      client.requestAccessToken({prompt:"consent"});
    });
  }
  disconnect(){if(this.token&&typeof window!=="undefined")window.google?.accounts.oauth2.revoke(this.token,()=>{});this.token=undefined;this.expiresAt=0;}
  private async request(path:string,init:RequestInit={}) {
    if(!this.connected)throw new Error("Connect your Google Drive first. Authorization may have expired.");
    const response=await fetch(`https://www.googleapis.com${path}`,{...init,headers:{...init.headers,Authorization:`Bearer ${this.token}`},credentials:"omit",redirect:"error",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(60000)});
    if(response.status===401){this.token=undefined;throw new Error("Drive authorization expired. Reconnect to continue.");}
    if(response.status===412)throw new Error("Drive conflict: the remote file changed while saving. Review the remote backup before retrying.");
    if(!response.ok)throw new Error(`Drive request failed (${response.status}). Local content was not changed.`);
    return response;
  }
  async find(name:string,parentId?:string,mimeType?:string):Promise<DriveFile|undefined>{
    // Only app-constant names and real returned parent IDs are used.
    const escape=(s:string)=>s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    const q=`trashed = false and name = '${escape(name)}'${parentId?` and '${escape(parentId)}' in parents`:""}${mimeType?` and mimeType = '${escape(mimeType)}'`:""}`;
    const response=await this.request(`/drive/v3/files?${new URLSearchParams({q,fields:"files(id,name,modifiedTime)",pageSize:"100"})}`);
    const body=await response.json();
    if(!Array.isArray(body.files))throw new Error("Invalid Drive file-list response.");
    if(body.files.length>1)throw new Error("Multiple matching Ayatrisya backups/folders exist in Drive. Resolve duplicates in Drive before syncing.");
    return body.files[0];
  }
  async folder(name:string,parentId?:string):Promise<string>{
    const existing=await this.find(name,parentId,"application/vnd.google-apps.folder");if(existing)return existing.id;
    const response=await this.request("/drive/v3/files?fields=id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",...(parentId?{parents:[parentId]}:{})})});
    const result=await response.json();if(typeof result.id!=="string")throw new Error("Drive did not return a folder ID.");return result.id;
  }
  async metadata(id:string):Promise<DriveFile>{
    const response=await this.request(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,modifiedTime,trashed`);
    return {...await response.json(),etag:response.headers.get("etag")??undefined};
  }
  async download(id:string):Promise<string>{
    const response=await this.request(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
    const text=await response.text();if(text.length>100*1024*1024)throw new Error("Remote backup exceeds the supported import size.");return text;
  }
  async downloadBlob(id:string):Promise<Blob>{
    const response=await this.request(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
    const blob=await response.blob();if(blob.size>100*1024*1024)throw new Error("Remote content exceeds the supported download size.");return blob;
  }
  async trash(id:string,etag?:string):Promise<void>{
    if(!etag)throw new Error("Drive did not supply a concurrency token. Refusing to delete an unchecked version.");
    const response=await this.request(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`,{method:"PATCH",headers:{"Content-Type":"application/json","If-Match":etag},body:JSON.stringify({trashed:true})});
    const result=await response.json();if(result.id!==id||result.trashed!==true)throw new Error("Drive did not confirm deletion.");
  }
  async upload(blob:Blob,parentId:string,existing?:DriveFile):Promise<DriveFile>{
    return this.uploadContent("workspace-backup.json",blob,parentId,existing);
  }
  async uploadContent(name:string,blob:Blob,parentId:string,existing?:DriveFile):Promise<DriveFile>{
    if(existing&&!existing.etag)throw new Error("Drive did not supply a concurrency token. Refusing to overwrite the remote backup; download it instead.");
    const boundary=`ayatrisya-${crypto.randomUUID()}`;
    const metadata=existing?{name}:{name,parents:[parentId]};
    const contentType=/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(blob.type)?blob.type:"application/octet-stream";
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,blob,`\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`});
    const response=await this.request(`/upload/drive/v3/files${existing?`/${encodeURIComponent(existing.id)}`:""}?uploadType=multipart&fields=id,name,modifiedTime`,{method:existing?"PATCH":"POST",headers:{"Content-Type":body.type,...(existing?{"If-Match":existing.etag!}:{})},body});
    const result=await response.json();if(typeof result.id!=="string")throw new Error("Drive did not confirm an uploaded file.");return result;
  }
}
export const driveApi = new DriveApi();
