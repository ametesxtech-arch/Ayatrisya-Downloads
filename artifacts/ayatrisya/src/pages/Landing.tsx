import { useState } from 'react';
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
import { Toast } from '@/components/Toast';
import { useAuth } from '@/integrations/firebase/AuthProvider';

export function Landing() {
  const [toast, setToast] = useState('');
  const [, setPath] = useLocation();
  const { startGuest, user } = useAuth();
  return (
    <div className="app-noise min-h-[100dvh] overflow-hidden bg-[#101116] text-slate-100">
      <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 md:px-9">
        <Link href="/" aria-label="Ayatrisya home">
          <Brand />
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-[13px] text-slate-400 md:flex"
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
          <a href="#about" className="hover:text-white">
            About
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {!user && <button type="button" onClick={() => { startGuest(); setPath('/workspace/chat'); }} className="rounded-lg border border-white/10 px-3 py-2.5 text-xs text-slate-200 transition hover:bg-white/[.05]">
            Try as guest
          </button>}
          <Link
            href="/auth/sign-in"
            className="hidden px-3 py-2 text-xs text-slate-300 hover:text-white sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/auth/create-account"
            className="rounded-lg bg-[#7768db] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#887be8]"
          >
            Create account <ArrowRight size={14} className="ml-1 inline" />
          </Link>
        </div>
      </header>
      <main>
        <section className="relative mx-auto grid max-w-[1240px] gap-14 px-5 pb-24 pt-14 md:grid-cols-[.95fr_1.05fr] md:items-center md:px-9 md:pb-32 md:pt-24">
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
            <div className="mt-8 flex flex-wrap gap-3">
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
          className="border-y border-white/[.06] bg-[#13151b] px-5 py-20 md:px-9 md:py-24"
        >
          <div className="mx-auto max-w-[1160px]">
            <div className="grid gap-4 md:grid-cols-[.8fr_1.2fr] md:items-end">
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
          className="mx-auto grid max-w-[1160px] gap-12 px-5 py-20 md:grid-cols-2 md:items-center md:px-9 md:py-28"
        >
          <div>
            <Eyebrow>Ayatrisya Desktop</Eyebrow>
            <h2 className="display max-w-md text-4xl font-semibold tracking-[-.06em] md:text-5xl">
              Your projects stay on your machine.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">
              Real local project access requires the Ayatrisya desktop
              application. It is not released yet, and the web app never reads
              your filesystem.
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
          className="border-y border-white/[.06] bg-[#13151b] px-5 py-20 md:px-9 md:py-24"
        >
          <div className="mx-auto grid max-w-[1160px] gap-10 md:grid-cols-[.8fr_1.2fr]">
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
        <section className="mx-auto max-w-[1160px] px-5 py-20 md:px-9 md:py-28">
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
      <footer className="border-t border-white/[.06] px-5 py-8 md:px-9">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <Brand compact />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#capabilities" className="hover:text-slate-300">
              Product
            </a>
            <a href="#about" className="hover:text-slate-300">
              Privacy
            </a>
            <button
              onClick={() =>
                setToast(
                  'Documentation will be published as the product develops.',
                )
              }
              className="hover:text-slate-300"
            >
              Documentation
            </button>
            <button
              onClick={() =>
                setToast('Contact information will be available soon.')
              }
              className="hover:text-slate-300"
            >
              Contact
            </button>
            <button
              onClick={() =>
                setToast('Terms will be published before public release.')
              }
              className="hover:text-slate-300"
            >
              Terms
            </button>
          </div>
          <span>© Ametesx · local-first</span>
        </div>
      </footer>
      {toast && <Toast message={toast} close={() => setToast('')} />}
    </div>
  );
}

export function ProductPreview() {
  return (
    <div className="relative reveal [animation-delay:120ms]">
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
