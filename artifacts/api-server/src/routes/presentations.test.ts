import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import app from "../app";

describe("Presentation Engine API", () => {
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

  it("GET /api/presentations/themes returns curated palettes with WCAG ratings", async () => {
    const res = await fetch(`${baseUrl}/api/presentations/themes`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.themes).toBeDefined();
    expect(Array.isArray(data.themes)).toBe(true);
    expect(data.themes.length).toBeGreaterThanOrEqual(4);

    const emeraldTheme = data.themes.find((t: any) => t.id === "slate_emerald");
    expect(emeraldTheme).toBeDefined();
    expect(emeraldTheme.wcagRating).toBe("AAA");
  });

  it("POST /api/presentations/generate creates a 16:9 deck with diverse archetypes", async () => {
    const res = await fetch(`${baseUrl}/api/presentations/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "Autonomous Distributed Agents",
        slideCount: 6,
        theme: "slate_emerald",
        audience: "Engineering Leaders",
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.deck).toBeDefined();
    expect(data.deck.aspectRatio).toBe("16:9");
    expect(data.deck.slides.length).toBe(6);

    // Verify slide 1 is title with speaker notes
    expect(data.deck.slides[0].archetype).toBe("title");
    expect(data.deck.slides[0].speakerNotes).toBeTruthy();

    // Verify slide 6 is takeaways
    expect(data.deck.slides[5].archetype).toBe("takeaways");
    expect(data.deck.slides[5].bullets?.length).toBeLessThanOrEqual(5);

    // Verify no consecutive identical archetypes
    for (let i = 0; i < data.deck.slides.length - 1; i++) {
      expect(data.deck.slides[i].archetype).not.toBe(data.deck.slides[i + 1].archetype);
    }
  });

  it("POST /api/presentations/export-pptx exports clean standards-compliant PPTX binary", async () => {
    const res = await fetch(`${baseUrl}/api/presentations/export-pptx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "Edge Computing in 2026",
        slideCount: 4,
        theme: "obsidian_gold",
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(res.headers.get("Content-Disposition")).toContain("attachment;");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify standard PKZIP magic number: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  it("rejects invalid presentation generation requests with 400", async () => {
    const res = await fetch(`${baseUrl}/api/presentations/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "A", // too short (min 2)
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
  });
});
