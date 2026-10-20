const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MODEL_PATHS = new Set(["/health", "/capabilities", "/chat"]);
const MAX_CHAT_BYTES = 1024 * 1024;

function validateLocalModelEndpoint(raw) {
  if (typeof raw !== "string" || raw.length > 512 || !raw.trim()) {
    throw new Error("Enter a local model URL.");
  }
  let endpoint;
  try {
    endpoint = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid local model URL.");
  }
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/" ||
    !LOOPBACK_HOSTS.has(endpoint.hostname.toLowerCase())
  ) {
    throw new Error("Use a loopback URL such as http://127.0.0.1:1234, without a path, credentials, query, or fragment.");
  }
  return endpoint.origin;
}

function validateLocalModelRequest(requestPath, method, body) {
  if (!MODEL_PATHS.has(requestPath)) throw new Error("This local model operation is not permitted.");
  if (requestPath === "/health" || requestPath === "/capabilities") {
    if (method !== "GET" || body !== undefined) throw new Error("This local model operation is not permitted.");
    return { path: requestPath, method: "GET", body: undefined };
  }
  if (method !== "POST" || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("The local chat request is invalid.");
  }
  const allowedKeys = new Set(["messages", "model", "mode", "stream"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) throw new Error("The local chat request contains unsupported options.");
  if (
    !Array.isArray(body.messages) ||
    body.messages.length < 1 ||
    body.messages.length > 100 ||
    !["v1-fast", "v2-best"].includes(body.model) ||
    !["Normal", "Savage", "Joke"].includes(body.mode) ||
    body.stream !== false
  ) {
    throw new Error("The local chat request is invalid.");
  }
  let totalBytes = 0;
  for (const message of body.messages) {
    if (
      !message ||
      typeof message !== "object" ||
      Array.isArray(message) ||
      Object.keys(message).some((key) => !["role", "content"].includes(key)) ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) {
      throw new Error("The local chat request contains an invalid message.");
    }
    totalBytes += Buffer.byteLength(message.content, "utf8");
  }
  if (totalBytes > MAX_CHAT_BYTES || Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_CHAT_BYTES) {
    throw new Error("The local chat request is larger than 1 MB.");
  }
  return { path: "/chat", method: "POST", body };
}

module.exports = { validateLocalModelEndpoint, validateLocalModelRequest };
