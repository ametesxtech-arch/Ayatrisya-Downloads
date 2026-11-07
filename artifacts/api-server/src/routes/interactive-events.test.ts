import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import app from "../app";

describe("Interactive Component Events API", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(app);
    server.listen(0);
    await once(server, "listening");
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, "close");
  });

  it("processes arithmetic calculator event safely", async () => {
    const res = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "calc-1",
        blockType: "calculator",
        action: "calculate",
        payload: {
          formula: "a * b + c",
          inputs: { a: 10, b: 5, c: 2 },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("success");
    expect(body.result).toBe(52);
  });

  it("rejects malicious or unsafe calculator expressions", async () => {
    const res = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "calc-2",
        blockType: "calculator",
        action: "calculate",
        payload: {
          formula: "process.exit()",
          inputs: {},
        },
      }),
    });

    expect(res.status).toBe(400);
  });

  it("records interactive poll votes and updates tally", async () => {
    const res1 = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "poll-features",
        blockType: "poll",
        action: "vote",
        payload: { optionId: "opt_mcq" },
      }),
    });

    expect(res1.status).toBe(200);
    const body1: any = await res1.json();
    expect(body1.status).toBe("recorded");
    expect(body1.votes["opt_mcq"]).toBeGreaterThanOrEqual(1);

    const res2 = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "poll-features",
        blockType: "poll",
        action: "vote",
        payload: { optionId: "opt_mcq" },
      }),
    });

    expect(res2.status).toBe(200);
    const body2: any = await res2.json();
    expect(body2.votes["opt_mcq"]).toBe(body1.votes["opt_mcq"] + 1);
  });

  it("handles form submissions with structured payload", async () => {
    const res = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "form-feedback",
        blockType: "form",
        action: "submit",
        payload: {
          rating: 5,
          comment: "Excellent interactive assessment engine!",
        },
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("submitted");
    expect(body.submittedFields.rating).toBe(5);
  });

  it("handles table sorting and filtering events", async () => {
    const tableRows = [
      ["React", 100],
      ["Vue", 50],
      ["Angular", 75],
    ];
    const columns = ["Framework", "Stars"];

    // Sort descending by Stars
    const sortRes = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "table-1",
        blockType: "table",
        action: "sort",
        payload: {
          column: "Stars",
          direction: "desc",
          columns,
          rows: tableRows,
        },
      }),
    });
    expect(sortRes.status).toBe(200);
    const sortBody: any = await sortRes.json();
    expect(sortBody.status).toBe("sorted");
    expect(sortBody.sortedRows[0][0]).toBe("React");
    expect(sortBody.sortedRows[2][0]).toBe("Vue");

    // Filter table rows
    const filterRes = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "table-1",
        blockType: "table",
        action: "filter",
        payload: {
          query: "ang",
          rows: tableRows,
        },
      }),
    });
    expect(filterRes.status).toBe(200);
    const filterBody: any = await filterRes.json();
    expect(filterBody.status).toBe("filtered");
    expect(filterBody.filteredRows.length).toBe(1);
    expect(filterBody.filteredRows[0][0]).toBe("Angular");
  });

  it("handles chart series filtering", async () => {
    const res = await fetch(`${baseUrl}/api/interactive/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockId: "chart-1",
        blockType: "chart",
        action: "filter_series",
        payload: { activeSeries: ["revenue"] },
      }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("series_filtered");
    expect(body.activeSeries).toEqual(["revenue"]);
  });
});
