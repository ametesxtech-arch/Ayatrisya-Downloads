import { createHash } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  createOAuthState,
  createPkcePair,
  openOAuthCookie,
  sealOAuthCookie,
} from "../lib/oauth-security";
import { verifiedFirebaseUid } from "../lib/firebase-auth";

const router: IRouter = Router();
const STATE_TTL_MS = 10 * 60 * 1000;
const CONNECTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COOKIE_ROOT = "/api/integrations";

type Provider = "github" | "figma";
type OAuthState = {
  provider: Provider;
  state: string;
  verifier: string;
  origin: string;
  firebaseUid: string;
  createdAt: number;
};
type ProviderSession = {
  version: 1;
  provider: Provider;
  firebaseUid: string;
  accessToken: string;
  accountName: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
};

const providers: Record<Provider, {
  label: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
  refreshUrl: string;
  userUrl: string;
  clientId: string;
  clientSecret: string;
}> = {
  github: {
    label: "GitHub",
    scope: "read:user",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    refreshUrl: "https://github.com/login/oauth/access_token",
    userUrl: "https://api.github.com/user",
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "",
  },
  figma: {
    label: "Figma",
    scope: "current_user:read",
    authorizeUrl: "https://www.figma.com/oauth",
    tokenUrl: "https://api.figma.com/v1/oauth/token",
    refreshUrl: "https://api.figma.com/v1/oauth/refresh",
    userUrl: "https://api.figma.com/v1/me",
    clientId: process.env.FIGMA_OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.FIGMA_OAUTH_CLIENT_SECRET ?? "",
  },
};

function configured(provider: Provider): boolean {
  return Boolean(
    providers[provider].clientId &&
    providers[provider].clientSecret &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32 &&
    process.env.FIREBASE_PROJECT_ID &&
    (process.env.NODE_ENV !== "production" || process.env.AYATRISYA_APP_ORIGIN),
  );
}

function providerCookieName(provider: Provider): string {
  return `ayatrisya_${provider}_connection`;
}

function stateCookieName(provider: Provider): string {
  return `ayatrisya_${provider}_oauth_state`;
}

function providerCookiePath(provider: Provider): string {
  void provider;
  // The shared status endpoint reads both provider cookies.
  return COOKIE_ROOT;
}

function parseCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function cookieFlags(req: Request, sameSite: "lax" | "strict") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || req.secure,
    sameSite,
    path: COOKIE_ROOT,
  } as const;
}

function clearProviderCookie(res: Response, req: Request, provider: Provider): void {
  res.clearCookie(providerCookieName(provider), {
    ...cookieFlags(req, "strict"),
    path: providerCookiePath(provider),
  });
}

function appOriginForRequest(req: Request): string | undefined {
  const requestOrigin = req.get("origin");
  const host = req.get("host");
  if (!host) return undefined;
  const publicOrigin = process.env.AYATRISYA_APP_ORIGIN;

  if (publicOrigin) {
    try {
      const normalized = new URL(publicOrigin);
      if (
        normalized.origin !== publicOrigin.replace(/\/+$/, "") ||
        normalized.protocol !== "https:" ||
        normalized.host !== host ||
        (requestOrigin && requestOrigin !== normalized.origin)
      ) {
        return undefined;
      }
      return normalized.origin;
    } catch {
      return undefined;
    }
  }

  if (process.env.NODE_ENV === "production") return undefined;
  const candidate = requestOrigin ?? `${req.protocol}://${host}`;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const local = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    const replit = hostname.endsWith(".replit.dev") || hostname.endsWith(".replit.app");
    if (
      url.origin !== candidate ||
      url.host !== host ||
      (!local && !replit) ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

async function providerJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw Object.assign(new Error("The provider declined the OAuth request."), {
      providerStatus: response.status,
    });
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("The provider returned an invalid response.");
  }
  return body as Record<string, unknown>;
}

type RefreshResult =
  | { kind: "refreshed"; session: ProviderSession }
  | { kind: "invalid" }
  | { kind: "temporary" };

const refreshFlights = new Map<string, Promise<RefreshResult>>();

function refreshCookieLifetime(session: ProviderSession): number {
  const until = session.refreshExpiresAt ?? session.expiresAt;
  return Math.max(0, Math.min(until - Date.now(), REFRESH_SESSION_TTL_MS));
}

function saveProviderSession(
  res: Response,
  req: Request,
  session: ProviderSession,
): void {
  const encrypted = sealOAuthCookie(session);
  if (encrypted.length > 3500) {
    throw new Error("The encrypted provider session is too large for a secure cookie.");
  }
  res.cookie(providerCookieName(session.provider), encrypted, {
    ...cookieFlags(req, "strict"),
    path: providerCookiePath(session.provider),
    maxAge: refreshCookieLifetime(session),
  });
}

async function refreshProviderSession(session: ProviderSession): Promise<RefreshResult> {
  if (
    !session.refreshToken ||
    (session.refreshExpiresAt !== undefined && session.refreshExpiresAt <= Date.now())
  ) {
    return { kind: "invalid" };
  }
  const key = createHash("sha256").update(session.refreshToken).digest("hex");
  const pending = refreshFlights.get(key);
  if (pending) return pending;

  const task = (async (): Promise<RefreshResult> => {
    const config = providers[session.provider];
    const body = new URLSearchParams({ refresh_token: session.refreshToken! });
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (session.provider === "figma") {
      headers.Authorization = `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`,
      ).toString("base64")}`;
    } else {
      body.set("client_id", config.clientId);
      body.set("client_secret", config.clientSecret);
      body.set("grant_type", "refresh_token");
    }

    try {
      const tokens = await providerJson(config.refreshUrl, {
        method: "POST",
        headers,
        body,
      });
      if (typeof tokens.access_token !== "string" || !tokens.access_token) {
        return { kind: "invalid" };
      }
      const now = Date.now();
      const expiresIn = Number(tokens.expires_in);
      const updatedRefreshToken =
        typeof tokens.refresh_token === "string" && tokens.refresh_token
          ? tokens.refresh_token
          : session.refreshToken;
      const refreshExpiresIn = Number(tokens.refresh_token_expires_in);
      const refreshed: ProviderSession = {
        ...session,
        accessToken: tokens.access_token,
        expiresAt:
          now + (Number.isFinite(expiresIn) && expiresIn > 0
            ? Math.min(expiresIn * 1000, CONNECTION_TTL_MS)
            : CONNECTION_TTL_MS),
        refreshToken: updatedRefreshToken,
        refreshExpiresAt:
          Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0
            ? now + refreshExpiresIn * 1000
            : session.refreshExpiresAt,
      };
      return { kind: "refreshed", session: refreshed };
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "providerStatus" in error
          ? Number(error.providerStatus)
          : undefined;
      return status === 400 || status === 401 || status === 403
        ? { kind: "invalid" }
        : { kind: "temporary" };
    }
  })();
  refreshFlights.set(key, task);
  try {
    return await task;
  } finally {
    refreshFlights.delete(key);
  }
}

function readProviderSession(
  req: Request,
  provider: Provider,
  uid: string,
): ProviderSession | undefined {
  const session = openOAuthCookie<ProviderSession>(
    parseCookie(req, providerCookieName(provider)),
  );
  if (
    session?.version !== 1 ||
    session.provider !== provider ||
    session.firebaseUid !== uid ||
    typeof session.accessToken !== "string" ||
    typeof session.accountName !== "string" ||
    !Number.isFinite(session.expiresAt) ||
    (session.refreshExpiresAt !== undefined && !Number.isFinite(session.refreshExpiresAt))
  ) {
    return undefined;
  }
  return session;
}

async function providerSession(
  req: Request,
  res: Response,
  provider: Provider,
  uid: string,
): Promise<ProviderSession | undefined> {
  const current = readProviderSession(req, provider, uid);
  if (!current || current.expiresAt > Date.now() + 60_000) return current;
  const refreshed = await refreshProviderSession(current);
  if (refreshed.kind === "refreshed") {
    saveProviderSession(res, req, refreshed.session);
    return refreshed.session;
  }
  if (refreshed.kind === "invalid") {
    clearProviderCookie(res, req, provider);
    return undefined;
  }
  return current;
}

function getAccountName(provider: Provider, profile: Record<string, unknown>): string {
  if (provider === "github") {
    const login = typeof profile.login === "string" ? profile.login : "";
    return login || (typeof profile.name === "string" ? profile.name : "");
  }
  const handle = typeof profile.handle === "string" ? profile.handle : "";
  return handle || (typeof profile.name === "string" ? profile.name : "");
}

function returnToApp(origin: string, provider: Provider, result: "connected" | "error"): string {
  const redirect = new URL("/workspace/account", origin);
  redirect.searchParams.set("connector", provider);
  redirect.searchParams.set("connection", result);
  return redirect.toString();
}

router.get("/integrations/status", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const uid = await verifiedFirebaseUid(req, res);
  if (!uid) return;
  const status = {} as Record<Provider, {
    configured: boolean;
    connected: boolean;
    accountName?: string;
    expiresAt?: number;
  }>;
  for (const provider of ["github", "figma"] as const) {
    const session = await providerSession(req, res, provider, uid);
    status[provider] = {
      configured: configured(provider),
      connected: Boolean(session),
      ...(session
        ? { accountName: session.accountName, expiresAt: session.expiresAt }
        : {}),
    };
  }
  res.json(status);
});

router.get("/integrations/:provider/start", async (req, res) => {
  const provider = req.params.provider as Provider;
  if (!(provider in providers)) {
    res.status(404).json({ error: "That provider is not supported." });
    return;
  }
  const uid = await verifiedFirebaseUid(req, res);
  if (!uid) return;
  if (!configured(provider)) {
    res.status(503).json({ error: `${providers[provider].label} OAuth is not configured on this server.` });
    return;
  }
  const origin = appOriginForRequest(req);
  if (!origin) {
    res.status(503).json({ error: "Set AYATRISYA_APP_ORIGIN to this app's HTTPS origin before connecting providers." });
    return;
  }

  const providerConfig = providers[provider];
  const state = createOAuthState();
  const pkce = createPkcePair();
  const redirectUri = new URL(`${COOKIE_ROOT}/${provider}/callback`, origin).toString();
  const cookie: OAuthState = {
    provider,
    state,
    verifier: pkce.verifier,
    origin,
    firebaseUid: uid,
    createdAt: Date.now(),
  };
  res.cookie(stateCookieName(provider), sealOAuthCookie(cookie), {
    ...cookieFlags(req, "lax"),
    path: providerCookiePath(provider),
    maxAge: STATE_TTL_MS,
  });

  const authorizeUrl = new URL(providerConfig.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", providerConfig.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", providerConfig.scope);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  res.json({ authorizeUrl: authorizeUrl.toString() });
});

router.get("/integrations/:provider/callback", async (req, res) => {
  const provider = req.params.provider as Provider;
  if (!(provider in providers)) {
    res.status(404).send("That provider is not supported.");
    return;
  }

  const stateCookie = parseCookie(req, stateCookieName(provider));
  res.clearCookie(stateCookieName(provider), {
    ...cookieFlags(req, "lax"),
    path: providerCookiePath(provider),
  });
  const saved = openOAuthCookie<OAuthState>(stateCookie);
  const returnedState = typeof req.query.state === "string" ? req.query.state : "";
  if (
    !saved ||
    saved.provider !== provider ||
    saved.state !== returnedState ||
    Date.now() - saved.createdAt > STATE_TTL_MS ||
    !/^[\w-]{1,128}$/.test(saved.firebaseUid)
  ) {
    res.status(400).send("This connection link expired. Return to Ayatrisya and try again.");
    return;
  }
  if (req.query.error || typeof req.query.code !== "string") {
    res.redirect(303, returnToApp(saved.origin, provider, "error"));
    return;
  }

  const origin = appOriginForRequest(req);
  if (!origin || origin !== saved.origin || !configured(provider)) {
    res.redirect(303, returnToApp(saved.origin, provider, "error"));
    return;
  }

  try {
    const providerConfig = providers[provider];
    const redirectUri = new URL(`${COOKIE_ROOT}/${provider}/callback`, saved.origin).toString();
    const tokenRequest = new URLSearchParams({
      code: req.query.code,
      redirect_uri: redirectUri,
      code_verifier: saved.verifier,
    });
    const tokenHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (provider === "figma") {
      tokenRequest.set("grant_type", "authorization_code");
      tokenHeaders.Authorization = `Basic ${Buffer.from(
        `${providerConfig.clientId}:${providerConfig.clientSecret}`,
      ).toString("base64")}`;
    } else {
      tokenRequest.set("client_id", providerConfig.clientId);
      tokenRequest.set("client_secret", providerConfig.clientSecret);
    }
    const tokens = await providerJson(providerConfig.tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenRequest,
    });
    if (typeof tokens.access_token !== "string" || !tokens.access_token) {
      throw new Error("The OAuth response did not include an access token.");
    }

    const profile = await providerJson(providerConfig.userUrl, {
      headers: {
        Accept: provider === "github" ? "application/vnd.github+json" : "application/json",
        Authorization: `Bearer ${tokens.access_token}`,
        ...(provider === "github"
          ? { "User-Agent": "Ayatrisya", "X-GitHub-Api-Version": "2022-11-28" }
          : {}),
      },
    });
    const accountName = getAccountName(provider, profile);
    if (!accountName) throw new Error("The provider profile did not include an account name.");
    const now = Date.now();
    const expirySeconds = Number(tokens.expires_in);
    const refreshToken =
      typeof tokens.refresh_token === "string" ? tokens.refresh_token : undefined;
    const refreshExpirySeconds = Number(tokens.refresh_token_expires_in);
    const expiresAt =
      now + (Number.isFinite(expirySeconds) && expirySeconds > 0
        ? Math.min(expirySeconds * 1000, CONNECTION_TTL_MS)
        : CONNECTION_TTL_MS);
    const connection: ProviderSession = {
      version: 1,
      provider,
      firebaseUid: saved.firebaseUid,
      accessToken: tokens.access_token,
      accountName,
      expiresAt,
      ...(refreshToken
        ? {
            refreshToken,
            refreshExpiresAt:
              Number.isFinite(refreshExpirySeconds) && refreshExpirySeconds > 0
                ? now + refreshExpirySeconds * 1000
                : now + REFRESH_SESSION_TTL_MS,
          }
        : {}),
    };
    saveProviderSession(res, req, connection);
    res.redirect(303, returnToApp(saved.origin, provider, "connected"));
  } catch {
    res.redirect(303, returnToApp(saved.origin, provider, "error"));
  }
});

router.post("/integrations/:provider/disconnect", async (req, res) => {
  const provider = req.params.provider as Provider;
  if (!(provider in providers)) {
    res.status(404).json({ error: "That provider is not supported." });
    return;
  }
  const uid = await verifiedFirebaseUid(req, res);
  if (!uid) return;
  const current = openOAuthCookie<ProviderSession>(
    parseCookie(req, providerCookieName(provider)),
  );
  if (current?.firebaseUid === uid) clearProviderCookie(res, req, provider);
  res.status(204).end();
});

export default router;
