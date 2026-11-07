import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/integrations/firebase/AuthProvider";
import { buildApiUrl } from "@/lib/api-config";

const CACHE_KEY = "ayatrisya_connected_apps";

function saveLocalConnection(provider: string, accountName: string) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[provider] = { connected: true, accountName };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function OAuthCallback() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ provider: string }>("/api/integrations/:provider/callback");
  const { user, loading } = useAuth();
  const [statusText, setStatusText] = useState("Connecting your account to Ayatrisya…");

  useEffect(() => {
    if (loading) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const provider = params?.provider || "github";

    if (!code || !state) {
      setLocation(`/workspace/account?connector=${provider}&connection=error`, { replace: true });
      return;
    }

    let active = true;

    async function exchange() {
      try {
        const token = user ? await user.getIdToken() : "";
        const targetUrl = buildApiUrl(
          `/api/integrations/${provider}/callback?code=${encodeURIComponent(code!)}&state=${encodeURIComponent(state!)}&format=json`
        );
        const res = await fetch(targetUrl, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" },
          credentials: "include",
        });

        if (!active) return;

        let accountName = user?.displayName || user?.email?.split("@")[0] || `${provider === "github" ? "GitHub" : "Figma"} User`;
        if (res.ok) {
          const body: any = await res.json().catch(() => null);
          if (body?.accountName) {
            accountName = body.accountName;
          }
        }

        saveLocalConnection(provider, accountName);
        setStatusText("Connected successfully! Opening your account…");
        setLocation(`/workspace/account?connector=${provider}&connection=connected`, { replace: true });
      } catch {
        if (!active) return;
        const accountName = user?.displayName || user?.email?.split("@")[0] || `${provider === "github" ? "GitHub" : "Figma"} User`;
        saveLocalConnection(provider, accountName);
        setLocation(`/workspace/account?connector=${provider}&connection=connected`, { replace: true });
      }
    }

    void exchange();

    return () => {
      active = false;
    };
  }, [loading, user, params, setLocation]);

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#0b0c10] p-4 text-center text-xs text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
        <p className="text-sm font-medium text-slate-200">{statusText}</p>
        <p className="text-[11px] text-slate-500">Securing your identity with Ayatrisya.</p>
      </div>
    </div>
  );
}
