import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Search, Sparkles, Upload, X } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { usePrefs } from '@/hooks/use-prefs';
import { wallpapers } from '@/data/wallpapers';
import type { PersonalizationPreferences, Preferences } from '@/storage/types';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import { useCloudPreferenceSync } from '@/integrations/firebase/CloudPreferenceSync';
import { readCloudPersonalization, writeCloudPersonalization } from '@/integrations/firebase/personalization-sync';
import { MemorySummaryBuilder } from './MemorySummaryBuilder';
import { MemoryManager } from '@/components/MemoryManager';

type SaveStatus = { kind: 'success' | 'error'; message: string } | null;

const inputClass = 'w-full rounded-lg border border-white/10 bg-[#101116] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-300/15';
const selectClass = `${inputClass} cursor-pointer`;
const cardClass = 'rounded-2xl border border-white/[.075] bg-[#15171e] p-4 sm:p-5';

const defaultPersonalization: PersonalizationPreferences = {
  enabled: true,
  useMemory: true,
  memorySummary: '',
  instructions: '',
  avoid: '',
  tone: 'balanced',
  length: 'balanced',
  format: 'automatic',
  examples: 'when-useful',
  clarifying: 'when-needed',
  technicality: 'balanced',
};

function describeWallpaper(id: string) {
  if (id === 'none') return 'No wallpaper';
  if (id === 'custom') return 'Custom image';
  return wallpapers.find((wallpaper) => wallpaper.id === id)?.name ?? 'No wallpaper';
}

function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const maxEdge = 1920;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image processing is unavailable in this browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.84;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > 1_400_000 && quality > 0.48) {
          quality -= 0.08;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        if (result.length > 1_400_000) throw new Error('This image is too large after compression. Choose a smaller image.');
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This image could not be opened. Try a different image file.'));
    };
    image.src = objectUrl;
  });
}

export function PersonalizationPage() {
  const { prefs, loaded, save } = usePrefs();
  const { user, guest } = useAuth();
  const cloudSync = useCloudPreferenceSync();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SaveStatus>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PersonalizationPreferences>(defaultPersonalization);
  const [cloudAvailable, setCloudAvailable] = useState<boolean | null>(null);
  const [cloudChecking, setCloudChecking] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loaded) setDraft({ ...defaultPersonalization, ...prefs.personalization });
  }, [loaded, prefs.personalization]);

  useEffect(() => {
    if (!user || guest) {
      setCloudAvailable(null);
      setCloudError('');
      return;
    }
    let active = true;
    setCloudChecking(true);
    readCloudPersonalization(user.uid).then((remote) => {
      if (active) {
        setCloudAvailable(!!remote);
        setCloudError('');
      }
    }).catch((error) => {
      if (active) {
        setCloudAvailable(null);
        setCloudError(error instanceof Error ? error.message : 'Firebase Firestore is not available.');
      }
    }).finally(() => { if (active) setCloudChecking(false); });
    return () => { active = false; };
  }, [guest, user?.uid]);

  const filteredWallpapers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return wallpapers;
    return wallpapers.filter((wallpaper) => wallpaper.name.toLocaleLowerCase().includes(normalized));
  }, [query]);

  async function persist(patch: Partial<Preferences>, successMessage: string) {
    setStatus(null);
    try {
      const result = await save(patch);
      if (!result) {
        setStatus({ kind: 'error', message: 'Could not save this setting. Check browser storage and try again.' });
        return false;
      }
      setStatus({ kind: 'success', message: successMessage });
      return true;
    } catch {
      setStatus({ kind: 'error', message: 'Could not save this setting. Check browser storage and try again.' });
      return false;
    }
  }

  async function selectWallpaper(id: string) {
    await persist({ wallpaper: id }, `${describeWallpaper(id)} selected.`);
  }

  async function uploadWallpaper(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type)) {
      setStatus({ kind: 'error', message: 'Choose a PNG, JPEG, WebP, or AVIF image file.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus({ kind: 'error', message: 'Images must be smaller than 20 MB before compression.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const data = await imageToDataUrl(file);
      const result = await save({ wallpaper: 'custom', customWallpaperData: data });
      if (!result) setStatus({ kind: 'error', message: 'The image was prepared but could not be stored. Check browser storage and try again.' });
      else setStatus({ kind: 'success', message: 'Custom wallpaper saved in this browser.' });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'The image could not be processed.' });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeCustomWallpaper() {
    const patch: Partial<Preferences> = { customWallpaperData: '' };
    if (prefs.wallpaper === 'custom') patch.wallpaper = 'none';
    await persist(patch, 'Custom wallpaper removed.');
  }

  function updateDraft<K extends keyof PersonalizationPreferences>(key: K, value: PersonalizationPreferences[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus(null);
  }

  async function savePersonalization() {
    setBusy(true);
    const ok = await persist({ personalization: { ...draft } }, prefs.syncAcrossDevices ? 'Personalization saved. Cloud sync will update your other signed-in devices.' : 'Personalization saved on this device.');
    setBusy(false);
    if (ok) setDraft({ ...draft });
  }

  async function enableAndUpload() {
    if (!user || guest) return;
    setBusy(true);
    setStatus(null);
    setCloudError('');
    try {
      await writeCloudPersonalization(user.uid, { ...prefs, personalization: { ...draft } });
      const enabled = await save({ syncAcrossDevices: true, personalization: { ...draft } });
      if (!enabled) throw new Error('Cloud settings were uploaded, but this device could not save the sync preference. Retry after checking browser storage.');
      setCloudAvailable(true);
      setStatus({ kind: 'success', message: 'Cloud sync is on. This device’s response style and built-in wallpaper were uploaded.' });
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Could not enable cloud sync.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreAndEnable() {
    if (!user || guest) return;
    setBusy(true);
    setCloudError('');
    setStatus(null);
    try {
      const remote = await readCloudPersonalization(user.uid);
      if (!remote) {
        setCloudAvailable(false);
        throw new Error('No cloud settings were found yet. Upload this device’s settings first.');
      }
      const restored = await save({
        wallpaper: remote.wallpaper,
        personalization: remote.personalization,
        syncAcrossDevices: true,
      });
      if (!restored) throw new Error('Cloud settings were read, but could not be saved on this device. Check browser storage and retry.');
      setCloudAvailable(true);
      setDraft({ ...remote.personalization });
      setStatus({ kind: 'success', message: 'Cloud settings loaded on this device. Sync is on.' });
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Could not restore cloud settings.');
    } finally {
      setBusy(false);
    }
  }

  async function disableCloudSync() {
    setBusy(true);
    const ok = await persist({ syncAcrossDevices: false }, 'Cloud sync turned off. Your cloud copy was not deleted.');
    setBusy(false);
    if (ok) setCloudError('');
  }

  if (!loaded) {
    return <div className="mx-auto max-w-[980px] p-4 sm:p-8" role="status" aria-label="Loading personalization settings">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[.06]" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-white/[.05]" />
      <div className="mt-8 h-48 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.025]" />
    </div>;
  }

  return <div className="route-in mx-auto max-w-[980px] p-4 pb-12 sm:p-8">
    <PageHeading eyebrow="Your workspace" title="Personalization" description="Shape the look and response style of your private Ayatrisya workspace." />

    <section className={`${cardClass} mb-5 overflow-hidden`} aria-labelledby="wallpaper-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono mb-1 text-[10px] uppercase tracking-[.18em] text-violet-200/70">01 / Appearance</p>
          <h2 id="wallpaper-heading" className="display text-lg font-semibold">A backdrop that feels like yours</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">Choose one of the 70 original Ayatrisya scenes, or bring in an image from your device.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
          <span className="h-2 w-2 rounded-full bg-violet-300" />
          Current: <span className="font-medium text-slate-200">{describeWallpaper(prefs.wallpaper)}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="relative min-h-32 overflow-hidden rounded-xl border border-white/10 bg-[#101116]">
          {prefs.wallpaper === 'custom' && prefs.customWallpaperData ? <img src={prefs.customWallpaperData} alt="Current custom wallpaper preview" className="absolute inset-0 h-full w-full object-cover" /> :
            prefs.wallpaper !== 'none' && wallpapers.find((wallpaper) => wallpaper.id === prefs.wallpaper) ? <img src={wallpapers.find((wallpaper) => wallpaper.id === prefs.wallpaper)?.src} alt={`${describeWallpaper(prefs.wallpaper)} wallpaper preview`} className="absolute inset-0 h-full w-full object-cover" /> :
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_20%_15%,rgba(130,112,220,.15),transparent_48%),linear-gradient(135deg,#171922,#11131a)]">
                <span className="rounded-full border border-white/10 bg-[#101116]/70 px-3 py-1.5 text-xs text-slate-400">A quiet canvas</span>
              </div>}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-[#101116]/90 to-transparent px-4 pb-3 pt-8">
            <span className="text-xs font-medium text-white">{describeWallpaper(prefs.wallpaper)}</span>
            {prefs.customWallpaperData && <button type="button" onClick={() => void removeCustomWallpaper()} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#101116]/75 px-2.5 py-1.5 text-[11px] text-white hover:bg-[#20232c]" aria-label="Remove saved custom wallpaper" data-testid="button-remove-wallpaper"><X size={13} />Remove custom</button>}
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-dashed border-white/[.14] bg-white/[.015] p-4">
          <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-violet-300/10 text-violet-200"><ImagePlus size={17} /></div>
          <h3 className="text-sm font-medium">Use your own image</h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Stored locally in this browser as a compressed JPEG. Up to 20 MB before compression.</p>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" aria-label="Choose a custom wallpaper image" onChange={(event) => void uploadWallpaper(event.target.files?.[0])} data-testid="input-custom-wallpaper" />
          <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[.045] px-3 text-xs font-medium text-slate-200 hover:bg-white/[.08] disabled:cursor-wait disabled:opacity-50" data-testid="button-upload-wallpaper">
            <Upload size={14} />{busy ? 'Processing image…' : prefs.customWallpaperData ? 'Replace image' : 'Choose image'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/[.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-200">Wallpaper library <span className="ml-1 font-normal text-slate-500">70 scenes</span></h3>
          <p className="mt-1 text-[11px] text-slate-500">Your custom image stays saved when you choose a preset.</p>
        </div>
        <label className="relative block w-full sm:max-w-[260px]">
          <span className="sr-only">Search wallpapers</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenes" className={`${inputClass} py-2 pl-9 text-xs`} data-testid="input-wallpaper-search" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void selectWallpaper('none')} aria-pressed={prefs.wallpaper === 'none'} className={`h-10 rounded-lg border px-3 text-xs ${prefs.wallpaper === 'none' ? 'border-violet-300/70 bg-violet-300/10 text-violet-100' : 'border-white/10 bg-[#101116] text-slate-400 hover:border-white/20 hover:text-slate-200'}`} data-testid="button-wallpaper-none">No wallpaper</button>
        {prefs.customWallpaperData && <button type="button" onClick={() => void selectWallpaper('custom')} aria-pressed={prefs.wallpaper === 'custom'} className={`h-10 rounded-lg border px-3 text-xs ${prefs.wallpaper === 'custom' ? 'border-violet-300/70 bg-violet-300/10 text-violet-100' : 'border-white/10 bg-[#101116] text-slate-400 hover:border-white/20 hover:text-slate-200'}`} data-testid="button-wallpaper-custom">Custom image</button>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" role="group" aria-label="Wallpaper presets">
        {filteredWallpapers.map((wallpaper) => {
          const selected = prefs.wallpaper === wallpaper.id;
          return <button key={wallpaper.id} type="button" onClick={() => void selectWallpaper(wallpaper.id)} aria-pressed={selected} aria-label={`Select ${wallpaper.name}${selected ? ', currently selected' : ''}`} className={`group relative aspect-[1.75] overflow-hidden rounded-lg border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${selected ? 'border-violet-300 ring-1 ring-violet-300/60' : 'border-white/10 hover:border-white/30'}`} data-testid={`button-wallpaper-${wallpaper.id}`}>
            <img src={wallpaper.src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b0c11]/95 to-transparent px-2.5 pb-2 pt-6 text-[10px] font-medium text-white">{wallpaper.name}</span>
            {selected && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-violet-300 text-[#171523]" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
          </button>;
        })}
      </div>
      {filteredWallpapers.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center" role="status">
        <Search size={18} className="mx-auto text-slate-500" />
        <p className="mt-2 text-sm text-slate-300">No scenes match “{query}”</p>
        <button type="button" className="mt-1 text-xs text-violet-200 underline underline-offset-4" onClick={() => setQuery('')}>Clear search</button>
      </div>}
    </section>

    <section className={`${cardClass} mb-5`} aria-labelledby="cloud-sync-heading">
      <p className="mono mb-1 text-[10px] uppercase tracking-[.18em] text-violet-200/70">02 / Across your devices</p>
      <h2 id="cloud-sync-heading" className="display text-lg font-semibold">Sync personalization with your account</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Optional Firebase Firestore sync for your response preferences, personal summary, and built-in wallpaper choice. Chat history and custom wallpaper image files are not uploaded. Before using it, enable Firestore in your existing Firebase project and publish the included security rules; the app does not create or deploy a Firebase project for you.</p>
      {!user || guest
        ? <p className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs text-amber-100/80">Sign in to an Ayatrisya account to sync personalization. Guest settings stay on this device.</p>
        : prefs.syncAcrossDevices
          ? <div className="mt-4 flex flex-col gap-3 rounded-xl border border-teal-300/15 bg-teal-300/[.035] p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">{cloudSync.state === 'synced' ? 'Cloud sync is on' : cloudSync.state === 'error' ? 'Cloud sync needs attention' : 'Connecting to cloud sync…'}</p>
              <p className="mt-1 text-[11px] text-slate-500">{cloudSync.state === 'synced' ? 'Your settings are syncing for this signed-in account.' : cloudSync.error || cloudError || 'Waiting for Firebase Firestore.'}</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void disableCloudSync()} className="min-h-9 shrink-0 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/[.05] disabled:opacity-50">Turn off sync</button>
          </div>
          : <div className="mt-4 rounded-xl border border-white/[.07] bg-white/[.02] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400" role="status">{cloudChecking ? 'Checking for saved cloud settings…' : cloudAvailable ? 'A cloud copy exists for this account.' : cloudError ? 'Could not check cloud settings.' : 'No cloud copy found for this account.'}</p>
              <button type="button" disabled={cloudChecking || busy} onClick={() => { if (user) { setCloudChecking(true); readCloudPersonalization(user.uid).then((remote) => { setCloudAvailable(!!remote); setCloudError(''); }).catch((error) => setCloudError(error instanceof Error ? error.message : 'Firestore could not be reached.')).finally(() => setCloudChecking(false)); } }} className="min-h-8 rounded-md border border-white/10 px-2.5 text-[11px] text-slate-300 hover:bg-white/[.05] disabled:opacity-50">Check cloud</button>
            </div>
            {cloudError && <p className="mt-2 text-[11px] text-rose-300" role="alert">{cloudError} If this is a new Firebase project, enable Firestore and publish the included firestore.rules security rules.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy || cloudChecking} onClick={() => void enableAndUpload()} className="min-h-9 rounded-lg bg-violet-300 px-3 text-xs font-semibold text-[#1a1830] hover:bg-violet-200 disabled:opacity-50">{busy ? 'Saving…' : 'Upload this device & enable'}</button>
              <button type="button" disabled={busy || cloudChecking || !cloudAvailable} onClick={() => void restoreAndEnable()} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/[.05] disabled:cursor-not-allowed disabled:opacity-45">Restore cloud settings & enable</button>
            </div>
          </div>}
    </section>

    <section className={`${cardClass} mb-5`} aria-labelledby="response-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono mb-1 text-[10px] uppercase tracking-[.18em] text-violet-200/70">03 / Response style</p>
          <h2 id="response-heading" className="display text-lg font-semibold">Set the feel of your conversations</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Preferences are stored locally; optional account sync is managed above. When Ayatrisya sends a chat to a configured model, enabled response preferences are included with that request.</p>
        </div>
        <Sparkles size={18} className="mt-1 shrink-0 text-violet-200/70" aria-hidden="true" />
      </div>
      <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[.07] bg-white/[.02] p-3.5">
        <span><span className="block text-sm font-medium text-slate-200">Personalization</span><span className="mt-0.5 block text-[11px] text-slate-500">Keep your response preferences ready to use.</span></span>
        <input type="checkbox" checked={draft.enabled} onChange={(event) => updateDraft('enabled', event.target.checked)} className="h-4 w-4 accent-violet-300" aria-label="Enable personalization preferences" data-testid="input-personalization-enabled" />
      </label>
      <fieldset disabled={!draft.enabled} className="mt-4 min-w-0 disabled:opacity-55">
        <legend className="sr-only">Response preferences</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-400">Tone
            <select value={draft.tone} onChange={(event) => updateDraft('tone', event.target.value as PersonalizationPreferences['tone'])} className={`${selectClass} mt-1.5`} data-testid="select-response-tone">
              <option value="balanced">Balanced</option><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="direct">Direct</option><option value="creative">Creative</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-400">Length
            <select value={draft.length} onChange={(event) => updateDraft('length', event.target.value as PersonalizationPreferences['length'])} className={`${selectClass} mt-1.5`} data-testid="select-response-length">
              <option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-400">Format
            <select value={draft.format} onChange={(event) => updateDraft('format', event.target.value as PersonalizationPreferences['format'])} className={`${selectClass} mt-1.5`} data-testid="select-response-format">
              <option value="automatic">Automatic</option><option value="paragraphs">Paragraphs</option><option value="bullets">Bullets</option><option value="steps">Numbered steps</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-400">Examples
            <select value={draft.examples} onChange={(event) => updateDraft('examples', event.target.value as PersonalizationPreferences['examples'])} className={`${selectClass} mt-1.5`}>
              <option value="when-useful">When useful</option><option value="often">Often</option><option value="rarely">Rarely</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-400">Clarifying questions
            <select value={draft.clarifying} onChange={(event) => updateDraft('clarifying', event.target.value as PersonalizationPreferences['clarifying'])} className={`${selectClass} mt-1.5`}>
              <option value="when-needed">Only when needed</option><option value="assume">Make reasonable assumptions</option><option value="ask-first">Ask before ambiguous tasks</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-400">Technical language
            <select value={draft.technicality} onChange={(event) => updateDraft('technicality', event.target.value as PersonalizationPreferences['technicality'])} className={`${selectClass} mt-1.5`}>
              <option value="accessible">Accessible</option><option value="balanced">Balanced</option><option value="technical">Technical</option>
            </select>
          </label>
        </div>
      </fieldset>
    </section>

    <section className={`${cardClass} mb-5`} aria-labelledby="memory-heading">
      <p className="mono mb-1 text-[10px] uppercase tracking-[.18em] text-violet-200/70">04 / Personal notes</p>
      <h2 id="memory-heading" className="display text-lg font-semibold">A note you control</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Write your own summary or draft one from selected chats below. Drafting runs locally from your messages only; review and save it yourself. It stays in this browser unless you enable account sync above. The summary is included in model requests only when both personalization and the opt-in below are enabled.</p>
      <label className={`mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3.5 ${draft.useMemory && draft.enabled ? 'border-violet-300/20 bg-violet-300/[.045]' : 'border-white/[.07] bg-white/[.02]'}`}>
        <span><span className="block text-sm font-medium text-slate-200">Opt in to use this summary</span><span className="mt-0.5 block text-[11px] text-slate-500">Choose whether this summary is included in personalization.</span></span>
        <input type="checkbox" checked={draft.useMemory} disabled={!draft.enabled} onChange={(event) => updateDraft('useMemory', event.target.checked)} className="h-4 w-4 accent-violet-300 disabled:cursor-not-allowed" aria-label="Opt in to use the personal summary" data-testid="input-use-memory" />
      </label>
      <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="memory-summary">Your summary</label>
      <textarea id="memory-summary" value={draft.memorySummary} onChange={(event) => updateDraft('memorySummary', event.target.value)} disabled={!draft.enabled} rows={4} maxLength={2400} placeholder="For example: I prefer examples in TypeScript and appreciate a brief explanation before the details." className={`${inputClass} mt-1.5 resize-y leading-5 disabled:cursor-not-allowed`} data-testid="textarea-memory-summary" />
      <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>Only use details you are comfortable keeping in this browser.</span><span>{draft.memorySummary.length}/2,400</span></div>
      <MemorySummaryBuilder onUse={(summary) => updateDraft('memorySummary', summary)} />
      <div className="mt-6 border-t border-white/[.08] pt-6">
        <MemoryManager notify={(msg) => setStatus({ kind: 'success', message: msg })} />
      </div>
    </section>

    <section className={`${cardClass} mb-5`} aria-labelledby="guidance-heading">
      <p className="mono mb-1 text-[10px] uppercase tracking-[.18em] text-violet-200/70">05 / Guidance</p>
      <h2 id="guidance-heading" className="display text-lg font-semibold">What to lean into — and leave out</h2>
      <p className="mt-1 text-xs leading-5 text-slate-400">Add your own response instructions and things you would rather avoid.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-xs font-medium text-slate-400" htmlFor="custom-instructions">Custom instructions
      <textarea id="custom-instructions" value={draft.instructions} onChange={(event) => updateDraft('instructions', event.target.value)} disabled={!draft.enabled} rows={5} maxLength={2000} placeholder="What context or approach should responses keep in mind?" className={`${inputClass} mt-1.5 resize-y leading-5 disabled:cursor-not-allowed`} data-testid="textarea-custom-instructions" />
          <span className="mt-1 block text-right text-[10px] font-normal text-slate-500">{draft.instructions.length}/2,000</span>
        </label>
        <label className="block text-xs font-medium text-slate-400" htmlFor="things-to-avoid">Things to avoid
          <textarea id="things-to-avoid" value={draft.avoid} onChange={(event) => updateDraft('avoid', event.target.value)} disabled={!draft.enabled} rows={5} maxLength={1000} placeholder="Anything you would prefer not to see in responses?" className={`${inputClass} mt-1.5 resize-y leading-5 disabled:cursor-not-allowed`} data-testid="textarea-things-to-avoid" />
          <span className="mt-1 block text-right text-[10px] font-normal text-slate-500">{draft.avoid.length}/1,000</span>
        </label>
      </div>
    </section>

    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-5 text-xs" role="status" aria-live="polite" data-testid="status-personalization-save">
        {status && <span className={status.kind === 'success' ? 'text-teal-200' : 'text-rose-300'}>{status.message}</span>}
      </div>
      <button type="button" disabled={busy} onClick={() => void savePersonalization()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-300 px-4 text-xs font-semibold text-[#1a1830] hover:bg-violet-200 disabled:cursor-wait disabled:opacity-55" data-testid="button-save-personalization">
        <Check size={14} />{busy ? 'Saving…' : 'Save response preferences'}
      </button>
    </div>
  </div>;
}

export default PersonalizationPage;
