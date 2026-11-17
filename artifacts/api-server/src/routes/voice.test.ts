import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import app from "../app";

describe("Voice Intelligence & Speech Synthesis API", () => {
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

  it("GET /api/voice/profiles returns neural personas and multilingual capability", async () => {
    const res = await fetch(`${baseUrl}/api/voice/profiles`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.defaultProfile).toBe("ayatrisya-neural");
    expect(data.profiles.length).toBe(3);
    expect(data.supportedLanguages).toContain("Hindi");
    expect(data.supportedLanguages).toContain("Odia");
  });

  it("POST /api/voice/normalize correctly normalizes currency, acronyms, and Indian phonetics", async () => {
    const res = await fetch(`${baseUrl}/api/voice/normalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Namaste! Welcome to Ayatrisya API. The subscription fee is ₹500 with 18% GST.",
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.normalizedText).toContain("500 rupees");
    expect(data.normalizedText).toContain("percent");
    expect(data.normalizedText).toContain("A P I");
    expect(data.normalizedText).toContain("Aaya-tree-sha");
  });

  it("POST /api/voice/synthesize returns valid 24kHz PCM WAV audio binary", async () => {
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Ayatrisya distributed engine is operational.",
        voice: "ayatrisya-neural",
        speed: 1.0,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/wav");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify RIFF and WAVE header magic
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buffer.toString("ascii", 12, 16)).toBe("fmt ");
  });

  it("rejects invalid speech synthesis parameters with 400", async () => {
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "", // empty text
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
  });
});
