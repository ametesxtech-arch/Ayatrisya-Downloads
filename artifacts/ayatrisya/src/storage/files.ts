export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const allowedExtensions = new Set([
  "txt", "md", "csv", "json", "pdf", "png", "jpg", "jpeg", "gif", "webp",
  "mp3", "wav", "ogg", "webm", "m4a", "ts", "tsx", "py", "css", "glb", "gltf", "obj",
]);
export function validateFile(file: Pick<File, "name" | "size" | "type">) {
  if (!file.name.trim() || file.name.length > 255) throw new Error("Choose a file with a valid name (up to 255 characters).");
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!allowedExtensions.has(extension)) throw new Error("Unsupported file type. Use text, PDF, image, audio, or a supported 3D/code file.");
  if (file.size <= 0) throw new Error("The selected file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Files must be 10 MB or smaller. Nothing was stored.");
  if (/javascript|html|svg|executable/i.test(file.type)) throw new Error("Active HTML, SVG, scripts, and executable files are not supported.");
}
export function safeFilename(name: string) {
  return Array.from(name).map(c=>c.charCodeAt(0)<32||c==="/"||c==="\\"?"_":c).join("").slice(0,255)||"ayatrisya-export";
}
function validateModel(data:any){
  if(data?.asset?.version!=="2.0")throw new Error("Only glTF 2.0 is supported.");
  if(!Array.isArray(data.buffers??[])||!Array.isArray(data.images??[]))throw new Error("Invalid glTF resource metadata.");
  if([...(data.buffers??[]),...(data.images??[])].some((entry:{uri?:string})=>entry.uri&&!/^data:(application\/octet-stream|application\/gltf-buffer|image\/png|image\/jpeg|image\/webp);base64,/i.test(entry.uri)))throw new Error("3D assets must embed their resources. External file URLs are not loaded.");
}
export function validateFileBytes(file:Pick<File,"name"|"size"|"type">,bytes:Uint8Array){
  validateFile(file);
  const extension=file.name.split(".").at(-1)!.toLowerCase();
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.subarray(start,end));
  const starts=(values:number[])=>values.every((value,index)=>bytes[index]===value);
  const signatures:Record<string,()=>boolean>={
    png:()=>starts([137,80,78,71,13,10,26,10]),jpg:()=>starts([255,216,255]),jpeg:()=>starts([255,216,255]),
    gif:()=>/^GIF8[79]a$/.test(ascii(0,6)),webp:()=>ascii(0,4)==="RIFF"&&ascii(8,12)==="WEBP",
    pdf:()=>ascii(0,5)==="%PDF-",wav:()=>ascii(0,4)==="RIFF"&&ascii(8,12)==="WAVE",
    ogg:()=>ascii(0,4)==="OggS",webm:()=>starts([26,69,223,163]),
    mp3:()=>ascii(0,3)==="ID3"||(bytes[0]===255&&(bytes[1]&224)===224),
    m4a:()=>ascii(4,8)==="ftyp",
    glb:()=>ascii(0,4)==="glTF"&&bytes.length>=12&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)===2&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true)===bytes.length,
  };
  if(signatures[extension]){
    if(!signatures[extension]())throw new Error("The file contents do not match its stated format. Nothing was stored.");
    const expected:Record<string,string[]>={png:["image/png"],jpg:["image/jpeg"],jpeg:["image/jpeg"],gif:["image/gif"],webp:["image/webp"],pdf:["application/pdf"],wav:["audio/wav","audio/x-wav","audio/wave"],ogg:["audio/ogg","application/ogg"],webm:["audio/webm","video/webm"],mp3:["audio/mpeg","audio/mp3"],m4a:["audio/mp4","audio/x-m4a"],glb:["model/gltf-binary"]};
    if(file.type&&file.type!=="application/octet-stream"&&!expected[extension]?.includes(file.type))throw new Error("File content, extension and MIME type disagree.");
    if(extension==="glb"){
      if(bytes.length<20||ascii(16,20)!=="JSON")throw new Error("This GLB has no valid JSON scene.");
      const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(12,true);
      if(length>bytes.length-20)throw new Error("This GLB scene is truncated.");
      let data:unknown;try{data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(20,20+length)));}catch{throw new Error("This GLB scene is malformed.");}
      validateModel(data);
    }
    return;
  }
  if(file.type&&!file.type.startsWith("text/")&&!["application/octet-stream","application/json","model/gltf+json","application/x-python-code"].includes(file.type)&&!(extension==="ts"&&file.type==="video/mp2t"))throw new Error("This MIME type does not describe a supported text file.");
  let text:string;try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{throw new Error("This text file is not valid UTF-8.");}
  if(text.includes("\0"))throw new Error("Binary content cannot be imported as a text file.");
  if(extension==="json"||extension==="gltf"){
    let data:any;try{data=JSON.parse(text);}catch{throw new Error("This JSON file is malformed.");}
    if(extension==="gltf"){
      validateModel(data);
    }
  }
}
export async function validateFileContent(file:File){validateFileBytes(file,new Uint8Array(await file.arrayBuffer()));}
