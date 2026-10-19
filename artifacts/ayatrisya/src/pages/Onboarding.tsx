import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Eyebrow, Notice, Panel } from '@/components/Primitives';
import { cx } from '@/lib/cx';
import { session } from '@/lib/session';
import { Mark, Brand } from '@/components/Brand';

export function Onboarding() {
  const [step, setStep] = useState(0),
    [usage, setUsage] = useState('All of the above'),
    [appearance, setAppearance] = useState('Dark');
  const steps = ['Welcome', 'Your work', 'Appearance', 'Privacy', 'Ready'];
  return (
    <main className="app-noise min-h-[100dvh] bg-[#101116] px-5 py-7">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <Link href="/">
          <Brand />
        </Link>
        <Link
          href="/workspace"
          className="text-xs text-slate-500 hover:text-slate-200"
        >
          Skip setup <ArrowRight className="ml-1 inline" size={13} />
        </Link>
      </header>
      <div className="mx-auto mt-10 max-w-[670px]">
        <div className="mb-10 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cx(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold',
                  i <= step
                    ? 'border-violet-300/30 bg-violet-300/10 text-violet-100'
                    : 'border-white/10 text-slate-600',
                )}
              >
                {i < step ? <Check size={13} /> : i + 1}
              </span>
              <span
                className={cx(
                  'hidden text-[10px] sm:block',
                  i === step ? 'text-slate-200' : 'text-slate-600',
                )}
              >
                {s}
              </span>
              {i < steps.length - 1 && (
                <span className="h-px flex-1 bg-white/[.08]" />
              )}
            </div>
          ))}
        </div>
        <Panel className="min-h-[430px] p-7 sm:p-10">
          {step === 0 && (
            <>
              <Eyebrow>Welcome to Ayatrisya</Eyebrow>
              <h1 className="display max-w-lg text-4xl font-semibold leading-tight tracking-[-.06em]">
                A workspace for the way you think.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
                Bring conversations, research, creative work and project plans
                into one considered space. This preview works locally for the
                session.
              </p>
              <div className="mt-9 rounded-xl border border-white/[.07] bg-[#101116] p-5">
                <div className="flex items-center gap-3">
                  <Mark />
                  <div>
                    <div className="font-semibold">
                      Your workspace, your pace
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      No setup required to explore.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <Eyebrow>Make it yours</Eyebrow>
              <h1 className="display text-3xl font-semibold tracking-[-.05em]">
                What will you work on?
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Choose a starting point. You can change this later.
              </p>
              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {[
                  'General assistant',
                  'Coding and development',
                  'Research and learning',
                  'Creative work',
                  'All of the above',
                ].map((x) => (
                  <button
                    key={x}
                    onClick={() => setUsage(x)}
                    className={cx(
                      'flex min-h-12 items-center justify-between rounded-lg border px-4 text-left text-sm',
                      usage === x
                        ? 'border-violet-300/35 bg-violet-300/[.07] text-white'
                        : 'border-white/[.08] text-slate-400 hover:bg-white/[.04]',
                    )}
                  >
                    {x}
                    {usage === x && (
                      <Check size={15} className="text-violet-200" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <Eyebrow>Appearance</Eyebrow>
              <h1 className="display text-3xl font-semibold tracking-[-.05em]">
                Set the atmosphere.
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Your selection applies to this open preview session.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {['Dark', 'Light', 'Follow system'].map((x) => (
                  <button
                    key={x}
                    onClick={() => {
                      setAppearance(x);
                      session.appearance = x;
                    }}
                    className={cx(
                      'rounded-xl border p-4 text-left',
                      appearance === x
                        ? 'border-violet-300/35 bg-violet-300/[.06]'
                        : 'border-white/[.08] hover:bg-white/[.03]',
                    )}
                  >
                    <div
                      className={cx(
                        'mb-4 h-16 rounded-md border',
                        x === 'Light'
                          ? 'border-slate-300 bg-slate-200'
                          : 'border-white/10 bg-[#101116]',
                      )}
                    >
                      <div className="m-2 h-2 w-1/3 rounded bg-violet-400/50" />
                    </div>
                    <span className="text-xs font-medium">{x}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <Eyebrow>Privacy, plainly</Eyebrow>
              <h1 className="display text-3xl font-semibold tracking-[-.05em]">
                A direction, not a guarantee.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">
                Ayatrisya is being designed around local-first storage. That
                storage is not implemented in this preview. Desktop coding and
                optional Drive support are future work.
              </p>
              <div className="mt-6 space-y-3">
                <Notice>
                  Nothing you type here is sent to an AI service. Demo
                  conversations exist only in page state and disappear when you
                  leave.
                </Notice>
                <Notice>
                  Do not put sensitive personal or business information into
                  this preview.
                </Notice>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="grid size-12 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[.07] text-violet-200">
                <Check size={22} />
              </div>
              <h1 className="display mt-6 text-3xl font-semibold tracking-[-.05em]">
                Your workspace is ready.
              </h1>
              <p className="mt-3 text-sm text-slate-400">
                Starting point: {usage}. Appearance: {appearance}. These choices
                are not saved beyond this session.
              </p>
              <div className="mt-7 rounded-lg border border-white/[.07] p-4 text-xs text-slate-500">
                You can explore chat, projects, research, documents and the
                desktop preview from the workspace navigation.
              </div>
            </>
          )}
          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="quiet"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ChevronLeft size={15} />
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)}>
                Continue <ChevronRight size={15} />
              </Button>
            ) : (
              <Link
                href="/workspace"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 font-semibold text-white"
              >
                Enter workspace <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}
