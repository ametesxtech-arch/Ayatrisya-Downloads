import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createHash } from "node:crypto";
import app from "../app";

describe("500MB Chunked Resumable Upload & Document Intelligence API", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("POST /api/uploads/init rejects files exceeding 500 MB limit", async () => {
    const res = await fetch(`${baseUrl}/api/uploads/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "massive_archive.iso",
        fileSize: 600 * 1024 * 1024, // 600 MB
        totalChunks: 60,
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain("500 MB");
  });

  it("completes full chunked upload, integrity check, and document intelligence pipeline", async () => {
    // Sample document content
    const part1Text = `# Executive Overview: Quantum Artificial Intelligence

Quantum computing harnesses the principles of superposition and entanglement to compute complex operational matrices.

## Architectural Foundations

The primary design principle isolates noisy intermediate-scale quantum (NISQ) registers while synchronizing classical control loops.`;

    const part2Text = `

## Empirical Benchmarks & Performance

Across verified trials, the hybrid quantum-classical pipeline demonstrated a 4.2x optimization lift for multi-variable logistics routing.

## Strategic Recommendations

Organizations should establish quantum-resilient cryptographic perimeters before transitioning production workflows.`;

    const fullText = part1Text + part2Text;
    const fullHash = createHash("sha256").update(Buffer.from(fullText, "utf-8")).digest("hex");

    const chunk0Buf = Buffer.from(part1Text, "utf-8");
    const chunk0Hash = createHash("sha256").update(chunk0Buf).digest("hex");

    const chunk1Buf = Buffer.from(part2Text, "utf-8");
    const chunk1Hash = createHash("sha256").update(chunk1Buf).digest("hex");

    // 1. Initialize session
    const initRes = await fetch(`${baseUrl}/api/uploads/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "quantum_architecture_report.md",
        fileSize: chunk0Buf.length + chunk1Buf.length,
        mimeType: "text/markdown",
        totalChunks: 2,
        clientHash: fullHash,
      }),
    });

    expect(initRes.status).toBe(201);
    const initData = (await initRes.json()) as any;
    expect(initData.uploadId).toBeDefined();
    const uploadId = initData.uploadId;

    // 2. Upload Chunk 0
    const chunk0Res = await fetch(`${baseUrl}/api/uploads/${uploadId}/chunk`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-chunk-index": "0",
        "x-chunk-checksum": chunk0Hash,
      },
      body: chunk0Buf,
    });

    expect(chunk0Res.status).toBe(200);
    const chunk0Data = (await chunk0Res.json()) as any;
    expect(chunk0Data.progressPercent).toBe(50);

    // 3. Check status midway
    const statusRes = await fetch(`${baseUrl}/api/uploads/${uploadId}/status`);
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as any;
    expect(statusData.uploadedChunks).toEqual([0]);
    expect(statusData.progressPercent).toBe(50);

    // 4. Upload Chunk 1
    const chunk1Res = await fetch(`${baseUrl}/api/uploads/${uploadId}/chunk`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-chunk-index": "1",
        "x-chunk-checksum": chunk1Hash,
      },
      body: chunk1Buf,
    });

    expect(chunk1Res.status).toBe(200);
    const chunk1Data = (await chunk1Res.json()) as any;
    expect(chunk1Data.progressPercent).toBe(100);

    // 5. Complete and Assemble
    const completeRes = await fetch(`${baseUrl}/api/uploads/${uploadId}/complete`, {
      method: "POST",
    });

    expect(completeRes.status).toBe(200);
    const completeData = (await completeRes.json()) as any;
    expect(completeData.sha256.toLowerCase()).toBe(fullHash.toLowerCase());
    expect(completeData.analysis).toBeDefined();
    expect(completeData.analysis.executiveSummary).toBeTruthy();
    expect(completeData.analysis.totalWords).toBeGreaterThan(30);

    // 6. Grounded Citation Retrieval Query
    const queryRes = await fetch(`${baseUrl}/api/uploads/${uploadId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "quantum benchmarks and optimization lift",
      }),
    });

    expect(queryRes.status).toBe(200);
    const queryData = (await queryRes.json()) as any;
    expect(queryData.citations.length).toBeGreaterThanOrEqual(1);
    expect(queryData.citations[0].pageOrSection).toBeDefined();
    expect(queryData.groundedContext).toContain("Citation:");

    // 7. Cleanup
    const deleteRes = await fetch(`${baseUrl}/api/uploads/${uploadId}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
  });
});
