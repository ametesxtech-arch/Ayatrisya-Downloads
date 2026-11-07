import { useEffect, useState, type ComponentType } from "react";
import { Check, ExternalLink, Unlink } from "lucide-react";
import { SiFigma, SiGithub } from "react-icons/si";
import type { User } from "firebase/auth";
import { Button, Notice } from "@/components/Primitives";
import { buildApiUrl } from "@/lib/api-config";

type Provider = "github" | "figma";
type ProviderStatus = {
  configured: boolean;
  connected: boolean;
  accountName?: string;
  expiresAt?: number;
};
type StatusMap = Record<Provider, ProviderStatus>;

const DEFAULT_CLIENT_IDS: Record<Provider, string> = {
  github: "Ov23li0sq9OOjkyfx9E5",
  figma: "HyTNf0X208M3v71FmUXoFP",
};

const DEFAULT_SCOPES: Record<Provider, string> = {
  github: "read:user",
  figma: "current_user:read",
};

const CACHE_KEY = "ayatrisya_connected_apps";

function readLocalConnections(): Partial<Record<Provider, { connected: boolean; accountName?: string }>> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalConnection(provider: Provider, accountName?: string) {
  try {
    const current = readLocalConnections();
    current[provider] = { connected: true, accountName: accountName || "Connected User" };
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  } catch {}
}

function removeLocalConnection(provider: Provider) {
  try {
    const current = readLocalConnections();
    delete current[provider];
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  } catch {}
}

const providerInfo: Record<Provider, {
  name: string;
  description: string;
  scope: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  docsUrl: string;
}> = {
  github: {
    name: "GitHub",
    description: "Link a GitHub account for Ayatrisya.",
    scope: "Account identity only · read:user",
    icon: SiGithub,
    docsUrl: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps",
  },
  figma: {
    name: "Figma",
    description: "Link a Figma account for Ayatrisya.",
    scope: "Account identity only · current_user:read",
    icon: SiFigma,
    docsUrl: "https://developers.figma.com/docs/rest-api/oauth-apps/",
  },
};

function responseMessage(body: unknown, fallback: string): string {
  return typeof body === "object" && body !== null && "error" in body &&
    typeof body.error === "string"
    ? body.error
    : fallback;
}

function readCallbackMessage(): { message: string | null; provider?: Provider; connected?: boolean } {
  const params = new URLSearchParams(window.location.search);
  const provider = params.get("connector");
  const result = params.get("connection");
  if ((provider !== "github" && provider !== "figma") || !result) return { message: null };
  params.delete("connector");
  params.delete("connection");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  const isConnected = result === "connected";
  return {
    message: isConnected
      ? `${providerInfo[provider].name} connected.`
      : `${providerInfo[provider].name} was not connected. You can retry when ready.`,
    provider,
    connected: isConnected,
  };
}

export function ProviderConnections({ user }: { user: User | null }) {
  const [callbackData] = useState(readCallbackMessage);
  const [statuses, setStatuses] = useState<StatusMap>(() => {
    const cached = readLocalConnections();
    return {
      github: {
        configured: true,
        connected: Boolean(cached.github?.connected || (callbackData.provider === "github" && callbackData.connected)),
        accountName: cached.github?.accountName || (callbackData.provider === "github" ? "GitHub User" : undefined),
      },
      figma: {
        configured: true,
        connected: Boolean(cached.figma?.connected || (callbackData.provider === "figma" && callbackData.connected)),
        accountName: cached.figma?.accountName || (callbackData.provider === "figma" ? "Figma User" : undefined),
      },
    };
  });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [issue, setIssue] = useState<string | null>(null);

  useEffect(() => {
    if (callbackData.provider && callbackData.connected) {
      saveLocalConnection(callbackData.provider);
    }
  }, [callbackData]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(buildApiUrl("/api/integrations/status"), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          cache: "no-store",
        });
        const body: any = await response.json().catch(() => null);
        if (response.ok && body && typeof body === "object" && active) {
          const cached = readLocalConnections();
          setStatuses({
            github: {
              configured: true,
              connected: Boolean(body.github?.connected || cached.github?.connected),
              accountName: body.github?.accountName || cached.github?.accountName || "GitHub User",
              expiresAt: body.github?.expiresAt,
            },
            figma: {
              configured: true,
              connected: Boolean(body.figma?.connected || cached.figma?.connected),
              accountName: body.figma?.accountName || cached.figma?.accountName || "Figma User",
              expiresAt: body.figma?.expiresAt,
            },
          });
          setIssue(null);
        }
      } catch {
        // Keep initial configured: true fallback
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function connect(provider: Provider) {
    setBusy(provider);
    setIssue(null);
    try {
      let authorizeUrl = "";
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await fetch(buildApiUrl(`/api/integrations/${provider}/start`), {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
            cache: "no-store",
          });
          const body: unknown = await response.json().catch(() => null);
          if (response.ok && typeof body === "object" && body !== null && "authorizeUrl" in body && typeof body.authorizeUrl === "string") {
            authorizeUrl = body.authorizeUrl;
          }
        } catch {
          // Fall back to direct OAuth initiation URL
        }
      }

      if (!authorizeUrl) {
        const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem(`oauth_state_${provider}`, state);
        const redirectUri = `${window.location.origin}/api/integrations/${provider}/callback`;
        if (provider === "github") {
          authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${DEFAULT_CLIENT_IDS.github}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${DEFAULT_SCOPES.github}&state=${state}`;
        } else {
          authorizeUrl = `https://www.figma.com/oauth?client_id=${DEFAULT_CLIENT_IDS.figma}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${DEFAULT_SCOPES.figma}&state=${state}&response_type=code`;
        }
      }

      window.location.assign(authorizeUrl);
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "The connection could not be started.");
      setBusy(null);
    }
  }

  async function disconnect(provider: Provider) {
    setBusy(provider);
    setIssue(null);
    removeLocalConnection(provider);
    try {
      if (user) {
        const token = await user.getIdToken();
        await fetch(buildApiUrl(`/api/integrations/${provider}/disconnect`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
      }
      setStatuses((current) => ({
        ...current,
        [provider]: { ...current[provider], connected: false, accountName: undefined, expiresAt: undefined },
      }));
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "The connection could not be removed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-white/[.075] bg-[#15171e] p-5" aria-labelledby="provider-connections-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="provider-connections-title" className="text-sm font-semibold">Connected apps</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
            Connections belong to your Ayatrisya account. You authorize each provider directly.
          </p>
        </div>
        <span className="text-xs text-slate-500">GitHub · Figma</span>
      </div>
      {callbackData.message && <p className="mt-3 text-xs text-emerald-300" role="status">{callbackData.message}</p>}
      {!user ? (
        <div className="mt-4">
          <Notice>Sign in to connect GitHub or Figma to your account.</Notice>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(providerInfo) as Provider[]).map((provider) => {
            const info = providerInfo[provider];
            const Icon = info.icon;
            const status = statuses[provider];
            return (
              <article key={provider} className="rounded-lg border border-white/[.07] bg-white/[.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-lg bg-white/[.06] text-slate-200">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{info.name}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-500">{info.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {status?.connected && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><Check size={12} /> Connected</span>}
                    <a href={info.docsUrl} target="_blank" rel="noreferrer" aria-label={`${info.name} OAuth documentation`} className="text-slate-500 hover:text-white"><ExternalLink size={13} /></a>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">{info.scope}</p>
                {status?.connected ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs text-slate-300">Connected as <span className="font-medium text-emerald-300">{status.accountName || "Authorized Account"}</span></p>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void disconnect(provider)}
                      aria-label={`Disconnect ${info.name}`}
                    >
                      <Unlink size={13} aria-hidden="true" /> Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void connect(provider)}
                    >
                      {busy === provider ? "Opening…" : `Connect ${info.name}`}
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        These first connections verify account identity only. They do not read repositories, design files, or upload your local work.
        Disconnect here and revoke Ayatrisya in the provider’s security settings to remove access.
      </p>
      {issue && <p className="mt-3 text-xs text-rose-300" role="alert">{issue}</p>}
    </section>
  );
}
