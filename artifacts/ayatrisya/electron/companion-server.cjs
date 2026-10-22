const http = require("node:http");
const { createHash, randomBytes } = require("node:crypto");

const DEFAULT_PORT = 49381;
const MAX_REQUEST_BYTES = 1_100_000;
const MAX_RESPONSE_BYTES = 2_200_000;
const SESSION_TTL_MS = 15 * 60 * 1000;
const PROTOCOL_HEADER = "x-ayatrisya-protocol";
const ALLOWED_REQUEST_HEADERS = "authorization,content-type,x-ayatrisya-protocol";

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safePublicError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "ENOENT" || code === "ENOTDIR") return "The selected local file or folder is unavailable.";
  if (code === "EACCES" || code === "EPERM") return "The operating system denied access to the selected file or folder.";
  if (code === "EEXIST") return "A file with that name already exists.";
  const message = typeof error?.message === "string" ? error.message : "";
  if (!message || message.length > 500) return "The desktop operation failed. Check Ayatrisya Desktop for details.";
  return message
    .replace(/(?:[A-Za-z]:\\|\/(?:home|Users|tmp|private|var)\/)[^\r\n]*/g, "[local path]")
    .slice(0, 300);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function assertKeys(value, required, optional = []) {
  if (!isPlainObject(value)) throw Object.assign(new Error("The request body is invalid."), { statusCode: 400 });
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) {
    throw Object.assign(new Error("The request body contains missing or unsupported fields."), { statusCode: 400 });
  }
}

function createRateLimiter({ now, windowMs = 60_000, limit = 120 }) {
  const buckets = new Map();
  return (key, maximum = limit) => {
    const timestamp = now();
    let bucket = buckets.get(key);
    if (!bucket || timestamp - bucket.startedAt >= windowMs) {
      bucket = { startedAt: timestamp, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 512) {
      for (const [bucketKey, value] of buckets) {
        if (timestamp - value.startedAt >= windowMs) buckets.delete(bucketKey);
      }
    }
    return bucket.count <= maximum;
  };
}

async function readJson(request, response) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) {
      response.writeHead(413).end();
      throw Object.assign(new Error("The request is too large."), { responseSent: true });
    }
    chunks.push(chunk);
  }
  if (!bytes) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("The request body is not valid JSON."), { statusCode: 400 });
  }
}

function createCompanionServer({
  port = DEFAULT_PORT,
  allowedOrigins = [],
  handlers = {},
  now = () => Date.now(),
  sessionTtlMs = SESSION_TTL_MS,
}) {
  const origins = new Set(allowedOrigins);
  const sessions = new Map();
  const activeCommands = new Map();
  const audit = [];
  const permit = createRateLimiter({ now });
  let closed = false;
  let actualPort = port;

  function record(operation, status) {
    audit.unshift({ at: new Date(now()).toISOString(), operation, status });
    if (audit.length > 200) audit.length = 200;
  }

  function headers(response, origin) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Vary", "Origin");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", ALLOWED_REQUEST_HEADERS);
    response.setHeader("Access-Control-Allow-Private-Network", "true");
    response.setHeader("Access-Control-Max-Age", "0");
  }

  function send(response, statusCode, body) {
    const bytes = Buffer.from(JSON.stringify(body));
    if (bytes.length > MAX_RESPONSE_BYTES) {
      response.writeHead(500).end();
      return;
    }
    response.writeHead(statusCode, { "Content-Length": bytes.length });
    response.end(bytes);
  }

  function validateRequest(request, response) {
    const origin = request.headers.origin;
    if (typeof origin !== "string" || !origins.has(origin)) {
      send(response, 403, { error: "This website is not allowed to use the Ayatrisya desktop companion." });
      return null;
    }
    if (request.headers.host !== `127.0.0.1:${actualPort}`) {
      headers(response, origin);
      send(response, 403, { error: "The desktop companion received an unexpected host." });
      return null;
    }
    const remote = request.socket.remoteAddress;
    if (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1") {
      headers(response, origin);
      send(response, 403, { error: "The desktop companion accepts loopback connections only." });
      return null;
    }
    headers(response, origin);
    return origin;
  }

  function getSession(request, origin) {
    const authorization = request.headers.authorization;
    const match = typeof authorization === "string" && authorization.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!match) return null;
    const key = hashToken(match[1]);
    const session = sessions.get(key);
    if (!session || session.expiresAt <= now() || session.origin !== origin) {
      sessions.delete(key);
      return null;
    }
    return { key, session };
  }

  async function requireBody(request, response) {
    const contentType = request.headers["content-type"];
    if (typeof contentType !== "string" || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      throw Object.assign(new Error("Send a JSON request body."), { statusCode: 415 });
    }
    return readJson(request, response);
  }

  async function handle(request, response) {
    const origin = validateRequest(request, response);
    if (!origin) return;

    if (request.method === "OPTIONS") {
      const requestedMethod = request.headers["access-control-request-method"];
      const requestedHeaders = String(request.headers["access-control-request-headers"] || "")
        .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
      if (!["GET", "POST"].includes(String(requestedMethod || "").toUpperCase()) ||
          requestedHeaders.some((value) => !ALLOWED_REQUEST_HEADERS.split(",").includes(value))) {
        send(response, 403, { error: "The browser requested an unsupported companion operation." });
        return;
      }
      response.writeHead(204, { "Content-Length": 0 }).end();
      return;
    }

    if (request.method !== "GET" && request.method !== "POST") {
      send(response, 405, { error: "This companion operation is not supported." });
      return;
    }
    if (!permit(`${request.socket.remoteAddress}:requests`)) {
      send(response, 429, { error: "Too many companion requests. Wait a moment and try again." });
      return;
    }

    let pathname;
    try {
      pathname = new URL(request.url || "/", `http://127.0.0.1:${actualPort}`).pathname;
    } catch {
      send(response, 400, { error: "The request URL is invalid." });
      return;
    }
    if (request.headers[PROTOCOL_HEADER] !== "1" && pathname !== "/v1/status") {
      send(response, 400, { error: "The Ayatrisya companion protocol version is missing or unsupported." });
      return;
    }

    try {
      if (request.method === "GET" && pathname === "/v1/status") {
        send(response, 200, { available: true, protocolVersion: 1, pairingRequired: true });
        return;
      }

      if (request.method === "POST" && pathname === "/v1/pair") {
        if (!permit(`${request.socket.remoteAddress}:pair`, 5)) {
          send(response, 429, { error: "Too many pairing requests. Wait and try again." });
          return;
        }
        const body = await requireBody(request, response);
        assertKeys(body, []);
        for (const [key, session] of sessions) {
          if (session.expiresAt <= now()) sessions.delete(key);
        }
        if (sessions.size >= 8) throw Object.assign(new Error("Too many active browser sessions. Disconnect an existing session first."), { statusCode: 429 });
        if (typeof handlers.confirmPair !== "function" || !(await handlers.confirmPair(origin))) {
          record("pair", "denied");
          send(response, 403, { error: "The desktop user declined the browser connection." });
          return;
        }
        const token = randomBytes(32).toString("base64url");
        const key = hashToken(token);
        const expiresAt = now() + sessionTtlMs;
        sessions.set(key, { origin, expiresAt });
        record("pair", "approved");
        send(response, 200, {
          token,
          expiresAt: new Date(expiresAt).toISOString(),
          capabilities: ["project-list", "project-picker", "source-file-read", "source-file-write", "confirmed-commands", "audit-log"],
        });
        return;
      }

      if (request.method === "POST" && pathname === "/v1/session/revoke") {
        const authorized = getSession(request, origin);
        if (!authorized) {
          send(response, 401, { error: "Pair this browser with Ayatrisya Desktop again." });
          return;
        }
        sessions.delete(authorized.key);
        for (const [key, controller] of activeCommands) {
          if (key.startsWith(`${authorized.key}:`)) {
            controller.abort();
            activeCommands.delete(key);
          }
        }
        record("disconnect", "completed");
        send(response, 200, { disconnected: true });
        return;
      }

      const authorized = getSession(request, origin);
      if (!authorized) {
        send(response, 401, { error: "Pair this browser with Ayatrisya Desktop again." });
        return;
      }
      if (!permit(`${authorized.key}:requests`)) {
        send(response, 429, { error: "This browser is making too many requests. Wait a moment and try again." });
        return;
      }

      if (request.method === "GET" && pathname === "/v1/projects") {
        const projects = await handlers.listProjects();
        const safeProjects = projects.slice(0, 100).map(({ id, name, available }) => ({ id, name, available }));
        record("project-list", "completed");
        send(response, 200, { projects: safeProjects });
        return;
      }
      if (request.method === "GET" && pathname === "/v1/audit") {
        send(response, 200, { entries: audit.slice(0, 100) });
        return;
      }

      if (request.method === "POST" && pathname === "/v1/projects/choose") {
        const body = await requireBody(request, response);
        assertKeys(body, []);
        const project = await handlers.chooseProject();
        record("project-picker", project ? "approved" : "cancelled");
        send(response, 200, { project: project ? { id: project.id, name: project.name, available: true } : null });
        return;
      }
      if (request.method === "POST" && pathname === "/v1/projects/remove") {
        const body = await requireBody(request, response);
        assertKeys(body, ["projectId"]);
        if (typeof body.projectId !== "string") {
          throw Object.assign(new Error("The selected project is invalid."), { statusCode: 400 });
        }
        const removed = await handlers.removeProject(body.projectId, origin);
        record("project-access-remove", removed ? "approved" : "cancelled");
        send(response, 200, { removed: Boolean(removed) });
        return;
      }

      if (request.method === "POST" && pathname === "/v1/files/list") {
        const body = await requireBody(request, response);
        assertKeys(body, ["projectId", "relativePath"]);
        if (typeof body.projectId !== "string" || typeof body.relativePath !== "string") {
          throw Object.assign(new Error("The selected project or folder is invalid."), { statusCode: 400 });
        }
        const files = await handlers.listFiles(body.projectId, body.relativePath);
        record("file-list", "completed");
        send(response, 200, { files: files.slice(0, 2000) });
        return;
      }
      if (request.method === "POST" && pathname === "/v1/files/read") {
        const body = await requireBody(request, response);
        assertKeys(body, ["projectId", "relativePath"]);
        if (typeof body.projectId !== "string" || typeof body.relativePath !== "string") {
          throw Object.assign(new Error("The selected file is invalid."), { statusCode: 400 });
        }
        const content = await handlers.readFile(body.projectId, body.relativePath);
        record("file-read", "completed");
        send(response, 200, { content });
        return;
      }
      if (request.method === "POST" && pathname === "/v1/files/create") {
        const body = await requireBody(request, response);
        assertKeys(body, ["projectId", "relativePath"]);
        if (typeof body.projectId !== "string" || typeof body.relativePath !== "string") {
          throw Object.assign(new Error("The selected file is invalid."), { statusCode: 400 });
        }
        await handlers.createFile(body.projectId, body.relativePath, origin);
        record("file-create", "approved");
        send(response, 200, { created: true });
        return;
      }
      if (request.method === "POST" && pathname === "/v1/files/write") {
        const body = await requireBody(request, response);
        assertKeys(body, ["projectId", "relativePath", "content"]);
        if (typeof body.projectId !== "string" || typeof body.relativePath !== "string" || typeof body.content !== "string") {
          throw Object.assign(new Error("The file edit is invalid."), { statusCode: 400 });
        }
        await handlers.writeFile(body.projectId, body.relativePath, body.content, origin);
        record("file-write", "approved");
        send(response, 200, { saved: true });
        return;
      }
      if (request.method === "POST" && pathname === "/v1/commands/run") {
        const body = await requireBody(request, response);
        assertKeys(body, ["projectId", "command", "commandId"]);
        if (typeof body.projectId !== "string" || typeof body.command !== "string" ||
            typeof body.commandId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.commandId)) {
          throw Object.assign(new Error("The command request is invalid."), { statusCode: 400 });
        }
        const commandKey = `${authorized.key}:${body.commandId}`;
        if (activeCommands.has(commandKey)) throw Object.assign(new Error("That command is already running."), { statusCode: 409 });
        const controller = new AbortController();
        activeCommands.set(commandKey, controller);
        try {
          const result = await handlers.runCommand(body.projectId, body.command, body.commandId, controller.signal);
          record("command", result?.cancelled ? "cancelled" : "completed");
          send(response, 200, result);
        } finally {
          activeCommands.delete(commandKey);
        }
        return;
      }
      if (request.method === "POST" && pathname === "/v1/commands/cancel") {
        const body = await requireBody(request, response);
        assertKeys(body, ["commandId"]);
        if (typeof body.commandId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.commandId)) {
          throw Object.assign(new Error("The command request is invalid."), { statusCode: 400 });
        }
        const controller = activeCommands.get(`${authorized.key}:${body.commandId}`);
        if (!controller) {
          send(response, 404, { cancelled: false });
          return;
        }
        controller.abort();
        record("command-cancel", "requested");
        send(response, 200, { cancelled: true });
        return;
      }

      send(response, 404, { error: "That desktop companion operation does not exist." });
    } catch (error) {
      if (error?.responseSent || response.destroyed || response.writableEnded) return;
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
      record("operation", "failed");
      send(response, statusCode, { error: safePublicError(error) });
    }
  }

  const server = http.createServer((request, response) => {
    void handle(request, response);
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 70_000;
  server.keepAliveTimeout = 5_000;

  const ready = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("The local companion did not receive a loopback address."));
        return;
      }
      actualPort = address.port;
      server.removeListener("error", reject);
      resolve({ port: actualPort, host: "127.0.0.1" });
    });
  });

  return {
    ready,
    get port() { return actualPort; },
    get enabled() { return !closed && server.listening; },
    close: async () => {
      if (closed) return;
      closed = true;
      sessions.clear();
      for (const controller of activeCommands.values()) controller.abort();
      activeCommands.clear();
      const closePromise = new Promise((resolve) => server.close(() => resolve()));
      server.closeAllConnections?.();
      await closePromise;
    },
  };
}

module.exports = { DEFAULT_PORT, createCompanionServer, safePublicError };
