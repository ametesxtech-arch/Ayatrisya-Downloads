import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { Brand } from '@/components/Brand';

const footerLinks = [
  { href: '/#capabilities', label: 'Product' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/documentation', label: 'Documentation' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
];

const legalLinks = [
  { href: '/copyright', label: 'Copyright' },
  { href: '/licenses', label: 'Licenses' },
  { href: '/cookies', label: 'Cookies & storage' },
];

export function PublicSiteHeader() {
  return (
    <header className="border-b border-white/[.07] bg-[#101116]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Ayatrisya home" className="shrink-0">
          <Brand compact />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-xs text-slate-400 md:flex">
          <Link href="/#capabilities" className="transition hover:text-white">Product</Link>
          <Link href="/desktop" className="transition hover:text-white">Desktop</Link>
          <Link href="/documentation" className="text-slate-200 transition hover:text-white">Documentation</Link>
        </nav>
        <details className="relative md:hidden">
          <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-lg border border-white/[.08] px-3 text-xs text-slate-300 focus-visible:outline-2 focus-visible:outline-violet-300 [&::-webkit-details-marker]:hidden">Menu</summary>
          <nav aria-label="Mobile navigation" className="absolute right-0 top-11 z-30 grid min-w-44 gap-1 rounded-xl border border-white/10 bg-[#171920] p-2 shadow-2xl">
            <Link href="/#capabilities" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Product</Link>
            <Link href="/desktop" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Desktop</Link>
            <Link href="/documentation" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Documentation</Link>
          </nav>
        </details>
        <div className="flex items-center gap-2">
          <Link href="/auth/sign-in" className="hidden rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[.05] hover:text-white sm:inline-flex">Sign in</Link>
          <Link href="/auth/create-account" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-violet-500 px-3.5 text-xs font-semibold text-white transition hover:bg-violet-400">
            Get started <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-white/[.07] bg-[#0d0e12] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <Link href="/" className="w-fit" aria-label="Ayatrisya home">
              <Brand compact />
            </Link>
            <span className="pl-[42px] text-[10px] tracking-wide text-slate-600">An Ametesx product</span>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-400">
            {footerLinks.map((item) => <Link key={item.href} href={item.href} className="rounded-sm transition hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300">{item.label}</Link>)}
          </nav>
          <div className="text-[11px] text-slate-500 lg:text-right">
            <p>© {new Date().getFullYear()} Ametesx · All rights reserved.</p>
            <p className="mt-1">This notice applies only to material Ametesx owns or is authorized to protect.</p>
            <p className="mt-1">Local-first storage where supported; model use may involve remote processing.</p>
          </div>
        </div>
        <nav aria-label="Legal and attribution links" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.05] pt-4 text-[10px] text-slate-600">
          {legalLinks.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-slate-300">{item.label}</Link>)}
        </nav>
      </div>
    </footer>
  );
}

export function PublicPageFrame({
  eyebrow,
  title,
  description,
  reviewNotice = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  reviewNotice?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#101116] text-slate-100">
      <PublicSiteHeader />
      <main className="mx-auto min-h-[60dvh] max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-slate-200">
            <ArrowLeft size={14} /> Ayatrisya home
          </Link>
          <div className="mt-8 border-b border-white/[.07] pb-7">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-300">{eyebrow}</p>
            <h1 className="display mt-3 text-4xl font-semibold tracking-[-.055em] text-slate-50 sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{description}</p>
          </div>
          {reviewNotice && (
            <div role="note" className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[.055] px-4 py-3 text-xs leading-6 text-amber-100/85">
              Draft for owner and legal review. Unknown company, contact, jurisdiction, endpoint-retention, or license details are explicitly marked and must be verified before publication.
            </div>
          )}
          <div className="public-reading mt-8">{children}</div>
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
