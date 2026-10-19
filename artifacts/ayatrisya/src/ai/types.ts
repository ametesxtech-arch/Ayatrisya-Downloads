import type { ChatMode, ModelId } from "@/storage/types";
export interface ModelCapability {
  id:ModelId; label:string; available:boolean; reason:string;
  streaming:boolean; attachments:boolean; modalities:string[];
}
export interface ModelMessage { role:"user"|"assistant"; content:string }
export interface GenerationOptions {
  model:ModelId; mode:ChatMode; onToken?:(token:string)=>void; signal?:AbortSignal;
}
export interface ModelTransport {
  getModelCapabilities():Promise<ModelCapability[]>;
  getConnectionHealth():Promise<{configured:boolean;connected:boolean;message:string}>;
  generateResponse(messages:ModelMessage[],options:GenerationOptions):Promise<string>;
  cancelGeneration():void;
  transcribeAudio(audio:Blob,options?:{signal?:AbortSignal}):Promise<string>;
  synthesizeSpeech(text:string,options?:{signal?:AbortSignal}):Promise<Blob>;
}
