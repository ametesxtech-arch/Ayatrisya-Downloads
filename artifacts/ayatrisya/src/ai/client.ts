import { z } from "zod";
import type { ModelCapability, ModelMessage, ModelTransport, GenerationOptions } from "./types";

const capabilitySchema = z.object({
  models:z.array(z.object({id:z.enum(["v1-fast","v2-best"]),available:z.boolean(),reason:z.string().optional(),streaming:z.boolean().default(false),attachments:z.boolean().default(false),modalities:z.array(z.string()).default(["chat"])})),
});
const labels = {"v1-fast":"V1 Fast","v2-best":"V2 Best Result"} as const;
export function validateEndpoint(raw:string):string {
  const endpoint = new URL(raw);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Use an HTTPS Ayatrisya-owned endpoint without credentials, query strings, or fragments.");
  if (/(^|\.)(openai\.com|anthropic\.com|googleapis\.com|groq\.com|openrouter\.ai|huggingface\.co|huggingface\.com)$/.test(endpoint.hostname)) throw new Error("Third-party AI inference endpoints are not permitted.");
  if (["localhost","127.0.0.1","0.0.0.0"].includes(endpoint.hostname)) throw new Error("A production browser cannot use a localhost model URL.");
  return endpoint.href.replace(/\/$/,"");
}
export class AyatrisyaModelClient implements ModelTransport {
  private endpoint:string|null=null;
  private configError="";
  private generation?:AbortController;
  private localRequestId?:string;
  constructor(raw = import.meta.env.VITE_AYATRISYA_ENDPOINT ?? "") {
    if (raw) try { this.endpoint=validateEndpoint(raw); } catch(e) {this.configError=e instanceof Error?e.message:"Invalid model configuration.";}
  }
  private async request(path:string,init:RequestInit={},signal?:AbortSignal) {
    const desktop = typeof window !== "undefined" ? window.ayatrisyaDesktop : undefined;
    const localEndpoint = desktop ? await desktop.getLocalModelEndpoint() : "";
    if (desktop && localEndpoint) {
      if (!["/health", "/capabilities", "/chat"].includes(path)) {
        throw new Error("The desktop local model supports health, capabilities, and chat only.");
      }
      if (signal?.aborted) throw new DOMException("Model request cancelled.", "AbortError");
      let body: unknown;
      if (init.body !== undefined) {
        if (typeof init.body !== "string") throw new Error("The local model request format is unsupported.");
        try { body = JSON.parse(init.body); } catch { throw new Error("The local model request is invalid."); }
      }
      const requestId = crypto.randomUUID();
      this.localRequestId = requestId;
      const cancel = () => { void desktop.cancelLocalModelRequest(requestId).catch(() => undefined); };
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) cancel();
      try {
        const result = await desktop.requestLocalModel(
          path as "/health" | "/capabilities" | "/chat",
          (init.method ?? "GET").toUpperCase() as "GET" | "POST",
          body,
          requestId,
        );
        const response = new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { "Content-Type": result.contentType },
        });
        if (!response.ok) throw new Error(`Local model request failed (${response.status}).`);
        return { response, dispose: () => undefined };
      } finally {
        signal?.removeEventListener("abort", cancel);
        if (this.localRequestId === requestId) this.localRequestId = undefined;
      }
    }
    if(!this.endpoint)throw new Error(this.configError || "Ayatrisya's model endpoint is not configured. Your message can remain saved locally; no AI request was sent.");
    const controller=new AbortController(); const abort=()=>controller.abort(signal?.reason);
    if(signal?.aborted)abort();else signal?.addEventListener("abort",abort,{once:true});
    const timer=setTimeout(()=>controller.abort(new DOMException("Model request timed out.","TimeoutError")),120000);
    const dispose=()=>{clearTimeout(timer);signal?.removeEventListener("abort",abort);};
    try {
      const response=await fetch(`${this.endpoint}${path}`,{...init,signal:controller.signal,credentials:"omit",redirect:"error",referrerPolicy:"no-referrer"});
      if(!response.ok)throw new Error(response.status===503?"The Ayatrisya model is unavailable. Retry later.":`Ayatrisya model request failed (${response.status}).`);
      return {response,dispose};
    } catch(e) {dispose();throw e;}
  }
  async getModelCapabilities():Promise<ModelCapability[]> {
    const unavailable=(reason:string):ModelCapability[] => Object.entries(labels).map(([id,label])=>({id:id as ModelCapability["id"],label,available:false,reason,streaming:false,attachments:false,modalities:[]}));
    const desktop = typeof window !== "undefined" ? window.ayatrisyaDesktop : undefined;
    let localEndpoint = "";
    try { localEndpoint = desktop ? await desktop.getLocalModelEndpoint() : ""; }
    catch { return unavailable("Could not read the desktop local model setting."); }
    if(!this.endpoint && !localEndpoint)return unavailable(this.configError||"No Ayatrisya model endpoint configured");
    try {
      const {response,dispose}=await this.request("/capabilities");
      try {
        const parsed=capabilitySchema.parse(await response.json());
        return Object.entries(labels).map(([id,label])=>{
          const model=parsed.models.find(m=>m.id===id);
          return {id:id as ModelCapability["id"],label,available:model?.available??false,reason:model?.reason??(model?.available?"Ready":"Model not ready"),streaming:localEndpoint?false:model?.streaming??false,attachments:false,modalities:localEndpoint?["chat"]:model?.modalities??[]};
        });
      } finally {dispose();}
    } catch {return unavailable(localEndpoint?"Could not verify the local adapter. Check its /capabilities response.":"Could not verify model availability. Check endpoint health and CORS.");}
  }
  async getConnectionHealth() {
    let localEndpoint: string;
    try { localEndpoint = typeof window !== "undefined" && window.ayatrisyaDesktop ? await window.ayatrisyaDesktop.getLocalModelEndpoint() : ""; }
    catch { return {configured:true,connected:false,message:"Could not read the desktop local model setting"}; }
    if(!this.endpoint&&!localEndpoint)return {configured:false,connected:false,message:this.configError||"No Ayatrisya endpoint configured"};
    try {
      const {response,dispose}=await this.request("/health");
      try {const body=await response.json();return {configured:true,connected:body?.status==="ok",message:body?.status==="ok"?"Ayatrisya endpoint reachable":"Endpoint returned an invalid health status"};} finally {dispose();}
    } catch {return {configured:true,connected:false,message:"Ayatrisya endpoint could not be reached"};}
  }
  async generateResponse(messages:ModelMessage[],options:GenerationOptions):Promise<string> {
    const capability=(await this.getModelCapabilities()).find(m=>m.id===options.model);
    if(!capability?.available)throw new Error(capability?.reason||"Selected model is unavailable.");
    this.cancelGeneration();this.generation=new AbortController();
    const abort=()=>this.generation?.abort(); options.signal?.addEventListener("abort",abort,{once:true});
    if(options.signal?.aborted)abort();
    try {
      const {response,dispose}=await this.request("/chat",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, application/x-ndjson, text/event-stream"},body:JSON.stringify({messages,model:options.model,mode:options.mode,stream:capability.streaming})},this.generation.signal);
      try {
        const type=response.headers.get("content-type")??"";
        if(type.includes("application/json")) {
          const body=z.object({text:z.string().max(2000000)}).parse(await response.json());options.onToken?.(body.text);return body.text;
        }
        if(!response.body || (!type.includes("ndjson")&&!type.includes("event-stream")))throw new Error("Unsupported model response format.");
        const reader=response.body.getReader(),decoder=new TextDecoder();let pending="",output="";
        const parseLine=(line:string)=>{
          if(type.includes("event-stream")) {if(!line.startsWith("data:"))return;line=line.slice(5).trim();}
          if(!line.trim()||line==="[DONE]")return;
          const chunk=z.object({token:z.string().optional(),error:z.string().optional(),done:z.boolean().optional()}).parse(JSON.parse(line));
          if(chunk.error)throw new Error("Model generation failed. Retry the request.");
          if(chunk.token){output+=chunk.token;if(output.length>2000000)throw new Error("Model output exceeded the supported limit.");options.onToken?.(chunk.token);}
        };
        while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split(/\r?\n/);pending=lines.pop()??"";for(const line of lines)parseLine(line);}
        pending+=decoder.decode();if(pending.trim())parseLine(pending);
        if(!output)throw new Error("Model returned no text.");
        return output;
      } finally {dispose();}
    } finally {options.signal?.removeEventListener("abort",abort);this.generation=undefined;}
  }
  cancelGeneration(){
    this.generation?.abort();
    if(this.localRequestId && typeof window !== "undefined") {
      void window.ayatrisyaDesktop?.cancelLocalModelRequest(this.localRequestId).catch(()=>undefined);
    }
  }
  async transcribeAudio(audio:Blob,options:{signal?:AbortSignal}={}):Promise<string>{
    const models=await this.getModelCapabilities();if(!models.some(m=>m.available&&m.modalities.includes("stt")))throw new Error("Ayatrisya speech-to-text is unavailable.");
    const body=new FormData();body.append("audio",audio,"recording.webm");
    const {response,dispose}=await this.request("/transcribe",{method:"POST",body},options.signal);
    try{return z.object({text:z.string()}).parse(await response.json()).text;}finally{dispose();}
  }
  async synthesizeSpeech(text:string,options:{signal?:AbortSignal}={}):Promise<Blob>{
    const models=await this.getModelCapabilities();if(!models.some(m=>m.available&&m.modalities.includes("tts")))throw new Error("Ayatrisya text-to-speech is unavailable.");
    const {response,dispose}=await this.request("/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})},options.signal);
    try{if(!response.headers.get("content-type")?.startsWith("audio/"))throw new Error("Invalid speech audio response.");return await response.blob();}finally{dispose();}
  }
}
export const modelClient = new AyatrisyaModelClient();
