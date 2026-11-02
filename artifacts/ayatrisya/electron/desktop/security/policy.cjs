const { URL } = require("node:url");

const PROHIBITED_REMOTE_IPS = [
  /^127\./, // loopback (unless explicitly allowed for local testing)
  /^10\./, // RFC 1918
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC 1918
  /^192\.168\./, // RFC 1918
  /^169\.254\./, // link-local / cloud metadata (AWS, GCP, Azure 169.254.169.254)
  /^fc00:/i, // IPv6 private
  /^fe80:/i, // IPv6 link-local
  /^::1$/, // IPv6 loopback
];

/**
 * Asserts that a local runtime strictly binds to loopback (127.0.0.1).
 */
function assertLoopbackAddress(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid local URL format: '${urlStr}'.`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && host !== "[::1]") {
    throw new Error(`Security Violation: Local runtime must bind exclusively to loopback (127.0.0.1). Target '${host}' is prohibited.`);
  }
}

/**
 * Validates a user-configured remote model endpoint for safety and SSRF prevention.
 * - Enforces HTTPS scheme for remote internet hosts.
 * - Allows HTTP ONLY for explicit local loopback (e.g. local Ollama, LM Studio, vLLM).
 * - Blocks internal private IP ranges (169.254.x.x, 10.x.x.x, etc.) on remote connections.
 */
function validateRemoteEndpointSecurity(endpointUrl) {
  if (!endpointUrl || typeof endpointUrl !== "string") {
    return { valid: false, error: "Endpoint URL is required." };
  }

  const trimmed = endpointUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: `Invalid endpoint URL syntax: '${trimmed}'.` };
  }

  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";

  if (isLoopback) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Local endpoints must use HTTP or HTTPS." };
    }
    return { valid: true, isLocal: true, sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, "") };
  }

  // Remote host requirements
  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Security Violation: Remote endpoints must use HTTPS encryption (received '${parsed.protocol}'). Unencrypted HTTP over the public internet is forbidden.`,
    };
  }

  // SSRF protection: reject private network IPs and cloud metadata
  for (const pattern of PROHIBITED_REMOTE_IPS) {
    if (pattern.test(host)) {
      return {
        valid: false,
        error: `Security Violation: Access to private network addresses or cloud metadata endpoints (${host}) is prohibited for remote providers.`,
      };
    }
  }

  return {
    valid: true,
    isLocal: false,
    sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ""),
  };
}

/**
 * Redacts secrets, auth tokens, API keys, and sensitive prompts from diagnostic logs.
 */
function redactDiagnosticData(text) {
  if (typeof text !== "string") return String(text || "");

  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED_TOKEN]")
    .replace(/(sk-[A-Za-z0-9_-]{10})[A-Za-z0-9_-]+/g, "$1...[REDACTED_KEY]")
    .replace(/(AIzaSy[A-Za-z0-9_-]{10})[A-Za-z0-9_-]+/g, "$1...[REDACTED_KEY]")
    .replace(/(["']?password["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[REDACTED_PASSWORD]$2')
    .replace(/(["']?apiKey["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[REDACTED_API_KEY]$2')
    .replace(/(["']?secret["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[REDACTED_SECRET]$2');
}

module.exports = {
  assertLoopbackAddress,
  validateRemoteEndpointSecurity,
  redactDiagnosticData,
};
