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
    <PageHeading eyebrow="Account" title={user ? 'Your account' : 'Sign in required'} description="Your saved work stays in this browser for your account. Signing in does not upload it; optional integrations run only when you connect them." />
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
        <Button variant="outline" onClick={() => setCopy(true)}>Import older local work</Button>
        <Button variant="outline" onClick={async () => { try { await signOut(); notify('Signed out. Sign in again to access Ayatrisya.'); goto('/auth/sign-in'); } catch (e) { notify(errMsg(e)); } }}>Sign out</Button>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Account deletion is not available in the app. To remove your sign-in account, contact the administrator of this deployment. You can delete browser content under Storage and backup.</p>
    </section> : <section className="rounded-xl border border-white/[.075] bg-[#15171e] p-5">
      <h2 className="text-sm font-semibold">Not signed in</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Sign in or create an account to access Ayatrisya. An account is required; browser-local content is not shown here until you sign in.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
      {!configured && <div className="mt-3"><Notice>Firebase Authentication is not configured, so accounts cannot be created or used. Ask the deployment administrator to complete setup.</Notice></div>}
      <div className="mt-4 flex gap-2">{configured && <><Link href="/auth/sign-in" className="inline-flex h-10 items-center rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white">Sign in</Link><Link href="/auth/create-account" className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm">Create account</Link></>}</div>
    </section>}
    {copy && <ConfirmDialog title="Import older local work" confirmLabel="Import to account" body="This copies older browser-local records into this signed-in account in this browser. The original records are kept, and nothing is uploaded." onConfirm={async () => { try { const n = await repository.copyGuestToCurrent(); notify(`Imported ${n} records.`); } catch (e) { notify(errMsg(e)); } setCopy(false); }} onClose={() => setCopy(false)} />}
  </div>;
}
