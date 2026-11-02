import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ExternalLink, Github, Loader2 } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button, Eyebrow, inputCls, Notice } from "@/components/Primitives";
import { useAuth } from "@/integrations/firebase/AuthProvider";
import { apiFetch } from "@/lib/api-config";
import { errMsg } from "@/lib/format";
import { PublicSiteFooter } from "@/components/PublicSite";

export function DesktopHandoff() {
  const auth = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const rawState = searchParams.get("state") || "";
  const rawChallenge = searchParams.get("challenge") || "";
  const state = rawState.trim();
  const challenge = rawChallenge.trim();
  const initialMode = searchParams.get("mode") || "sign-in";

  const [isCreate, setIsCreate] = useState(initialMode === "create-account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [handoffStatus, setHandoffStatus] = useState<"idle" | "authorizing" | "success" | "error">("idle");
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);

  const hasValidDesktopParams = Boolean(
    state &&
    /^[a-zA-Z0-9_-]{16,128}$/.test(state) &&
    challenge &&
    /^[a-zA-Z0-9_-]{40,128}$/.test(challenge)
  );

  useEffect(() => {
    if (!hasValidDesktopParams) return;
    if (auth.user && handoffStatus === "idle") {
      performHandoff();
    }
  }, [auth.user, hasValidDesktopParams, handoffStatus]);

  async function performHandoff() {
    if (!auth.user || !hasValidDesktopParams) return;
    setHandoffStatus("authorizing");
    setHandoffError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await apiFetch<{ code: string }>("/api/auth/desktop/handoff", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          challenge,
          email: auth.user.email || undefined,
        }),
      });

      const url = `ayatrisya://auth/callback?code=${encodeURIComponent(response.code)}&state=${encodeURIComponent(state)}`;
      setCallbackUrl(url);
      setHandoffStatus("success");
      // Trigger deep link redirect to open Ayatrisya Desktop
      window.location.assign(url);
    } catch (err) {
      setHandoffStatus("error");
      setHandoffError(errMsg(err, "Failed to connect to Ayatrisya Desktop."));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setHandoffError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (isCreate && password !== confirm) return setError("The passwords do not match.");

    setBusy(true);
    try {
      if (isCreate) {
        await auth.register(email, password);
      } else {
        await auth.signIn(email, password);
      }
      setHandoffStatus("idle");
    } catch (err) {
      setError(errMsg(err, "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setHandoffError(null);
    setBusy(true);
    try {
      await auth.googleSignIn();
      setHandoffStatus("idle");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGithub() {
    setError(null);
    setHandoffError(null);
    setBusy(true);
    try {
      await auth.githubSignIn();
      setHandoffStatus("idle");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="auth-page app-noise flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_12%,rgba(94,79,179,.13),transparent_38%),#101116] px-4 py-16 sm:items-center sm:p-5">
        <div className="auth-panel w-full max-w-[430px] rounded-2xl border border-white/[.075] bg-[#15171e]/95 p-6 shadow-2xl sm:p-9">
          <div className="mb-6">
            <Brand compact />
          </div>

          {!hasValidDesktopParams ? (
            <div>
              <Eyebrow>Desktop Authentication</Eyebrow>
              <h1 className="display mt-2 text-2xl font-semibold tracking-[-.04em]">Invalid Request</h1>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                This page is used to authenticate Ayatrisya Desktop. To sign in, open the Ayatrisya Desktop app and click a sign-in option.
              </p>
              <div className="mt-6">
                <Link href="/" className="text-xs text-violet-300 underline hover:text-violet-200">
                  Return to Ayatrisya Home
                </Link>
              </div>
            </div>
          ) : handoffStatus === "success" ? (
            <div className="text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                <CheckCircle2 size={32} />
              </div>
              <Eyebrow>Authorized</Eyebrow>
              <h1 className="display mt-2 text-2xl font-semibold tracking-[-.04em]">Authentication Complete</h1>
              <p className="mt-3 text-sm text-slate-400">
                You are signed in as <b className="text-slate-200">{auth.user?.email || "Ayatrisya User"}</b>. Your session has been sent to Ayatrisya Desktop.
              </p>
              {callbackUrl && (
                <div className="mt-6 space-y-3">
                  <a
                    href={callbackUrl}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition"
                  >
                    Open Ayatrisya Desktop <ExternalLink size={16} />
                  </a>
                  <p className="text-[11px] text-slate-500">
                    If your browser didn't switch automatically, click the button above to return to Ayatrisya Desktop.
                  </p>
                </div>
              )}
            </div>
          ) : handoffStatus === "authorizing" ? (
            <div className="text-center py-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center text-violet-400 mb-4">
                <Loader2 size={36} className="animate-spin" />
              </div>
              <h2 className="display text-xl font-semibold tracking-[-.03em]">Connecting to Desktop...</h2>
              <p className="mt-2 text-xs text-slate-400">
                Generating your secure desktop authentication handoff.
              </p>
            </div>
          ) : (
            <div>
              <Eyebrow>Ayatrisya Desktop</Eyebrow>
              <h1 className="display mt-1 text-2xl font-semibold tracking-[-.04em]">
                {isCreate ? "Create Desktop Account" : "Sign in to Desktop"}
              </h1>
              <p className="mt-2 text-xs text-slate-400">
                Authenticate in your browser to connect your account to Ayatrisya Desktop.
              </p>

              {handoffStatus === "error" && handoffError && (
                <div className="mt-4">
                  <div role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs text-rose-200">
                    {handoffError}
                  </div>
                  <Button variant="outline" className="mt-3 w-full" onClick={performHandoff}>
                    Retry Desktop Connection
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="mt-5 flex h-11 w-full items-center justify-center rounded-lg border border-white/10 text-sm font-semibold hover:bg-white/[.05] disabled:opacity-45"
              >
                Continue with Google
              </button>

              <button
                type="button"
                onClick={handleGithub}
                disabled={busy}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold hover:bg-white/[.05] disabled:opacity-45"
              >
                <Github size={16} /> Continue with GitHub
              </button>

              <div className="relative my-5 text-center text-xs text-slate-500">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[.08]" />
                </div>
                <span className="relative bg-[#15171e] px-2 text-[11px] uppercase tracking-wider text-slate-400">
                  or email
                </span>
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                <label className="block text-xs font-medium text-slate-300">
                  Email
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className={`${inputCls} mt-2`}
                  />
                </label>

                <label className="block text-xs font-medium text-slate-300">
                  Password
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete={isCreate ? "new-password" : "current-password"}
                    className={`${inputCls} mt-2`}
                    placeholder="At least 8 characters"
                  />
                </label>

                {isCreate && (
                  <label className="block text-xs font-medium text-slate-300">
                    Confirm password
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      className={`${inputCls} mt-2`}
                    />
                  </label>
                )}

                {error && (
                  <div role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs text-rose-200">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Authenticating..." : isCreate ? "Create Account & Return" : "Sign In & Return"}
                  {!busy && <ArrowRight size={15} />}
                </Button>
              </form>

              <div className="mt-5 text-center text-xs text-slate-400">
                {isCreate ? "Already have an account?" : "New to Ayatrisya?"}{" "}
                <button
                  type="button"
                  onClick={() => setIsCreate(!isCreate)}
                  className="font-semibold text-slate-100 hover:text-violet-200"
                >
                  {isCreate ? "Sign in" : "Create an account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <PublicSiteFooter />
    </>
  );
}
