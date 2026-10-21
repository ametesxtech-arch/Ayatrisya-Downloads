import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { PublicSiteFooter, PublicSiteHeader } from "@/components/PublicSite";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#101116] text-slate-100">
      <PublicSiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-12">
        <Card className="w-full max-w-md border-white/[.08] bg-[#15171e] text-slate-100">
          <CardContent className="pt-6">
            <div className="mb-4 flex gap-3">
              <AlertCircle className="h-7 w-7 shrink-0 text-violet-300" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Not found</p>
                <h1 className="display mt-1 text-2xl font-semibold tracking-[-.04em]">This page isn’t here</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">The address may be incorrect or the page may have moved.</p>
            <div className="mt-6 flex gap-4 text-xs">
              <Link href="/" className="text-violet-200 underline underline-offset-4">Ayatrisya home</Link>
              <Link href="/documentation" className="text-violet-200 underline underline-offset-4">Documentation</Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
