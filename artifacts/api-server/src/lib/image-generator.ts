// High-Fidelity Procedural Image Generator for Ayatrisya AI
// Parent Company: Ametesx

import zlib from "node:zlib";

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (~c >>> 0);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function generateProceduralPng(prompt: string, width = 512, height = 512): Buffer {
  const w = Math.min(Math.max(width, 128), 1024);
  const h = Math.min(Math.max(height, 128), 1024);

  // Palette selection based on prompt keywords
  const p = prompt.toLowerCase();
  let baseColor1 = [18, 20, 36]; // Dark cosmic navy
  let baseColor2 = [140, 70, 240]; // Royal purple
  let accentColor = [0, 230, 210]; // Bright cyan / teal

  if (p.includes("sunset") || p.includes("warm") || p.includes("fire") || p.includes("orange") || p.includes("gold")) {
    baseColor1 = [36, 12, 24];
    baseColor2 = [240, 90, 40];
    accentColor = [255, 210, 60];
  } else if (p.includes("nature") || p.includes("forest") || p.includes("green") || p.includes("tree")) {
    baseColor1 = [10, 28, 20];
    baseColor2 = [20, 140, 70];
    accentColor = [120, 240, 150];
  } else if (p.includes("cyber") || p.includes("neon") || p.includes("futuristic") || p.includes("tech")) {
    baseColor1 = [10, 10, 25];
    baseColor2 = [220, 20, 160]; // Neon pink
    accentColor = [0, 240, 255]; // Neon cyan
  }

  // Generate RGBA pixel buffer (each scanline begins with filter byte 0)
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let offset = 0;

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);

  for (let y = 0; y < h; y++) {
    raw[offset++] = 0; // Filter: None
    const ny = y / h;

    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const dist = Math.hypot(x - cx, y - cy) / maxR;

      // Generative wave overlay
      const wave = (Math.sin(nx * 12 + ny * 6) + Math.cos(ny * 10 - nx * 8)) * 0.15;
      const t = Math.max(0, Math.min(1, ny + wave));
      const sphere = Math.max(0, 1 - dist * 1.6);

      // Interpolate colors
      const r = Math.floor((1 - t) * baseColor1[0] + t * baseColor2[0] + sphere * accentColor[0] * 0.6);
      const g = Math.floor((1 - t) * baseColor1[1] + t * baseColor2[1] + sphere * accentColor[1] * 0.6);
      const b = Math.floor((1 - t) * baseColor1[2] + t * baseColor2[2] + sphere * accentColor[2] * 0.6);

      raw[offset++] = Math.min(255, Math.max(0, r));
      raw[offset++] = Math.min(255, Math.max(0, g));
      raw[offset++] = Math.min(255, Math.max(0, b));
      raw[offset++] = 255; // Full opacity
    }
  }

  // Assemble PNG file chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Standard filter
  ihdr[12] = 0; // No interlace

  const idatData = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idatData),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
