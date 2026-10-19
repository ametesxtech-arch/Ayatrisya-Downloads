import { useEffect, useState, type ComponentType } from "react";
import { Check, ExternalLink, Unlink } from "lucide-react";
import { SiFigma, SiGithub } from "react-icons/si";
import type { User } from "firebase/auth";
import { Button, Notice } from "@/components/Primitives";

type Provider = "github" | "figma";
type ProviderStatus = {
  configured: boolean;
  connected: boolean;
  accountName?: string;
  expiresAt?: number;
};
type StatusMap = Record<Provider, ProviderStatus>;

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

function readCallbackMessage(): string | null {
  const params = new URLSearchParams(window.location.search);
  const provider = params.get("connector");
  const result = params.get("connection");
  if ((provider !== "github" && provider !== "figma") || !result) return null;
  params.delete("connector");
  params.delete("connection");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  return result === "connected"
    ? `${providerInfo[provider].name} connected.`
    : `${providerInfo[provider].name} was not connected. You can retry when ready.`;
}

export function ProviderConnections({ user }: { user: User | null }) {
  const [statuses, setStatuses] = useState<StatusMap | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [callbackMessage] = useState(readCallbackMessage);

  useEffect(() => {
    if (!user) {
      setStatuses(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/integrations/status", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "same-origin",
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(responseMessage(body, "Could not check connected accounts."));
        if (active) {
          setStatuses(body as StatusMap);
          setIssue(null);
        }
      } catch (error) {
        if (active) setIssue(error instanceof Error ? error.message : "Could not check connected accounts.");
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function connect(provider: Provider) {
    if (!user) return;
    setBusy(provider);
    setIssue(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/integrations/${provider}/start`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(body, `Could not start ${providerInfo[provider].name} authorization.`));
      if (typeof body !== "object" || body === null || !("authorizeUrl" in body) || typeof body.authorizeUrl !== "string") {
        throw new Error("The connector service returned an invalid authorization link.");
      }
      window.location.assign(body.authorizeUrl);
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "The connection could not be started.");
      setBusy(null);
    }
  }

  async function disconnect(provider: Provider) {
    if (!user) return;
    setBusy(provider);
    setIssue(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(responseMessage(body, `Could not disconnect ${providerInfo[provider].name}.`));
      }
      setStatuses((current) => current
        ? { ...current, [provider]: { ...current[provider], connected: false, accountName: undefined, expiresAt: undefined } }
        : current);
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
      {callbackMessage && <p className="mt-3 text-xs text-emerald-300" role="status">{callbackMessage}</p>}
      {!user ? (
        <div className="mt-4">
          <Notice>Sign in to connect GitHub or Figma to your account.</Notice>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(providerInfo) as Provider[]).map((provider) => {
            const info = providerInfo[provider];
            const Icon = info.icon;
            const status = statuses?.[provider];
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
                    <p className="min-w-0 truncate text-xs text-slate-300">Connected as <span className="font-medium">{status.accountName}</span></p>
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
                    {status && !status.configured && <p className="mb-2 text-[11px] text-amber-200/80">OAuth app credentials are not configured on the server.</p>}
                    <Button
                      variant="outline"
                      disabled={busy !== null || status?.configured === false}
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
