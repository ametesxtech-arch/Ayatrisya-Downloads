import { useState } from 'react';
import { Link } from 'wouter';
import { Button, ConfirmDialog, Notice, inputCls } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import { usePrefs } from '@/hooks/use-prefs';
import { repository } from '@/storage/repository';
import { errMsg } from '@/lib/format';
import { ProviderConnections } from '@/components/ProviderConnections';

export function AccountPage({ notify, goto }: { notify: (m: string) => void; goto: (h: string) => void }) {
  const { user, loading, configured, error, sendVerification, refreshUser, signOut } = useAuth();
  const { prefs, save } = usePrefs();
  const [name, setName] = useState<string | null>(null), [copy, setCopy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); notify(ok); } catch (e) { notify(errMsg(e)); } };
  return <div className="mx-auto max-w-[760px] p-4 sm:p-8">
    <PageHeading eyebrow="Account" title={user ? 'Your account' : 'Guest workspace'} description="Your content lives in this browser regardless of sign-in. Signing in identifies you; it does not upload your work." />
    <section className="mb-5 rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <h2 className="text-sm font-semibold">Profile</h2>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void act(() => save({ displayName: (name ?? prefs.displayName).trim() }), 'Display name saved.'); }}>
        <label className="min-w-0 flex-1 text-xs text-slate-400">Display name (stored locally)<input value={name ?? prefs.displayName} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
        <Button type="submit">Save</Button>
      </form>
    </section>
    <ProviderConnections user={user} />
    {loading ? <p className="text-sm text-slate-400" role="status">Checking sign-in…</p> : user ? <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5" data-testid="account-details">
      <h2 className="text-sm font-semibold">Sign-in</h2>
      <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-[11px] text-slate-500">Email</dt><dd>{user.email}</dd></div><div><dt className="text-[11px] text-slate-500">Verification</dt><dd>{user.emailVerified ? 'Verified' : 'Not verified'}</dd></div></dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {!user.emailVerified && <><Button variant="outline" onClick={() => act(sendVerification, 'Verification email requested.')}>Send verification email</Button><Button variant="outline" onClick={() => act(refreshUser, 'Account status refreshed.')}>I have verified</Button></>}
        <Button variant="outline" onClick={() => setCopy(true)}>Copy guest data into this account</Button>
        <Button variant="outline" onClick={async () => { try { await signOut(); notify('Signed out. Your account workspace stays in this browser; the guest workspace is shown.'); goto('/workspace'); } catch (e) { notify(errMsg(e)); } }}>Sign out</Button>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Account deletion is not available in the app. To remove your sign-in account, contact the administrator of this deployment. You can delete browser content under Storage and backup.</p>
    </section> : <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <h2 className="text-sm font-semibold">Not signed in</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">You are using the guest workspace. Everything is saved in this browser only and may be lost if you clear browser data. Account details are visible only when signed in.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
      {!configured && <div className="mt-3"><Notice>Sign-in is not configured for this deployment, so accounts cannot be created yet. The guest workspace is fully usable.</Notice></div>}
      <div className="mt-4 flex gap-2">{configured && <><Link href="/auth/sign-in" className="inline-flex h-10 items-center rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white">Sign in</Link><Link href="/auth/create-account" className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm">Create account</Link></>}</div>
    </section>}
    {copy && <ConfirmDialog title="Copy guest data" confirmLabel="Copy to account" body="This copies everything in your guest workspace into this account's workspace in this browser. Guest originals are kept. Nothing leaves your device." onConfirm={async () => { try { const n = await repository.copyGuestToCurrent(); notify(`Copied ${n} records.`); } catch (e) { notify(errMsg(e)); } setCopy(false); }} onClose={() => setCopy(false)} />}
  </div>;
}
