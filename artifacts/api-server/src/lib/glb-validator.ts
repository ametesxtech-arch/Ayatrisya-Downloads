// GLB (glTF 2.0 Binary) Validator for Ayatrisya AI
// Validates genuine binary structure according to the Khronos glTF 2.0 specification

export interface GlbValidationResult {
  valid: boolean;
  error?: string;
  version?: number;
  totalLength?: number;
  jsonLength?: number;
  hasScene?: boolean;
}

export function validateGlbBuffer(buffer: Uint8Array | Buffer): GlbValidationResult {
  if (buffer.byteLength >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { valid: false, error: "The returned file is a PNG image, not a GLB 3D model." };
  }
  if (buffer.byteLength >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: false, error: "The returned file is a JPEG image, not a GLB 3D model." };
  }
  if (buffer.byteLength < 20) {
    return { valid: false, error: "The 3D model data is too short to be a valid glTF 2.0 binary (minimum 20 bytes)." };
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, true);

  // 0x46546C67 is 'glTF' in little-endian
  if (magic !== 0x46546c67) {
    // Check if it's HTML error page
    const textStart = new TextDecoder().decode(buffer.subarray(0, Math.min(128, buffer.byteLength))).trim();
    if (textStart.startsWith("<!DOCTYPE") || textStart.startsWith("<html") || textStart.includes("<html")) {
      return { valid: false, error: "The 3D model endpoint returned an HTML page instead of a GLB binary." };
    }
    // Check if it's JSON text
    if (textStart.startsWith("{") || textStart.startsWith("[")) {
      return { valid: false, error: "The 3D model endpoint returned JSON text instead of a GLB binary." };
    }
    // Check if it's PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { valid: false, error: "The returned file is a PNG image, not a GLB 3D model." };
    }
    // Check if it's JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: false, error: "The returned file is a JPEG image, not a GLB 3D model." };
    }
    return { valid: false, error: "The 3D model file has an invalid glTF header magic signature (expected 0x46546C67 'glTF')." };
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    return { valid: false, error: `Unsupported glTF version ${version}. Only glTF 2.0 binary (GLB) is supported.` };
  }

  const totalLength = view.getUint32(8, true);
  if (totalLength !== buffer.byteLength) {
    return {
      valid: false,
      error: `The GLB file length header (${totalLength} bytes) does not match the actual data size (${buffer.byteLength} bytes). The file may be truncated or corrupted.`,
    };
  }

  // Chunk 0: JSON Chunk
  const chunk0Length = view.getUint32(12, true);
  const chunk0Type = view.getUint32(16, true);

  // 0x4E4F534A is 'JSON' in little-endian
  if (chunk0Type !== 0x4e4f534a) {
    return { valid: false, error: "The first chunk of the GLB file must be a JSON chunk (0x4E4F534A 'JSON')." };
  }

  if (20 + chunk0Length > buffer.byteLength) {
    return { valid: false, error: "The GLB JSON chunk header declares a length exceeding the total file size." };
  }

  const jsonBytes = buffer.subarray(20, 20 + chunk0Length);
  let gltfJson: any;
  try {
    const jsonString = new TextDecoder("utf-8").decode(jsonBytes);
    gltfJson = JSON.parse(jsonString);
  } catch {
    return { valid: false, error: "The GLB JSON chunk contains malformed JSON." };
  }

  if (!gltfJson || typeof gltfJson !== "object") {
    return { valid: false, error: "The GLB scene structure is invalid." };
  }

  if (!gltfJson.asset || typeof gltfJson.asset !== "object" || !gltfJson.asset.version) {
    return { valid: false, error: "The GLB structure is missing required glTF asset version metadata." };
  }

  return {
    valid: true,
    version,
    totalLength,
    jsonLength: chunk0Length,
    hasScene: Array.isArray(gltfJson.scenes) || Array.isArray(gltfJson.nodes) || Array.isArray(gltfJson.meshes),
  };
}
