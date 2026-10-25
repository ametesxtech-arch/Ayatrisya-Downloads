// Real glTF 2.0 Binary (GLB) 3D Model Generator for Ayatrisya AI
// Parent Company: Ametesx

export function generateProceduralGlb(prompt: string): Buffer {
  const p = prompt.toLowerCase();

  // Color selection based on prompt
  let color = [0.2, 0.6, 1.0]; // Electric cyan/blue default
  let metallic = 0.8;
  let roughness = 0.2;

  if (p.includes("gold") || p.includes("sun") || p.includes("amber")) {
    color = [1.0, 0.78, 0.15];
    metallic = 0.9;
    roughness = 0.15;
  } else if (p.includes("ruby") || p.includes("red") || p.includes("fire")) {
    color = [0.95, 0.1, 0.2];
    metallic = 0.7;
    roughness = 0.3;
  } else if (p.includes("emerald") || p.includes("green") || p.includes("jade")) {
    color = [0.1, 0.85, 0.35];
    metallic = 0.6;
    roughness = 0.25;
  } else if (p.includes("amethyst") || p.includes("purple") || p.includes("violet")) {
    color = [0.65, 0.2, 0.95];
    metallic = 0.85;
    roughness = 0.2;
  }

  // Generate an 8-sided faceted crystal octahedron mesh
  // 6 vertices: Top, Bottom, and 4 equator points
  const rawPositions = [
    0, 1.2, 0,    // 0: top peak
    0, -1.2, 0,   // 1: bottom peak
    1, 0, 0,      // 2: +X
    0, 0, 1,      // 3: +Z
    -1, 0, 0,     // 4: -X
    0, 0, -1,     // 5: -Z
  ];

  // 8 triangular faces (24 indices)
  const rawIndices = [
    0, 2, 3,  0, 3, 4,  0, 4, 5,  0, 5, 2, // Top pyramid
    1, 3, 2,  1, 4, 3,  1, 5, 4,  1, 2, 5  // Bottom pyramid
  ];

  // Calculate face normals and duplicate vertices for faceted shading
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let f = 0; f < rawIndices.length; f += 3) {
    const i0 = rawIndices[f];
    const i1 = rawIndices[f + 1];
    const i2 = rawIndices[f + 2];

    const p0 = [rawPositions[i0 * 3], rawPositions[i0 * 3 + 1], rawPositions[i0 * 3 + 2]];
    const p1 = [rawPositions[i1 * 3], rawPositions[i1 * 3 + 1], rawPositions[i1 * 3 + 2]];
    const p2 = [rawPositions[i2 * 3], rawPositions[i2 * 3 + 1], rawPositions[i2 * 3 + 2]];

    // Cross product (p1 - p0) x (p2 - p0)
    const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const n = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0],
    ];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const norm = [n[0] / len, n[1] / len, n[2] / len];

    const baseIndex = vertices.length / 3;
    vertices.push(...p0, ...p1, ...p2);
    normals.push(...norm, ...norm, ...norm);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  }

  const posArray = new Float32Array(vertices);
  const normArray = new Float32Array(normals);
  const idxArray = new Uint16Array(indices);

  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
    maxZ = Math.max(maxZ, vertices[i + 2]);
  }

  // Construct binary buffer
  const posBuf = Buffer.from(posArray.buffer);
  const normBuf = Buffer.from(normArray.buffer);
  const idxBuf = Buffer.from(idxArray.buffer);

  const binContent = Buffer.concat([posBuf, normBuf, idxBuf]);
  const binPad = (4 - (binContent.length % 4)) % 4;
  const binPadded = Buffer.concat([binContent, Buffer.alloc(binPad)]);

  const gltf = {
    asset: {
      version: "2.0",
      generator: "Ayatrisya 3D Model Studio by Ametesx",
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "AyatrisyaProceduralModel" }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: "AyatrisyaMetallicMaterial",
        pbrMetallicRoughness: {
          baseColorFactor: [...color, 1.0],
          metallicFactor: metallic,
          roughnessFactor: roughness,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: vertices.length / 3,
        type: "VEC3",
        max: [maxX, maxY, maxZ],
        min: [minX, minY, minZ],
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: normals.length / 3,
        type: "VEC3",
        max: [1, 1, 1],
        min: [-1, -1, -1],
      },
      {
        bufferView: 2,
        byteOffset: 0,
        componentType: 5123, // UNSIGNED_SHORT
        count: indices.length,
        type: "SCALAR",
        max: [indices.length - 1],
        min: [0],
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: posBuf.length,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: posBuf.length,
        byteLength: normBuf.length,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: posBuf.length + normBuf.length,
        byteLength: idxBuf.length,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      },
    ],
    buffers: [
      {
        byteLength: binContent.length,
      },
    ],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr, "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonPadded = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]); // Padded with spaces

  // Total GLB = 12 header + 8 JSON chunk header + jsonPadded + 8 BIN chunk header + binPadded
  const totalLength = 12 + 8 + jsonPadded.length + 8 + binPadded.length;

  const header = Buffer.alloc(12);
  header.write("glTF", 0, 4, "ascii");
  header.writeUInt32LE(2, 4); // GLB Version 2
  header.writeUInt32LE(totalLength, 8);

  const chunk0 = Buffer.alloc(8);
  chunk0.writeUInt32LE(jsonPadded.length, 0);
  chunk0.write("JSON", 4, 4, "ascii");

  const chunk1 = Buffer.alloc(8);
  chunk1.writeUInt32LE(binPadded.length, 0);
  chunk1.write("BIN\0", 4, 4, "ascii");

  return Buffer.concat([header, chunk0, jsonPadded, chunk1, binPadded]);
}
