import { Link, useLocation } from 'wouter';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Code2,
  FileText,
  FolderKanban,
  Globe2,
  Image,
  Library,
  LockKeyhole,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DesktopButton } from '@/components/DesktopButton';
import { Eyebrow, Panel } from '@/components/Primitives';
import { cx } from '@/lib/cx';
import { Mark, Brand } from '@/components/Brand';
import { PublicSiteFooter } from '@/components/PublicSite';
import { useAuth } from '@/integrations/firebase/AuthProvider';

export function Landing() {
  const [, setPath] = useLocation();
  const { startGuest, user } = useAuth();
  return (
    <div className="landing-page app-noise min-h-[100dvh] overflow-hidden bg-[#101116] text-slate-100">
      <header className="landing-header relative z-10 mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-3 py-4 sm:px-5 sm:py-5 lg:px-9">
        <Link href="/" aria-label="Ayatrisya home">
          <Brand />
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-[13px] text-slate-400 lg:flex"
        >
          <a href="#capabilities" className="hover:text-white">
            Product
          </a>
          <a href="#capabilities" className="hover:text-white">
            Capabilities
          </a>
          <a href="#desktop" className="hover:text-white">
            Desktop
          </a>
          <Link href="/documentation" className="hover:text-white">
            Documentation
          </Link>
          <a href="#about" className="hover:text-white">
            About
          </a>
        </nav>
        <details className="relative lg:hidden">
          <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-lg border border-white/[.08] px-3 text-xs text-slate-300 focus-visible:outline-2 focus-visible:outline-violet-300 [&::-webkit-details-marker]:hidden">Menu</summary>
          <nav aria-label="Mobile navigation" className="absolute right-0 top-11 z-30 grid min-w-44 gap-1 rounded-xl border border-white/10 bg-[#171920] p-2 shadow-2xl">
            <a href="#capabilities" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Product</a>
            <a href="#desktop" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Desktop</a>
            <Link href="/documentation" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Documentation</Link>
            <Link href="/privacy" className="rounded-lg px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[.05]">Privacy</Link>
          </nav>
        </details>
        <div className="landing-header-actions flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!user && <button type="button" onClick={() => { startGuest(); setPath('/workspace/chat'); }} className="landing-guest-cta shrink-0 whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-2.5 text-[10px] text-slate-200 transition hover:bg-white/[.05] sm:px-3 sm:text-xs">
            <span className="landing-guest-label-long">Try as guest</span><span className="landing-guest-label-short">Guest</span>
          </button>}
          <Link
            href="/auth/sign-in"
            className="hidden whitespace-nowrap px-3 py-2 text-xs text-slate-300 hover:text-white lg:block"
          >
            Sign in
          </Link>
          <Link
            href="/auth/create-account"
            aria-label="Create account"
            className="landing-account-cta inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-[#7768db] px-2.5 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#887be8] sm:px-4 sm:text-xs"
          >
            <span className="landing-account-label-long">Create account</span>
            <span className="landing-account-label-short">Join</span>
            <ArrowRight size={14} className="ml-1 inline" />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero relative mx-auto grid max-w-[1240px] gap-10 px-5 pb-16 pt-10 sm:pb-24 sm:pt-14 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:gap-14 lg:px-9 lg:pb-32 lg:pt-24">
          <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-violet-500/[.08] blur-[110px]" />
          <div className="relative reveal">
            <Eyebrow>Ametesx · a workspace for considered work</Eyebrow>
            <h1 className="display max-w-[690px] text-[clamp(3.25rem,7vw,6.3rem)] font-semibold leading-[.99] tracking-[-.075em] text-slate-50">
              One space for
              <br />
              <span className="text-slate-400">thought to take shape.</span>
            </h1>
            <p className="mt-7 max-w-[470px] text-[15px] leading-7 text-slate-400">
              Conversation, research, code, visuals and documents—brought
              together in a professional workspace built to grow with your work.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5 sm:gap-3">
              <Link
                href="/auth/create-account"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-500 px-5 font-semibold text-white shadow-[0_8px_30px_rgba(114,97,215,.2)] hover:bg-violet-400"
              >
                Create account <ArrowRight size={16} />
              </Link>
              <a
                href="#capabilities"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-5 font-semibold text-slate-300 hover:bg-white/[.05]"
              >
                Explore capabilities <ArrowDown size={15} />
              </a>
            </div>
            <div className="mt-9 flex items-center gap-3 text-[11px] text-slate-500">
              <span className="h-px w-8 bg-slate-700" /> Local storage works · AI models
              are not connected
            </div>
          </div>
          <ProductPreview />
        </section>
        <section
          id="capabilities"
          className="landing-capabilities border-y border-white/[.06] bg-[#13151b] px-5 py-20 md:px-9 md:py-24"
        >
          <div className="mx-auto max-w-[1160px]">
            <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <Eyebrow>One workspace, many kinds of work</Eyebrow>
                <h2 className="display max-w-lg text-4xl font-semibold tracking-[-.055em] md:text-5xl">
                  The work stays connected.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-slate-400">
                Move from a first question to a working plan, a document or an
                idea worth exploring—without pretending that the tools are
                further along than they are.
              </p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.07] sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  MessageSquare,
                  'Conversation',
                  'A clear place to shape questions and think out loud.',
                ],
                [
                  Search,
                  'Research',
                  'An organized canvas for objectives, notes and findings.',
                ],
                [
                  Code2,
                  'Coding companion',
                  'A desktop-first workflow for working with local projects.',
                ],
                [
                  Image,
                  'Image studio',
                  'A considered space for visual prompts and creative direction.',
                ],
                [
                  FileText,
                  'Documents & slides',
                  'Drafts, outlines and presentations in one workspace.',
                ],
                [
                  FolderKanban,
                  'Projects',
                  'Goals, milestones and tasks around the work itself.',
                ],
              ].map(([Icon, title, description], i) => {
                const I = Icon as typeof MessageSquare;
                return (
                  <div
                    key={String(title)}
                    className="group min-h-[185px] bg-[#14161c] p-6 transition hover:bg-[#191b23]"
                  >
                    <div className="mb-8 flex size-9 items-center justify-center rounded-lg border border-violet-200/10 bg-violet-300/[.055] text-violet-200">
                      <I size={17} />
                    </div>
                    <h3 className="display text-lg font-semibold">
                      {String(title)}
                    </h3>
                    <p className="mt-2 max-w-[270px] text-xs leading-5 text-slate-500">
                      {String(description)}
                    </p>
                    <span className="mt-4 block text-[10px] uppercase tracking-[.12em] text-slate-600">
                      0{i + 1} · local-first
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="desktop"
          className="landing-desktop mx-auto grid max-w-[1160px] gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-9 lg:py-28"
        >
          <div>
            <Eyebrow>Ayatrisya Desktop</Eyebrow>
            <h2 className="display max-w-md text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Your projects stay on your machine.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">
              Work with folders you choose and commands you approve. The web
              app never reads your filesystem; use the desktop page for current
              installer availability.
            </p>
            <DesktopButton className="mt-7" />
          </div>
          <div className="relative rounded-2xl border border-white/[.08] bg-[#14161c] p-5 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/[.07] pb-4">
              <span className="size-2 rounded-full bg-rose-300/50" />
              <span className="size-2 rounded-full bg-amber-200/50" />
              <span className="size-2 rounded-full bg-teal-200/50" />
              <span className="ml-2 text-[11px] text-slate-500">
                Ayatrisya Desktop · preview
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-4 pt-5">
              <div className="space-y-2">
                {[
                  'fieldnotes/',
                  'src/',
                  'components/',
                  'workspace.tsx',
                  'README.md',
                ].map((f, i) => (
                  <div
                    key={f}
                    className={cx(
                      'rounded px-2 py-1.5 text-[10px] mono',
                      i === 3
                        ? 'bg-violet-300/10 text-violet-200'
                        : 'text-slate-500',
                    )}
                  >
                    {f}
                  </div>
                ))}
              </div>
              <div className="min-h-[150px] rounded-lg border border-white/[.055] bg-[#101116] p-4 font-mono text-[10px] leading-7 text-slate-500">
                <div>
                  <span className="text-violet-300">const</span> project ={' '}
                  <span className="text-teal-200">"fieldnotes"</span>;
                </div>
                <div className="text-slate-600">// local workspace preview</div>
                <div>
                  <span className="text-violet-300">export</span>{' '}
                  <span className="text-blue-200">default</span> project;
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[.06] px-3 py-2 text-[10px] text-slate-500">
              <LockKeyhole size={13} /> Sample project only · no filesystem
              access
            </div>
          </div>
        </section>
        <section
          id="about"
          className="landing-about border-y border-white/[.06] bg-[#13151b] px-5 py-20 md:px-9 md:py-24"
        >
          <div className="mx-auto grid max-w-[1160px] gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-10">
            <div>
              <Eyebrow>Privacy, by design</Eyebrow>
              <h2 className="display max-w-md text-4xl font-semibold tracking-[-.06em] md:text-5xl">
                Built toward local-first work.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Panel className="p-5">
                <ShieldCheck className="mb-5 text-violet-200" size={20} />
                <h3 className="font-semibold">Files should remain yours</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Conversations, projects, notes and files are saved in your
                  browser (IndexedDB) and survive a refresh. Export or import
                  backups from Storage.
                </p>
              </Panel>
              <Panel className="p-5">
                <Globe2 className="mb-5 text-blue-200" size={20} />
                <h3 className="font-semibold">Integrations are optional</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Google Drive is an optional manual backup and restore. It
                  requires a separately configured OAuth client and does not
                  continuously sync your files.
                </p>
              </Panel>
            </div>
          </div>
        </section>
        <section className="landing-close mx-auto max-w-[1160px] px-5 py-20 md:px-9 md:py-28">
          <div className="rounded-2xl border border-violet-300/10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(122,108,222,.13),transparent_55%),#14161c] px-7 py-12 text-center md:py-16">
            <Eyebrow>Private by default</Eyebrow>
            <h2 className="display mx-auto max-w-2xl text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Start with a thought.
              <br />
              See where it takes you.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">
              Your work is saved locally in this browser. AI models and
              account sign-in are not connected unless this deployment
              configures them; nothing is sent anywhere without your consent.
            </p>
            <Link
              href="/auth/create-account"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-violet-500 px-5 font-semibold text-white hover:bg-violet-400"
            >
              Create account <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}

export function ProductPreview() {
  return (
    <div className="product-preview relative reveal [animation-delay:120ms]">
      <div className="absolute -inset-8 rounded-[40px] bg-violet-500/[.08] blur-[70px]" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[#14161c] shadow-[0_35px_100px_rgba(0,0,0,.55)]">
        <div className="flex h-11 items-center gap-2 border-b border-white/[.06] px-4">
          <span className="flex gap-1.5">
            <i className="size-2 rounded-full bg-white/15" />
            <i className="size-2 rounded-full bg-white/15" />
            <i className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="ml-3 text-[10px] text-slate-600">
            Layout illustration, no user data
          </span>
          <span className="ml-auto rounded-md border border-violet-300/10 bg-violet-300/[.06] px-2 py-1 text-[9px] text-violet-200">
            ILLUSTRATION
          </span>
        </div>
        <div className="grid min-h-[370px] grid-cols-[128px_1fr] sm:grid-cols-[160px_1fr]">
          <aside className="border-r border-white/[.055] p-3">
            <div className="flex items-center gap-2">
              <Mark small />
              <span className="text-[10px] font-semibold">ayatrisya</span>
            </div>
            <div className="mt-6 space-y-1">
              {[
                [Plus, 'New chat'],
                [Search, 'Search'],
                [FolderKanban, 'Projects'],
                [Library, 'Library'],
              ].map(([I, t]) => {
                const Icon = I as typeof Plus;
                return (
                  <div
                    key={String(t)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-[9px] text-slate-500"
                  >
                    <Icon size={12} />
                    {String(t)}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 px-2 text-[8px] uppercase tracking-widest text-slate-700">
              Recent
            </div>
            <div className="mt-2 px-2 text-[9px] leading-4 text-slate-500">
              No conversations yet. Yours will be listed here.
            </div>
          </aside>
          <div className="relative p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                New conversation
              </span>
              <span className="rounded-md border border-white/[.07] px-2 py-1 text-[9px] text-slate-500">
                V1 Fast · unavailable
              </span>
            </div>
            <div className="mx-auto mt-12 max-w-[390px]">
              <div className="mb-5 flex size-8 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-300/[.06] text-violet-200">
                <Sparkles size={15} />
              </div>
              <h3 className="display text-xl font-semibold tracking-tight sm:text-2xl">
                What are we working on?
              </h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                A space for the early outline, the hard question, or the idea
                that needs another pass.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  'Help me shape a project brief',
                  'Turn these notes into an outline',
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-center justify-between rounded-lg border border-white/[.06] px-3 py-2.5 text-[9px] text-slate-400"
                  >
                    {t}
                    <ArrowUpRight size={12} />
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-white/[.08] bg-[#101116] p-3">
                <div className="text-[9px] text-slate-600">Ask anything…</div>
                <div className="mt-5 flex justify-between">
                  <span className="flex gap-2 text-slate-600">
                    <Paperclip size={12} />
                    <Image size={12} />
                  </span>
                  <span className="grid size-6 place-items-center rounded-md bg-violet-500 text-white">
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
