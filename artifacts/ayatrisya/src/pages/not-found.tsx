import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Download, Home, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PublicSiteFooter, PublicSiteHeader } from "@/components/PublicSite";
import { Button } from "@/components/Primitives";

export default function NotFound() {
  const [path] = useLocation();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#101116] text-slate-100">
      <PublicSiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <Card className="w-full max-w-lg border-white/[.09] bg-[#14161e]/90 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <CardContent className="p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-400">Page not found (404)</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Looking for something?</h1>
                <p className="mt-2 text-xs font-mono text-slate-500 truncate">Requested route: {path}</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-400">
              The address you entered may have moved or doesn't exist. You can jump directly into the workspace, explore desktop installers, or head back home.
            </p>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/workspace/chat"
                className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3.5 text-xs font-semibold text-violet-200 transition-all hover:bg-violet-500/20 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10"
              >
                <MessageSquare size={17} className="shrink-0 text-violet-400" />
                <div className="min-w-0">
                  <div className="text-white">Ayatrisya Chat</div>
                  <div className="text-[11px] font-normal text-slate-400">Open active AI workspace</div>
                </div>
              </Link>

              <Link
                href="/downloads"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] p-3.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/[.08] hover:border-white/20"
              >
                <Download size={17} className="shrink-0 text-teal-400" />
                <div className="min-w-0">
                  <div className="text-white">Desktop Apps</div>
                  <div className="text-[11px] font-normal text-slate-400">.exe, .dmg, .AppImage</div>
                </div>
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] pt-5">
              <Button
                variant="outline"
                onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')}
                className="gap-2"
              >
                <ArrowLeft size={14} /> Back
              </Button>

              <div className="flex items-center gap-3 text-xs">
                <Link href="/" className="flex items-center gap-1.5 text-slate-300 hover:text-white transition">
                  <Home size={13} /> Home
                </Link>
                <span className="text-slate-600">·</span>
                <Link href="/auth/create-account" className="flex items-center gap-1.5 text-violet-300 hover:text-violet-200 transition font-medium">
                  <Sparkles size={13} /> Sign in / Register
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
