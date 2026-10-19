import { createElement, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Download, Mic, Play, Save, Square, Upload, Volume2 } from 'lucide-react';
import { Button, ConfirmDialog, Notice, Skeleton, inputCls, areaCls } from '@/components/Primitives';
import { validateFile, validateFileContent } from '@/storage/files';
import { useLocalQuery } from '@/storage/hooks';
import { PageHeading } from '@/components/PageHeading';
import { useCaps } from '@/hooks/use-prefs';
import { repository } from '@/storage/repository';
import { downloadBlob } from '@/storage/backup';
import { modelClient } from '@/ai/client';
import { errMsg, formatBytes, MAX_UPLOAD } from '@/lib/format';

type Kind = 'image' | '3d' | 'music' | 'voice';
const meta = {
  image: { eyebrow: 'Image studio', title: 'Image generation', modality: 'image', formats: ['PNG', 'JPEG'], noun: 'image', tag: 'image-prompt' },
  '3d': { eyebrow: '3D studio', title: '3D generation', modality: '3d', formats: ['GLB', 'OBJ'], noun: '3D model', tag: '3d-prompt' },
  music: { eyebrow: 'Music studio', title: 'Music generation', modality: 'music', formats: ['WAV', 'MP3'], noun: 'track', tag: 'music-prompt' },
} as const;

export default function Studios({ kind, notify }: { kind: Kind; notify?: (m: string) => void }) {
  return kind === 'voice' ? <VoiceStudio notify={notify ?? (() => undefined)} /> : <GenerativeStudio kind={kind} notify={notify} />;
}

type Draft = { id?: string; prompt: string; options: Record<string, string> };
const aspects: Record<string, [number, number]> = { '1:1': [1, 1], '4:3': [4, 3], '3:2': [3, 2], '16:9': [16, 9], '3:4': [3, 4], '9:16': [9, 16] };
const dimBases = [512, 768, 1024];
const dimsFor = (ratio: string, base: number) => { const [w, h] = aspects[ratio]; return w >= h ? `${base} × ${Math.round((base * h) / w / 8) * 8}` : `${Math.round((base * w) / h / 8) * 8} × ${base}`; };
const assetFilter: Record<string, (n: string, t: string) => boolean> = {
  image: (n, t) => t.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(n),
  music: (n, t) => t.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(n),
  '3d': (n) => /\.(glb|gltf)$/i.test(n),
};
const accepts: Record<string, string> = { image: 'image/png,image/jpeg,image/gif,image/webp', music: 'audio/*', '3d': '.glb,.gltf' };

function useBlobUrl(attachmentId: string | undefined, enabled = true) {
  const [url, setUrl] = useState<string | null>(null), [err, setErr] = useState('');
  useEffect(() => {
    if (!attachmentId || !enabled) return;
    let u: string | null = null, off = false;
    repository.getFile(attachmentId).then((b) => { if (off) return; if (!b) { setErr('File data is not stored in this browser.'); return; } u = URL.createObjectURL(b); setUrl(u); }, (e) => !off && setErr(errMsg(e)));
    return () => { off = true; if (u) URL.revokeObjectURL(u); setUrl(null); };
  }, [attachmentId, enabled]);
  return { url, err };
}

function ModelView({ attachmentId }: { attachmentId: string }) {
  const { url, err } = useBlobUrl(attachmentId);
  const [ready, setReady] = useState(false), [loadErr, setLoadErr] = useState('');
  const el = useRef<HTMLElement & { cameraOrbit: string; cameraTarget: string; getCameraOrbit: () => { theta: number; phi: number; radius: number }; jumpCameraToGoal: () => void } | null>(null);
  useEffect(() => { import('@google/model-viewer').then(() => setReady(true), (e) => setLoadErr(errMsg(e))); }, []);
  const orbit = (dTheta: number, scale: number) => { const v = el.current; if (!v) return; const o = v.getCameraOrbit(); v.cameraOrbit = `${o.theta + dTheta}rad ${o.phi}rad ${Math.max(0.05, o.radius * scale)}m`; };
  const reset = () => { const v = el.current; if (!v) return; v.cameraOrbit = 'auto auto auto'; v.cameraTarget = 'auto auto auto'; v.jumpCameraToGoal(); };
  if (err || loadErr) return <p role="alert" className="text-xs text-rose-300">{err || loadErr}</p>;
  if (!url || !ready) return <div className="h-72 animate-pulse rounded-lg bg-white/[.05]" />;
  return <div>
    {createElement('model-viewer', { ref: el, src: url, 'camera-controls': '', 'touch-action': 'pan-y', alt: '3D model you imported', style: { width: '100%', height: 320, background: '#0d0e13', borderRadius: 12 }, onError: () => setLoadErr('This file could not be rendered as a valid glTF model.') })}
    <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" onClick={() => orbit(-0.4, 1)}>Orbit left</Button><Button variant="outline" onClick={() => orbit(0.4, 1)}>Orbit right</Button><Button variant="outline" onClick={() => orbit(0, 0.8)}>Zoom in</Button><Button variant="outline" onClick={() => orbit(0, 1.25)}>Zoom out</Button><Button variant="outline" onClick={reset}>Reset view</Button></div>
    <p className="mt-1 text-[11px] text-slate-500">Drag to orbit, scroll or pinch to zoom. Shows only the file you imported.</p>
  </div>;
}

function AssetHistory({ kind, notify }: { kind: 'image' | 'music' | '3d'; notify: (m: string) => void }) {
  const items = useLocalQuery(() => repository.listItems({ kind: 'file', limit: 500 }), []);
  const atts = useLocalQuery(() => repository.listAttachments(), []);
  const map = new Map((atts.data ?? []).map((a) => [a.id, a]));
  const rows = (items.data ?? []).filter((i) => { const a = i.attachmentId ? map.get(i.attachmentId) : undefined; return a && assetFilter[kind](a.name, a.mimeType); });
  const [open, setOpen] = useState<string | null>(null), [del, setDel] = useState<(typeof rows)[number] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function add(files: FileList | null) {
    for (const f of Array.from(files ?? [])) { try { validateFile(f); await validateFileContent(f); if (!assetFilter[kind](f.name, f.type)) throw new Error('This is not a supported file for this studio.'); await repository.addFile(f); notify(`Saved ${f.name} in this browser.`); } catch (e) { notify(`${f.name}: ${errMsg(e)}`); } }
    if (input.current) input.current.value = '';
  }
  return <section className="mt-8" aria-label="Local asset history">
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Local {kind === '3d' ? 'models' : kind === 'image' ? 'images' : 'audio'}</h2>
      <span><input ref={input} type="file" multiple hidden accept={accepts[kind]} onChange={(e) => void add(e.target.files)} /><Button variant="outline" onClick={() => input.current?.click()}><Upload size={14} />Import</Button></span></div>
    <p className="mt-1 text-xs text-slate-500">Files you imported or saved. They are stored only in this browser and were not generated by Ayatrisya.</p>
    {items.loading && !items.data && <Skeleton className="mt-3 h-16" />}
    {items.data && rows.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">Nothing here yet. Import a file to keep it with your work.</p>}
    <ul className="mt-3 grid gap-2">{rows.map((i) => { const a = map.get(i.attachmentId!)!; return <li key={i.id} className="rounded-xl border border-white/[.075] bg-[#15171e] p-3">
      <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm">{i.title}<span className="ml-2 text-[11px] text-slate-500">{formatBytes(a.size)}</span></span>
        <Button variant="outline" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? 'Close' : kind === 'music' ? 'Play' : kind === '3d' ? 'View' : 'Preview'}</Button>
        <Button variant="outline" onClick={async () => { try { const b = await repository.getFile(a.id); if (!b) throw new Error('File data is not stored in this browser.'); downloadBlob(b, a.name); } catch (e) { notify(errMsg(e)); } }}><Download size={14} />Export</Button>
        <Button variant="outline" onClick={() => setDel(i)}>Delete</Button></div>
      {open === i.id && <div className="mt-3">{kind === '3d' ? <ModelView attachmentId={a.id} /> : <AssetPreview kind={kind} id={a.id} />}</div>}
    </li>; })}</ul>
    {del && <ConfirmDialog danger title="Delete file" confirmLabel="Delete" body={<>Delete <b>{del.title}</b> from this browser? This cannot be undone. Copies already backed up to Google Drive are not affected.</>} onConfirm={async () => { try { if (del.attachmentId) await repository.deleteAttachment(del.attachmentId); await repository.deleteItem(del.id).catch(() => undefined); } catch (e) { notify(errMsg(e)); } setDel(null); }} onClose={() => setDel(null)} />}
  </section>;
}
function AssetPreview({ kind, id }: { kind: 'image' | 'music'; id: string }) {
  const { url, err } = useBlobUrl(id);
  if (err) return <p role="alert" className="text-xs text-rose-300">{err}</p>;
  if (!url) return <div className="h-24 animate-pulse rounded bg-white/[.05]" />;
  return kind === 'music' ? <audio src={url} controls className="w-full" aria-label="Audio playback" /> : <img src={url} alt="Stored file preview" className="max-h-96 rounded-lg" />;
}

function GenerativeStudio({ kind, notify }: { kind: Exclude<Kind, 'voice'>; notify?: (m: string) => void }) {
  const m = meta[kind];
  const note = notify ?? (() => undefined);
  const { caps, loading } = useCaps();
  const capable = caps.some((c) => c.available && c.modalities.includes(m.modality));
  const [prompt, setPrompt] = useState(''), [fmt, setFmt] = useState<string>(m.formats[0]), [ratio, setRatio] = useState('1:1'), [base, setBase] = useState(1024), [editId, setEditId] = useState<string | undefined>();
  const drafts = useLocalQuery(() => repository.listItems({ kind: 'note', limit: 200 }), []);
  const mine = (drafts.data ?? []).filter((d) => d.tags.includes(m.tag));
  const options = (): Record<string, string> => (kind === 'image' ? { format: fmt, aspect: ratio, dimensions: dimsFor(ratio, base) } : { format: fmt });
  async function saveDraft() {
    try { await repository.saveItem({ id: editId, title: prompt.slice(0, 48) || 'Prompt draft', kind: 'note', content: JSON.stringify({ prompt, options: options() } satisfies Draft), tags: [m.tag, 'draft'] }); setEditId(undefined); note('Draft saved. Nothing was generated.'); } catch (e) { note(errMsg(e)); }
  }
  function load(d: { id: string; content: string }) { try { const x = JSON.parse(d.content) as Draft; setPrompt(x.prompt); setEditId(d.id); if (x.options?.format) setFmt(x.options.format); if (x.options?.aspect) setRatio(x.options.aspect); const w = Number(x.options?.dimensions?.split(' ')[0]), h = Number(x.options?.dimensions?.split(' ')[2]); if (w && h) setBase(Math.max(w, h)); } catch { setPrompt(d.content); setEditId(d.id); } }
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8">
    <PageHeading eyebrow={m.eyebrow} title={m.title} description={`Prepare prompts and keep your own ${m.noun} files here. Generation only happens once an Ayatrisya ${m.noun} model is connected.`} />
    <div role="status" className="mb-5 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-sm text-amber-100/90" data-testid={`status-${kind}`}>
      {loading ? 'Checking model status…' : capable ? `A model reports ${m.modality} capability, but the application transport currently supports text only. Generation is not wired up.` : `No ${m.noun} model is connected. Generation is unavailable.`}
    </div>
    <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
      <div>
        <label className="block text-xs font-medium text-slate-400">Prompt<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className={`${areaCls} mt-1.5 min-h-40`} placeholder={`Describe the ${m.noun} you want`} /></label>
        {kind === 'image' && <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-400">Aspect ratio<select value={ratio} onChange={(e) => setRatio(e.target.value)} className={`${inputCls} mt-1.5`}>{Object.keys(aspects).map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="block text-xs font-medium text-slate-400">Dimensions<select value={base} onChange={(e) => setBase(Number(e.target.value))} className={`${inputCls} mt-1.5`}>{dimBases.map((b) => <option key={b} value={b}>{dimsFor(ratio, b)}</option>)}</select></label>
        </div>}
        <label className="mt-3 block text-xs font-medium text-slate-400">Output format<select value={fmt} onChange={(e) => setFmt(e.target.value)} className={`${inputCls} mt-1.5`}>{m.formats.map((f) => <option key={f}>{f}</option>)}</select></label>
        <p className="mt-1 text-[11px] text-slate-500">These options are saved with the draft. A connected model will report which it supports.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button disabled title="No model connected">Generate (unavailable)</Button><Button variant="outline" onClick={saveDraft} disabled={!prompt.trim()}><Save size={14} />{editId ? 'Update draft' : 'Save draft'}</Button>{editId && <Button variant="outline" onClick={() => { setEditId(undefined); setPrompt(''); }}>New draft</Button>}</div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Drafts</h2>
        {mine.length === 0 && <p className="mt-2 rounded-lg border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">No drafts saved. Prompts and options you save stay here and in your Library.</p>}
        <ul className="mt-2 space-y-2">{mine.map((d) => <li key={d.id} className="flex items-center gap-2 rounded-lg border border-white/[.075] bg-[#15171e] p-3 text-sm"><span className="min-w-0 flex-1 truncate">{d.title}</span><Button variant="outline" onClick={() => load(d)}>Edit</Button><Button variant="outline" onClick={() => { repository.deleteItem(d.id).then(() => { if (editId === d.id) setEditId(undefined); }, (e) => note(errMsg(e))); }}>Delete</Button></li>)}</ul>
      </div>
    </div>
    <AssetHistory kind={kind} notify={note} />
  </div>;
}

function VoiceStudio({ notify }: { notify: (m: string) => void }) {
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const [recording, setRecording] = useState(false), [blob, setBlob] = useState<Blob | null>(null), [url, setUrl] = useState(''), [name, setName] = useState('recording'), [err, setErr] = useState(''), [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null), streamRef = useRef<MediaStream | null>(null), timer = useRef<number | undefined>(undefined);
  const [consent, setConsent] = useState(false), [transcript, setTranscript] = useState(''), [tts, setTts] = useState(''), [speech, setSpeech] = useState<Blob | null>(null), [speechUrl, setSpeechUrl] = useState(''), [busy, setBusy] = useState(''), [svcErr, setSvcErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const { caps } = useCaps();
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); window.clearInterval(timer.current); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (speechUrl) URL.revokeObjectURL(speechUrl); }, [speechUrl]);
  const setAudio = (b: Blob, n: string) => { setBlob(b); setName(n); setUrl(URL.createObjectURL(b)); setTranscript(''); };
  async function start() {
    setErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      const r = new MediaRecorder(s); const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => { s.getTracks().forEach((t) => t.stop()); setAudio(new Blob(chunks, { type: r.mimeType || 'audio/webm' }), `recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`); };
      recRef.current = r; r.start(); setRecording(true); setSecs(0);
      timer.current = window.setInterval(() => setSecs((x) => x + 1), 1000);
    } catch (e) { setErr(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser site settings and try again.' : errMsg(e, 'Could not open the microphone.')); }
  }
  function stop() { recRef.current?.stop(); window.clearInterval(timer.current); setRecording(false); }
  const ext = (b: Blob) => (b.type.includes('ogg') ? 'ogg' : b.type.includes('wav') ? 'wav' : b.type.includes('mp4') ? 'm4a' : b.type.includes('mpeg') ? 'mp3' : 'webm');
  async function transcribe() {
    if (!blob) return; setBusy('stt'); setSvcErr('');
    try { setTranscript(await modelClient.transcribeAudio(blob, {})); } catch (e) { setSvcErr(errMsg(e, 'Transcription is unavailable.')); } finally { setBusy(''); }
  }
  async function speak() {
    setBusy('tts'); setSvcErr('');
    try { const b = await modelClient.synthesizeSpeech(tts, {}); setSpeech(b); setSpeechUrl(URL.createObjectURL(b)); } catch (e) { setSvcErr(errMsg(e, 'Speech synthesis is unavailable.')); } finally { setBusy(''); }
  }
  const sttReady = caps.some((c) => c.available && c.modalities.includes('stt')), ttsReady = caps.some((c) => c.available && c.modalities.includes('tts'));
  return <div className="mx-auto max-w-[1000px] p-4 sm:p-8">
    <PageHeading eyebrow="Voice studio" title="Record, listen, keep." description="Recording and playback happen entirely in your browser. Transcription and speech synthesis need an Ayatrisya speech model, which is not connected unless reported below." />
    <Notice>Privacy: audio you record or open stays in this browser unless you tick the consent box below and use a model action, which sends it to the configured Ayatrisya server. No external speech service is used.</Notice>
    <section className="mt-6 rounded-xl border border-white/[.075] bg-[#15171e] p-5" aria-labelledby="rec-h">
      <h2 id="rec-h" className="text-sm font-semibold">Audio</h2>
      {!supported && <p role="alert" className="mt-3 text-sm text-amber-200">This browser does not support microphone recording (MediaRecorder). You can still open a local audio file.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!recording ? <Button onClick={start} disabled={!supported} data-testid="button-record"><Mic size={15} />Record</Button> : <Button onClick={stop} data-testid="button-stop"><Square size={14} />Stop ({secs}s)</Button>}
        <input ref={file} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > MAX_UPLOAD) { setErr(`File is ${formatBytes(f.size)}; limit is ${formatBytes(MAX_UPLOAD)}.`); return; } void (async () => { try { await validateFileContent(f); setAudio(f, f.name.replace(/\.[^.]+$/, '')); setErr(''); } catch (er) { setErr(errMsg(er)); } })(); e.target.value = ''; }} />
        <Button variant="outline" onClick={() => file.current?.click()}><Upload size={14} />Open audio file</Button>
        {recording && <span role="status" className="flex items-center gap-2 text-xs text-rose-300"><span className="size-2 animate-pulse rounded-full bg-rose-400" />Recording</span>}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-rose-300">{err}</p>}
      {blob && url && <div className="mt-4"><audio src={url} controls className="w-full" aria-label="Playback" />
        <p className="mt-2 text-xs text-slate-500">{formatBytes(blob.size)} · {blob.type || 'audio'} · not yet saved</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadBlob(blob, `${name}.${ext(blob)}`)}><Download size={14} />Download</Button><Button variant="outline" onClick={() => { setBlob(null); setUrl(''); setTranscript(''); notify('Recording cleared from this page.'); }}>Clear recording</Button>
          <Button variant="outline" onClick={async () => { try { await repository.addFile(new File([blob], `${name}.${ext(blob)}`, { type: blob.type })); notify('Saved to your library.'); } catch (e) { notify(errMsg(e)); } }}><Save size={14} />Save to library</Button></div></div>}
    </section>
    <section className="mt-5 grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border border-white/[.075] bg-[#15171e] p-5"><h2 className="text-sm font-semibold">Transcription</h2>
        <p className="mt-1 text-xs text-slate-500" data-testid="status-stt">{sttReady ? 'A model reports speech-to-text capability.' : 'Speech-to-text model not connected.'}</p>
        <label className="mt-3 block"><span className="sr-only">Transcript</span><textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Transcript appears here; you can also type notes." className={`${areaCls} min-h-28`} /></label>
        <Button className="mt-3 mr-2" variant="outline" disabled={!transcript} onClick={() => navigator.clipboard.writeText(transcript).then(() => notify('Transcript copied.'), () => notify('Copy was blocked by the browser.'))}>Copy transcript</Button><Button className="mt-3 mr-2" variant="outline" disabled={!transcript} onClick={() => setTranscript('')}>Clear transcript</Button><Button className="mt-3" variant="outline" disabled={!sttReady || !blob || !consent || busy === 'stt'} onClick={transcribe}>{busy === 'stt' ? 'Transcribing…' : 'Transcribe with Ayatrisya'}</Button></div>
      <div className="rounded-xl border border-white/[.075] bg-[#15171e] p-5"><h2 className="text-sm font-semibold">Text to speech</h2>
        <p className="mt-1 text-xs text-slate-500" data-testid="status-tts">{ttsReady ? 'A model reports text-to-speech capability.' : 'Text-to-speech model not connected.'}</p>
        <label className="mt-3 block"><span className="sr-only">Text to speak</span><textarea value={tts} onChange={(e) => setTts(e.target.value)} placeholder="Text to speak" className={`${areaCls} min-h-28`} /></label>
        <Button className="mt-3" variant="outline" disabled={!ttsReady || !tts.trim() || !consent || busy === 'tts'} onClick={speak}><Volume2 size={14} />{busy === 'tts' ? 'Generating…' : 'Generate speech'}</Button>
        {speech && speechUrl && <div className="mt-3"><audio src={speechUrl} controls className="w-full" aria-label="Generated speech" /><Button className="mt-2" variant="outline" onClick={() => downloadBlob(speech, 'speech.' + ext(speech))}><Download size={14} />Download</Button></div>}</div>
    </section>
    <label className="mt-4 flex items-start gap-2 text-xs text-slate-400"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-violet-500" />I agree that audio or text for a transcription or speech action is sent to the configured Ayatrisya model server.</label>
    {svcErr && <p role="alert" className="mt-3 rounded-md bg-rose-400/10 p-3 text-xs text-rose-200">{svcErr}</p>}
    <p className="mt-6 text-xs text-slate-500"><Play size={12} className="mr-1 inline" />Looking for dictation in chat? Record here, then paste the transcript. <Link href="/workspace" className="underline">Back to chat</Link></p>
  </div>;
}
