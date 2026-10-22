function configuredHttpsOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const candidate = value.trim().includes("://")
    ? value.trim()
    : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      url.origin === origin &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedApiOrigin(
  origin: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origin) return false;
  let requestOrigin: string;
  try {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    ) {
      return false;
    }
    requestOrigin = parsed.origin;
  } catch {
    return false;
  }

  const configuredOrigins = [
    configuredHttpsOrigin(environment.AYATRISYA_APP_ORIGIN),
    ...(environment.REPLIT_DOMAINS ?? "")
      .split(",")
      .map((domain) => configuredHttpsOrigin(domain)),
  ].filter((value): value is string => Boolean(value));

  if (configuredOrigins.includes(requestOrigin)) return true;

  if (environment.NODE_ENV !== "production") {
    const devOrigin = configuredHttpsOrigin(environment.REPLIT_DEV_DOMAIN);
    if (devOrigin && requestOrigin === devOrigin) return true;
    return isLoopbackOrigin(requestOrigin);
  }

  return false;
}
