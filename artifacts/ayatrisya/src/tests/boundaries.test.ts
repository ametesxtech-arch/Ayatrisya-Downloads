import { afterEach, describe, expect, it, vi } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import { decideSync, retryDelay } from "../integrations/google-drive/sync";
import { authError, firebaseAuth, firebaseConfigured } from "../integrations/firebase/client";
afterEach(()=>vi.restoreAllMocks());
describe("owned model boundary",()=>{
  it("never calls hosted inference without a signed-in user's Firebase token",async()=>{
    const logs=[vi.spyOn(console,"log"),vi.spyOn(console,"info"),vi.spyOn(console,"warn"),vi.spyOn(console,"error"),vi.spyOn(console,"debug")];
    const fetcher=vi.spyOn(globalThis,"fetch");const client=new AyatrisyaModelClient(async()=>{throw new Error("Sign in to Ayatrisya to use hosted models.");});
    expect((await client.getModelCapabilities()).every(m=>!m.available)).toBe(true);
    await expect(client.generateResponse([{role:"user",content:"private"}],{model:"v1-fast",mode:"Normal"})).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    for(const log of logs)expect(log).not.toHaveBeenCalled();
  });
  it("handles unavailable gateway and invalid capability responses as unavailable",async()=>{
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response('{"unexpected":true}',{headers:{"Content-Type":"application/json"}}));
    expect((await new AyatrisyaModelClient(async()=>"firebase-id-token").getModelCapabilities()).every(m=>!m.available)).toBe(true);
  });
  it("handles HTML responses gracefully without throwing raw JSON syntax errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>Error</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );
    const client = new AyatrisyaModelClient(async () => "firebase-id-token");
    const caps = await client.getModelCapabilities();
    expect(caps.every((m) => !m.available)).toBe(true);
    expect(caps[0].reason).toContain("HTML");
    expect(caps[0].reason).not.toContain("Unexpected token '<'");
  });
  it("handles HTTP 404 HTML response with an actionable error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>404 Not Found</body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );
    const client = new AyatrisyaModelClient(async () => "firebase-id-token");
    const caps = await client.getModelCapabilities();
    expect(caps.every((m) => !m.available)).toBe(true);
    expect(caps[0].reason).toContain("404");
  });
  it("handles malformed JSON safely without throwing unexpected tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{ invalid-json-payload", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new AyatrisyaModelClient(async () => "firebase-id-token");
    const caps = await client.getModelCapabilities();
    expect(caps.every((m) => !m.available)).toBe(true);
    expect(caps[0].reason).toContain("invalid JSON");
  });
  it("reports hosted model connection only after a non-empty inference response",async()=>{
    vi.spyOn(globalThis,"fetch").mockImplementation(async(url,init)=>{
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer firebase-id-token");
      if(String(url).endsWith("/health"))return Response.json({status:"ok"});
      if(String(url).endsWith("/capabilities"))return Response.json({models:[{id:"v1-fast",available:true}]});
      return Response.json({text:"Hello from the real model"});
    });
    const health=await new AyatrisyaModelClient(async()=>"firebase-id-token").getConnectionHealth();
    expect(health).toEqual({configured:true,connected:true,message:"Live inference succeeded with V1 Fast."});
  });
  it("consumes NDJSON tokens and sends only the Firebase user token to Ayatrisya's gateway",async()=>{
    const fetcher=vi.spyOn(globalThis,"fetch").mockImplementation(async(url,init)=>{
      expect(String(url)).toContain("/api/model/");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer firebase-id-token");
      if(String(url).endsWith("/capabilities"))return Response.json({models:[{id:"v1-fast",available:true,streaming:true}]});
      expect(init?.credentials).toBe("omit");
      expect(JSON.parse(init?.body as string)).toMatchObject({mode:"Savage",model:"v1-fast"});
      return new Response('{"token":"Hello "}\n{"token":"world"}\n{"done":true}\n',{headers:{"Content-Type":"application/x-ndjson"}});
    });
    const chunks:string[]=[];
    const text=await new AyatrisyaModelClient(async()=>"firebase-id-token").generateResponse([{role:"user",content:"test"}],{model:"v1-fast",mode:"Savage",onToken:t=>chunks.push(t)});
    expect(text).toBe("Hello world");expect(chunks).toEqual(["Hello ","world"]);expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("cancels an in-flight generation request",async()=>{
    let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});
    vi.spyOn(globalThis,"fetch").mockImplementation(async(url,init)=>{
      if(String(url).endsWith("/capabilities"))return Response.json({models:[{id:"v1-fast",available:true}]});
      started();return new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError")),{once:true});});
    });
    const client=new AyatrisyaModelClient(async()=>"firebase-id-token");
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
