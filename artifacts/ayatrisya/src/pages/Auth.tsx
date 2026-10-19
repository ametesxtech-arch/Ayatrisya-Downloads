import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, Globe2 } from 'lucide-react';
import { Button, Eyebrow, Notice } from '@/components/Primitives';
import { Brand } from '@/components/Brand';

export function AuthPage() {
  const [path, setPath] = useLocation();
  const isCreate = path === '/auth/create-account',
    isReset = path === '/auth/reset-password',
    isCheck = path === '/auth/email-check';
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!isReset && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (isReset) {
        setNotice('Password reset is not connected yet. No email was sent.');
      } else setPath('/auth/email-check');
    }, 700);
  }
  if (isCheck)
    return (
      <AuthFrame>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-violet-300/15 bg-violet-300/[.07] text-violet-200">
          <Check size={24} />
        </div>
        <h1 className="display mt-6 text-3xl font-semibold tracking-[-.05em]">
          Check your inbox
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          This is a preview state. Account email verification is not connected,
          and no message was sent.
        </p>
        <Link
          href="/workspace"
          className="mt-7 inline-flex h-11 items-center rounded-lg bg-violet-500 px-5 font-semibold text-white"
        >
          Continue as guest
        </Link>
        <button
          onClick={() => setPath('/auth/sign-in')}
          className="mt-4 block w-full text-xs text-slate-500 hover:text-white"
        >
          Back to sign in
        </button>
      </AuthFrame>
    );
  return (
    <AuthFrame>
      <Link href="/" aria-label="Ayatrisya home">
        <Brand />
      </Link>
      <div className="mt-9">
        <Eyebrow>
          {isReset
            ? 'Account recovery'
            : isCreate
              ? 'A considered beginning'
              : 'Welcome back'}
        </Eyebrow>
        <h1 className="display text-3xl font-semibold tracking-[-.055em]">
          {isReset
            ? 'Reset your password'
            : isCreate
              ? 'Create your account'
              : 'Sign in to Ayatrisya'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isReset
            ? 'Enter your email to request a reset link.'
            : isCreate
              ? 'Your workspace is ready when you are.'
              : 'Continue to your workspace.'}
        </p>
      </div>
      <div className="mt-7">
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            setNotice(
              'Google authentication is not connected in this UI preview.',
            )
          }
        >
          <Globe2 size={16} /> Continue with Google
        </Button>
        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-600">
          <span className="h-px flex-1 bg-white/[.08]" />
          or email
          <span className="h-px flex-1 bg-white/[.08]" />
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-medium text-slate-300">
          Email address
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm text-white placeholder:text-slate-600"
            placeholder="you@example.com"
            data-testid="input-email"
          />
        </label>
        {!isReset && (
          <label className="block text-xs font-medium text-slate-300">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={isCreate ? 'new-password' : 'current-password'}
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm text-white placeholder:text-slate-600"
              placeholder="At least 8 characters"
              data-testid="input-password"
            />
          </label>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-rose-400/15 bg-rose-400/[.06] p-3 text-xs text-rose-200"
          >
            {error}
          </div>
        )}
        {notice && <Notice>{notice}</Notice>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? 'Preparing preview…'
            : isReset
              ? 'Request reset link'
              : isCreate
                ? 'Create account'
                : 'Sign in'}{' '}
          {!busy && <ArrowRight size={15} />}
        </Button>
      </form>
      {!isCreate && !isReset && (
        <button
          onClick={() => setPath('/auth/reset-password')}
          className="mt-4 block w-full text-right text-xs text-slate-500 hover:text-violet-200"
        >
          Forgot password?
        </button>
      )}
      <div className="my-6 border-t border-white/[.07] pt-5 text-center text-xs text-slate-500">
        {isCreate ? 'Already have an account?' : 'New to Ayatrisya?'}{' '}
        <button
          onClick={() =>
            setPath(isCreate ? '/auth/sign-in' : '/auth/create-account')
          }
          className="font-semibold text-slate-200 hover:text-violet-200"
        >
          {isCreate ? 'Sign in' : 'Create an account'}
        </button>
      </div>
      <Link
        href="/workspace"
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[.08] text-xs font-semibold text-slate-300 hover:bg-white/[.04]"
      >
        Explore as guest <ArrowRight size={14} />
      </Link>
      <p className="mt-5 text-center text-[10px] leading-5 text-slate-600">
        Authentication is not connected. No account, session, or email will be
        created.
      </p>
    </AuthFrame>
  );
}

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="app-noise flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(ellipse_at_50%_12%,rgba(94,79,179,.13),transparent_38%),#101116] p-5">
      <div className="w-full max-w-[430px] rounded-2xl border border-white/[.075] bg-[#15171e]/95 p-7 shadow-2xl sm:p-9">
        {children}
      </div>
      <Link
        href="/"
        className="absolute left-6 top-6 text-xs text-slate-500 hover:text-slate-200"
      >
        ← Back to Ayatrisya
      </Link>
    </main>
  );
}
