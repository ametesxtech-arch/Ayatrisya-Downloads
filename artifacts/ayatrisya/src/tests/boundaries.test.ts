import { afterEach, describe, expect, it, vi } from "vitest";
import { AyatrisyaModelClient, validateEndpoint } from "../ai/client";
import { decideSync, retryDelay } from "../integrations/google-drive/sync";
import { authError, firebaseAuth, firebaseConfigured } from "../integrations/firebase/client";
afterEach(()=>vi.restoreAllMocks());
describe("owned model boundary",()=>{
  it("never calls inference when no endpoint is configured",async()=>{
    const logs=[vi.spyOn(console,"log"),vi.spyOn(console,"info"),vi.spyOn(console,"warn"),vi.spyOn(console,"error"),vi.spyOn(console,"debug")];
    const fetcher=vi.spyOn(globalThis,"fetch");const client=new AyatrisyaModelClient("");
    expect((await client.getModelCapabilities()).every(m=>!m.available)).toBe(true);
    await expect(client.generateResponse([{role:"user",content:"private"}],{model:"v1-fast",mode:"Normal"})).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    for(const log of logs)expect(log).not.toHaveBeenCalled();
  });
  it("rejects unsafe endpoints and known third-party providers",()=>{
    for(const url of ["http://example.com","https://api.openai.com","https://localhost","https://user:password@example.com"]){
      expect(()=>validateEndpoint(url)).toThrow();
    }
  });
  it("handles network and invalid capability responses as unavailable",async()=>{
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response('{"unexpected":true}',{headers:{"Content-Type":"application/json"}}));
    expect((await new AyatrisyaModelClient("https://models.example.test").getModelCapabilities()).every(m=>!m.available)).toBe(true);
  });
  it("consumes actual NDJSON tokens, sends mode/model, and omits credentials",async()=>{
    const fetcher=vi.spyOn(globalThis,"fetch").mockImplementation(async(url,init)=>{
      if(String(url).endsWith("/capabilities"))return Response.json({models:[{id:"v1-fast",available:true,streaming:true}]});
      expect(init?.credentials).toBe("omit");
      expect(JSON.parse(init?.body as string)).toMatchObject({mode:"Savage",model:"v1-fast"});
      return new Response('{"token":"Hello "}\n{"token":"world"}\n{"done":true}\n',{headers:{"Content-Type":"application/x-ndjson"}});
    });
    const chunks:string[]=[];
    const text=await new AyatrisyaModelClient("https://models.example.test").generateResponse([{role:"user",content:"test"}],{model:"v1-fast",mode:"Savage",onToken:t=>chunks.push(t)});
    expect(text).toBe("Hello world");expect(chunks).toEqual(["Hello ","world"]);expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("cancels an in-flight generation request",async()=>{
    let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});
    vi.spyOn(globalThis,"fetch").mockImplementation(async(url,init)=>{
      if(String(url).endsWith("/capabilities"))return Response.json({models:[{id:"v1-fast",available:true}]});
      started();return new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError")),{once:true});});
    });
    const client=new AyatrisyaModelClient("https://models.example.test");
    const generation=client.generateResponse([{role:"user",content:"test"}],{model:"v1-fast",mode:"Normal"});
    const rejected=expect(generation).rejects.toThrow("Stopped");await ready;client.cancelGeneration();await rejected;
  });
});
describe("Drive queue and conflict policy (not live integration tests)",()=>{
  it("does not overwrite unknown/newer remote state",()=>{
    expect(decideSync("a",null,null)).toBe("upload");
    expect(decideSync("a","a",null)).toBe("unchanged");
    expect(decideSync("b","a","a")).toBe("upload");
    expect(decideSync("b","c","a")).toBe("conflict");
    expect(decideSync("b","c",null)).toBe("conflict");
  });
  it("bounds exponential retry backoff",()=>{expect(retryDelay(2)).toBe(4000);expect(retryDelay(999)).toBeLessThanOrEqual(3600000);});
});
describe("Firebase boundary (not a live authentication test)",()=>{
  it("uses safe human-readable errors without leaking raw tokens/configuration",()=>{
    expect(authError({code:"auth/invalid-credential",message:"secret-token"})).toContain("incorrect");
    expect(authError({message:"secret-token"})).not.toContain("secret-token");
  });
  it("cannot authenticate using absent configuration",()=>{
    if(!firebaseConfigured)expect(()=>firebaseAuth()).toThrow("not configured");
  });
});
