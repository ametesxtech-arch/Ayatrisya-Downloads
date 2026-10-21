import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Github } from 'lucide-react';
import { Button, Eyebrow, Notice, inputCls } from '@/components/Primitives';
import { Brand } from '@/components/Brand';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import { usePrefs } from '@/hooks/use-prefs';
import { errMsg } from '@/lib/format';
import { PublicSiteFooter } from '@/components/PublicSite';

export function AuthPage() {
  const [path, setPath] = useLocation();
  const auth = useAuth();
  const { prefs, loaded } = usePrefs();
  const isCreate = path === '/auth/create-account', isReset = path === '/auth/reset-password', isCheck = path === '/auth/email-check';
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => { setError(''); setNotice(''); }, [path]);
  useEffect(() => {
    if (auth.user && !isCheck && loaded) {
      if (!auth.user.emailVerified && isCreate) return;
      setPath(prefs.onboardingComplete ? '/workspace' : '/onboarding', { replace: true });
    }
  }, [auth.user, isCheck, isCreate, loaded, prefs.onboardingComplete, setPath]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (!isReset && password.length < 8) return setError('Password must be at least 8 characters.');
    if (isCreate && password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      if (isReset) { await auth.resetPassword(email); setNotice('If an account exists for that address, a reset email has been requested. Check your inbox.'); }
      else if (isCreate) { await auth.register(email, password); setPath('/auth/email-check'); }
      else await auth.signIn(email, password);
    } catch (er) { setError(errMsg(er, 'Authentication failed.')); } finally { setBusy(false); }
  }
  async function google() { setError(''); setBusy(true); try { await auth.googleSignIn(); } catch (er) { setError(errMsg(er)); } finally { setBusy(false); } }
  async function github() { setError(''); setBusy(true); try { await auth.githubSignIn(); } catch (er) { setError(errMsg(er)); } finally { setBusy(false); } }
  if (isCheck) return <AuthFrame>
    <h1 className="display text-2xl font-semibold tracking-[-.04em]">Verify your email</h1>
    {auth.user ? <><p className="mt-3 text-sm leading-6 text-slate-400">Verification is for <b>{auth.user.email}</b>. Status: {auth.user.emailVerified ? 'verified' : 'not yet verified'}.</p>
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}{notice && <div className="mt-3"><Notice>{notice}</Notice></div>}
      <div className="mt-5 flex flex-wrap gap-2">{!auth.user.emailVerified && <><Button variant="outline" onClick={async () => { try { await auth.sendVerification(); setNotice('Verification email requested.'); } catch (er) { setError(errMsg(er)); } }}>Send again</Button><Button onClick={async () => { try { await auth.refreshUser(); } catch (er) { setError(errMsg(er)); } }}>I have verified</Button></>}<Button variant={auth.user.emailVerified ? 'solid' : 'quiet'} onClick={() => setPath(prefs.onboardingComplete ? '/workspace' : '/onboarding')}>Continue</Button></div></>
      : <p className="mt-3 text-sm text-slate-400">You are not signed in, so there is nothing to verify. <Link href="/auth/sign-in" className="underline">Sign in</Link>.</p>}
  </AuthFrame>;
  return <AuthFrame>
    <Eyebrow>{isReset ? 'Recovery' : isCreate ? 'Create account' : 'Sign in'}</Eyebrow>
    <h1 className="display text-2xl font-semibold tracking-[-.04em]">{isReset ? 'Reset your password' : isCreate ? 'Create your account' : 'Welcome back'}</h1>
    {!auth.loading && !auth.configured && <div className="mt-4"><Notice>Firebase Authentication is not configured, so sign-in and account creation are unavailable. You can still use limited guest access.</Notice></div>}
    {!isReset && <button type="button" onClick={google} disabled={busy || !auth.configured} className="mt-5 flex h-11 w-full items-center justify-center rounded-lg border border-white/10 text-sm font-semibold hover:bg-white/[.05] disabled:opacity-45">Continue with Google</button>}
    {!isReset && <button type="button" onClick={github} disabled={busy || !auth.configured} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold hover:bg-white/[.05] disabled:opacity-45"><Github size={16} />Continue with GitHub</button>}
    {!isReset && !auth.user && <button type="button" onClick={() => { auth.startGuest(); setPath('/workspace/chat'); }} className="mt-3 flex h-11 w-full items-center justify-center rounded-lg border border-violet-300/20 text-sm font-semibold text-violet-100 hover:bg-violet-300/[.06]">Continue as guest</button>}
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <label className="block text-xs font-medium text-slate-300">Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={`${inputCls} mt-2`} data-testid="input-email" /></label>
      {!isReset && <label className="block text-xs font-medium text-slate-300">Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={isCreate ? 'new-password' : 'current-password'} className={`${inputCls} mt-2`} placeholder="At least 8 characters" data-testid="input-password" /></label>}
      {isCreate && <label className="block text-xs font-medium text-slate-300">Confirm password<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" className={`${inputCls} mt-2`} data-testid="input-confirm" /></label>}
      {error && <div role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs text-rose-200">{error}</div>}
      {notice && <Notice>{notice}</Notice>}
      <Button type="submit" className="w-full" disabled={busy || !auth.configured}>{busy ? 'Working…' : isReset ? 'Send reset email' : isCreate ? 'Create account' : 'Sign in'}{!busy && <ArrowRight size={15} />}</Button>
    </form>
    {!isCreate && !isReset && <button onClick={() => setPath('/auth/reset-password')} className="mt-4 block w-full text-right text-xs text-slate-400 hover:text-violet-200">Forgot password?</button>}
    <div className="my-6 border-t border-white/[.07] pt-5 text-center text-xs text-slate-400">{isCreate ? 'Already have an account?' : 'New to Ayatrisya?'}{' '}<button onClick={() => setPath(isCreate ? '/auth/sign-in' : '/auth/create-account')} className="font-semibold text-slate-100 hover:text-violet-200">{isCreate ? 'Sign in' : 'Create an account'}</button></div>
    <p className="mt-6 text-center text-[11px] leading-5 text-slate-500">Guest access includes unlimited browser-saved chats and two image generations when generation is connected. Create an account to use the rest of Ayatrisya.</p>
  </AuthFrame>;
}

export function AuthFrame({ children }: { children: ReactNode }) {
  return <>
    <main className="app-noise flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_12%,rgba(94,79,179,.13),transparent_38%),#101116] px-4 py-16 sm:items-center sm:p-5">
    <Link href="/" className="absolute left-6 top-6 text-xs text-slate-400 hover:text-slate-100"><span className="sr-only">Back to </span>Ayatrisya home</Link>
    <div className="w-full max-w-[430px] rounded-2xl border border-white/[.075] bg-[#15171e]/95 p-6 shadow-2xl sm:p-9"><div className="mb-6"><Brand compact /></div>{children}</div>
    </main>
    <PublicSiteFooter />
  </>;
}
