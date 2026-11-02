import { firebaseAuth, firebaseConfigured } from "@/integrations/firebase/client";

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  token?: string;
}

const LOCAL_HOST_PATTERN = /(?:^|\/\/)(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

/**
 * Validates whether an API URL is secure and compliant with production policies.
 * In production:
 * - Must use HTTPS scheme.
 * - Must not target localhost or loopback addresses.
 */
export function validateApiEndpoint(url: string, isProduction: boolean = false): { valid: boolean; error?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: `Invalid API URL format: '${url}'.` };
  }

  if (isProduction) {
    if (LOCAL_HOST_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error: `In production, the API URL cannot use localhost or loopback addresses (${parsed.hostname}).`,
      };
    }
    if (parsed.protocol !== "https:") {
      return {
        valid: false,
        error: `In production, the API URL must use HTTPS (received protocol '${parsed.protocol}').`,
      };
    }
  }

  return { valid: true };
}

/**
 * Resolves the configured base URL for the Ayatrisya Render API Gateway.
 * Prioritizes VITE_API_URL, then VITE_API_SERVER_URL.
 * Enforces production security constraints (HTTPS only, no localhost).
 */
export const DEFAULT_API_BASE_URL = "https://ayatrisya-model-api.onrender.com";

export function getApiBaseUrl(): string {
  const envUrl = (
    (typeof import.meta !== "undefined" &&
      ((import.meta.env?.VITE_API_URL as string | undefined) ||
        (import.meta.env?.VITE_API_SERVER_URL as string | undefined))) ||
    ""
  ).trim().replace(/\/+$/, "");

  const isProd = typeof import.meta !== "undefined" && Boolean(import.meta.env?.PROD);

  if (envUrl) {
    const validation = validateApiEndpoint(envUrl, isProd);
    if (!validation.valid) {
      throw new Error(`Ayatrisya API configuration error: ${validation.error}`);
    }
  }

  return envUrl;
}

/**
 * Constructs a fully qualified API URL from a relative API path.
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (baseUrl) {
    return `${baseUrl}${normalizedPath}`;
  }
  const isDesktop = typeof window !== "undefined" && Boolean(window.ayatrisyaDesktop?.isDesktop);
  if (isDesktop) {
    return `${DEFAULT_API_BASE_URL}${normalizedPath}`;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.includes("ayatrisya.web.app") || origin.includes("ayatrisya.firebaseapp.com")) {
      return `${DEFAULT_API_BASE_URL}${normalizedPath}`;
    }
    return `${origin}${normalizedPath}`;
  }
  return `${DEFAULT_API_BASE_URL}${normalizedPath}`;
}

/**
 * Retrieves the current Firebase user ID token if available, or returns "guest".
 */
export async function getAuthToken(): Promise<string> {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem("ayatrisya:desktop-session:v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.token && parsed.expiresAt > Date.now()) {
          return parsed.token;
        }
      }
    } catch {}
  }
  if (firebaseConfigured) {
    try {
      const user = firebaseAuth().currentUser;
      if (user) {
        return await user.getIdToken();
      }
    } catch {
      // Continue to guest
    }
  }
  return "guest";
}

/**
 * Centralized, secure API fetch client.
 * Enforces:
 * - Proper API Gateway base URL resolution.
 * - In-flight timeout and cancellation support.
 * - Authorization header injection.
 * - HTML response rejection (protects against static SPA fallback 404s).
 * - Standardized error extraction.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 120_000, token, signal, headers: initialHeaders, ...fetchOptions } = options;

  if (signal?.aborted) {
    throw new DOMException("The API request was cancelled.", "AbortError");
  }

  const url = buildApiUrl(path);
  const controller = new AbortController();

  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    signal.addEventListener("abort", onAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException(`The request to ${path} timed out after ${timeoutMs}ms.`, "TimeoutError"));
  }, timeoutMs);

  try {
    const headers = new Headers(initialHeaders);
    if (!headers.has("Authorization")) {
      const authToken = token || (await getAuthToken());
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
    if (fetchOptions.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isHtml = /text\/html/i.test(contentType);

    if (isHtml) {
      throw new Error(
        response.status === 404
          ? `API endpoint was not found (404 HTML). Ensure the Render API server is deployed and route '${path}' is reachable.`
          : response.status === 502 || response.status === 503
            ? "The Ayatrisya API server or upstream service is temporarily unavailable."
            : "The API server returned an HTML error page instead of valid JSON.",
      );
    }

    let bodyData: any = null;
    if (/application\/json/i.test(contentType)) {
      bodyData = await response.json().catch(() => null);
    }

    if (!response.ok) {
      let errorMessage = "";
      if (bodyData && typeof bodyData === "object" && typeof bodyData.error === "string") {
        errorMessage = bodyData.error;
      }
      throw new Error(
        errorMessage ||
          (response.status === 503
            ? "The Ayatrisya service is temporarily unavailable. Please retry later."
            : `API request failed with status ${response.status}.`),
      );
    }

    return bodyData as T;
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
