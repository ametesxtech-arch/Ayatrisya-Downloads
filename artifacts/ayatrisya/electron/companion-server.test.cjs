const assert = require("node:assert/strict");
const http = require("node:http");
const { afterEach, test } = require("node:test");
const { createCompanionServer } = require("./companion-server.cjs");

const ORIGIN = "https://ayatrisya.web.app";
const servers = [];

async function start(overrides = {}) {
  const { handlers: handlerOverrides = {}, ...config } = overrides;
  const server = createCompanionServer({
    port: 0,
    allowedOrigins: [ORIGIN, "https://other.example"],
    handlers: {
      confirmPair: async () => true,
      listProjects: async () => [{ id: "project-id", name: "demo", path: "/home/private/demo", available: true }],
      chooseProject: async () => ({ id: "project-id", name: "demo", path: "/home/private/demo" }),
      listFiles: async () => [{ name: "src", relativePath: "src", isDirectory: true, size: 0 }],
      readFile: async () => "safe source",
      createFile: async () => undefined,
      writeFile: async () => undefined,
      runCommand: async () => ({ cancelled: false, code: 0, stdout: "ok", stderr: "", timedOut: false }),
      ...handlerOverrides,
    },
    ...config,
  });
  servers.push(server);
  const address = await server.ready;
  return { server, port: address.port };
}

function request(port, { method = "GET", path = "/v1/status", origin = ORIGIN, token, body, host, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const bytes = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        Host: host || `127.0.0.1:${port}`,
        Origin: origin,
        "X-Ayatrisya-Protocol": "1",
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
        ...(bytes ? { "Content-Length": bytes.length } : {}),
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: text ? JSON.parse(text) : null,
        });
      });
    });
    request.on("error", reject);
    if (bytes) request.write(bytes);
    request.end();
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

test("binds to loopback and returns only a minimal health status", async () => {
  const { server, port } = await start();
  const response = await request(port);
  assert.equal(server.enabled, true);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { available: true, protocolVersion: 1, pairingRequired: true });
  assert.equal(response.headers["cache-control"], "no-store, max-age=0");
});

test("rejects an unapproved origin and unexpected Host header before pairing", async () => {
  const { port } = await start();
  assert.equal((await request(port, { origin: "https://evil.example" })).status, 403);
  assert.equal((await request(port, { host: "127.0.0.1.evil.example" })).status, 403);
  assert.equal((await request(port, { method: "POST", path: "/v1/pair", origin: "https://evil.example", body: {} })).status, 403);
});

test("requires native pairing approval and binds session tokens to the approved origin", async () => {
  let approvals = 0;
  const { port } = await start({ handlers: { confirmPair: async () => { approvals += 1; return true; } } });
  const paired = await request(port, { method: "POST", path: "/v1/pair", body: {} });
  assert.equal(approvals, 1);
  assert.equal(paired.status, 200);
  assert.match(paired.body.token, /^[A-Za-z0-9_-]{43}$/);

  const list = await request(port, { path: "/v1/projects", token: paired.body.token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.projects, [{ id: "project-id", name: "demo", available: true }]);
  assert.equal(JSON.stringify(list.body).includes("/home/private"), false);

  const wrongOrigin = await request(port, {
    path: "/v1/projects",
    origin: "https://other.example",
    token: paired.body.token,
  });
  assert.equal(wrongOrigin.status, 401);
});

test("a declined pairing returns no session token", async () => {
  const { port } = await start({ handlers: { confirmPair: async () => false } });
  const response = await request(port, { method: "POST", path: "/v1/pair", body: {} });
  assert.equal(response.status, 403);
  assert.equal("token" in response.body, false);
});

test("rejects unsupported fields, missing protocol headers, and oversized payloads", async () => {
  const { port } = await start();
  const missingProtocol = await request(port, { method: "POST", path: "/v1/pair", body: {}, headers: { "X-Ayatrisya-Protocol": "0" } });
  assert.equal(missingProtocol.status, 400);
  const extraField = await request(port, { method: "POST", path: "/v1/pair", body: { unrecognized: true } });
  assert.equal(extraField.status, 400);
  const oversized = await request(port, {
    method: "POST",
    path: "/v1/pair",
    body: Buffer.alloc(1_100_001, 0x20),
  });
  assert.equal(oversized.status, 413);
});

test("supports browser private-network preflight only for approved methods and headers", async () => {
  const { port } = await start();
  const allowed = await request(port, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type,x-ayatrisya-protocol",
    },
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers["access-control-allow-private-network"], "true");
  const denied = await request(port, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "DELETE",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  assert.equal(denied.status, 403);
});

test("disconnect revokes the in-memory token and records no token or file content", async () => {
  const { port } = await start();
  const paired = await request(port, { method: "POST", path: "/v1/pair", body: {} });
  const disconnected = await request(port, { method: "POST", path: "/v1/session/revoke", token: paired.body.token, body: {} });
  assert.deepEqual(disconnected.body, { disconnected: true });
  assert.equal((await request(port, { path: "/v1/projects", token: paired.body.token })).status, 401);
  const audit = await request(port, { path: "/v1/audit", token: "x".repeat(43) });
  assert.equal(audit.status, 401);
});

test("command cancellation is scoped to the paired session", async () => {
  const { port } = await start({
    handlers: {
      runCommand: async (_projectId, _command, _commandId, signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve({
          cancelled: true, code: null, stdout: "", stderr: "", timedOut: false,
        }), { once: true });
      }),
    },
  });
  const paired = await request(port, { method: "POST", path: "/v1/pair", body: {} });
  const commandId = "3b7e6093-d821-4c04-854b-2cb82fdb45f8";
  const running = request(port, {
    method: "POST",
    path: "/v1/commands/run",
    token: paired.body.token,
    body: { projectId: "project-id", command: "echo test", commandId },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const cancelled = await request(port, {
    method: "POST",
    path: "/v1/commands/cancel",
    token: paired.body.token,
    body: { commandId },
  });
  assert.deepEqual(cancelled.body, { cancelled: true });
  assert.equal((await running).body.cancelled, true);
});

test("supports one-time pairing code, enforces single-use, and rejects reused or expired codes", async () => {
  const { port } = await start({ handlers: { confirmPair: async () => true } });
  
  // 1. Generate one-time code
  const codeRes = await request(port, { method: "POST", path: "/v1/pair/code", body: {} });
  assert.equal(codeRes.status, 200);
  assert.match(codeRes.body.code, /^[A-F0-9]{12}$/);
  assert.ok(codeRes.body.expiresAt);

  // 2. Reject invalid code
  const invalidPair = await request(port, {
    method: "POST",
    path: "/v1/pair",
    body: { pairingCode: "INVALIDCODE12" },
  });
  assert.equal(invalidPair.status, 403);
  assert.match(invalidPair.body.error, /invalid or unrecognized/i);

  // 3. Successful pairing with code
  const validPair = await request(port, {
    method: "POST",
    path: "/v1/pair",
    body: { pairingCode: codeRes.body.code },
  });
  assert.equal(validPair.status, 200);
  assert.match(validPair.body.token, /^[A-Za-z0-9_-]{43}$/);

  // 4. Reject reuse of same code
  const reusePair = await request(port, {
    method: "POST",
    path: "/v1/pair",
    body: { pairingCode: codeRes.body.code },
  });
  assert.equal(reusePair.status, 403);
  assert.match(reusePair.body.error, /invalid or unrecognized|already been used/i);
});

