import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import ReactMarkdown from 'react-markdown';
import { ArrowDown, Check, Copy, RefreshCw, MoreHorizontal, Mic, Paperclip, Pencil, Send, Square, Trash2, X } from 'lucide-react';
import { Button, ConfirmDialog, IconButton, Modal, Notice, Skeleton, LoadError } from '@/components/Primitives';
import { AttachmentChip } from '@/components/AttachmentPreview';
import { repository } from '@/storage/repository';
import { useLocalQuery } from '@/storage/hooks';
import { modelClient } from '@/ai/client';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import { MAX_UPLOAD, ago, errMsg, formatBytes } from '@/lib/format';
import { ActionMenu } from '@/components/Menus';
import { useConvActions } from '@/hooks/use-conv-actions';
import type { Message } from '@/storage/types';

function nodeText(n: ReactNode): string { if (typeof n === 'string' || typeof n === 'number') return String(n); if (Array.isArray(n)) return n.map(nodeText).join(''); if (n && typeof n === 'object' && 'props' in n) return nodeText((n as { props: { children?: ReactNode } }).props.children); return ''; }
function CodeBlock({ children }: { children?: ReactNode }) {
  const [ok, setOk] = useState(false);
  const text = nodeText(children).replace(/\n$/, '');
  return <div className="group relative"><button type="button" aria-label={ok ? 'Code copied' : 'Copy code'} onClick={() => navigator.clipboard.writeText(text).then(() => { setOk(true); window.setTimeout(() => setOk(false), 1800); }, () => undefined)} className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-white/10 bg-[#101116] px-2 py-1 text-[11px] text-slate-300 hover:text-white">{ok ? <Check size={12} /> : <Copy size={12} />}{ok ? 'Copied' : 'Copy'}</button><pre>{children}</pre></div>;
}
const mdComponents = { pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock> };
type Turn = Array<{ role: 'user' | 'assistant'; content: string }>;
const starters = ['Help me outline a project plan', 'Summarise my notes into key decisions', 'Explain this concept simply', 'Review this paragraph for clarity'];

export function ChatPage({ path, goto, notify }: { path: string; goto: (h: string) => void; notify: (m: string) => void }) {
  const id = path.startsWith('/workspace/chat/') ? path.split('/')[3] : null;
  const { prefs } = usePrefs();
  const studioWidth = prefs.workspaceMode === 'studio';
  const { caps } = useCaps();
  const uid = useAuth().user?.uid ?? 'signed-out';
  const savingRef = useRef(false), runningRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const cap = caps.find((c) => c.id === prefs.model);
  const available = !!cap?.available;
  const msgs = useLocalQuery<Message[]>(() => (id ? repository.getMessages(id) : Promise.resolve([])), [id]);
  const conv = useLocalQuery(() => (id ? repository.getConversation(id) : Promise.resolve(undefined)), [id]);
  const atts = useLocalQuery(() => repository.listAttachments(), []);
  const [text, setText] = useState(''), [files, setFiles] = useState<File[]>([]), [busy, setBusy] = useState(false), [stream, setStream] = useState(''), [streamFor, setStreamFor] = useState<string | null>(null), [error, setError] = useState('');
  const [consent, setConsent] = useState(false), [ask, setAsk] = useState<{ cid: string; history: Turn; after?: () => Promise<void> } | null>(null), [remember, setRemember] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null), [confirmDel, setConfirmDel] = useState(false), [renaming, setRenaming] = useState<string | null>(null), [delMsg, setDelMsg] = useState<Message | null>(null), [resubmit, setResubmit] = useState<{ m: Message; text: string } | null>(null), [copied, setCopied] = useState<string | null>(null), [atBottom, setAtBottom] = useState(true);
  const acts = useConvActions({ notify, goto, onDeleted: () => goto('/workspace') });
  const abortRef = useRef<AbortController | null>(null), retryRef = useRef<{ cid: string; history: Turn } | null>(null), endRef = useRef<HTMLDivElement>(null), fileRef = useRef<HTMLInputElement>(null), taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => { abortRef.current?.abort(); modelClient.cancelGeneration(); }, [uid]);
  const list = msgs.data ?? [];
  useEffect(() => {
    const main = document.getElementById('main'); if (!main) return;
    const f = () => setAtBottom(main.scrollHeight - main.scrollTop - main.clientHeight < 120);
    f(); main.addEventListener('scroll', f, { passive: true });
    return () => main.removeEventListener('scroll', f);
  }, []);
  const atBottomRef = useRef(true); atBottomRef.current = atBottom;
  useEffect(() => { if (atBottomRef.current) endRef.current?.scrollIntoView({ block: 'end' }); }, [list.length, stream]);
  useEffect(() => {
    const t = taRef.current; if (!t) return;
    const fit = () => { t.style.height = 'auto'; t.style.height = `${Math.min(Math.max(t.scrollHeight, 36), 200)}px`; };
    fit();
    window.addEventListener('resize', fit);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(t.parentElement!);
    return () => { window.removeEventListener('resize', fit); ro?.disconnect(); };
  }, [text]);

  async function run(cid: string, history: Turn) {
    if (runningRef.current) return;
    runningRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac; retryRef.current = { cid, history };
    setBusy(true); setStreamFor(cid); setStream(''); setError('');
    try {
      const out = await modelClient.generateResponse(history, { model: prefs.model, mode: prefs.mode, signal: ac.signal, onToken: (t: string) => setStream((s) => s + t) });
      if (out.trim() && !ac.signal.aborted) await repository.addMessage(cid, out, 'assistant');
      retryRef.current = null;
    } catch (e) { setError(ac.signal.aborted ? 'Generation stopped. Your message is saved.' : errMsg(e, 'The model request failed.')); }
    finally { runningRef.current = false; setBusy(false); setStream(''); setStreamFor(null); abortRef.current = null; }
  }
  function stop() { abortRef.current?.abort(); modelClient.cancelGeneration(); }

  async function send() {
    const body = text.trim();
    if ((!body && !files.length) || busy || ask || savingRef.current || runningRef.current) return;
    savingRef.current = true; setSaving(true);
    setError('');
    try {
      let cid = id;
      if (!cid) cid = (await repository.createConversation((body || files[0].name).slice(0, 48))).id;
      const ids: string[] = [];
      for (const f of files) ids.push((await repository.addFile(f, null, cid)).id);
      const content = body || `Attached: ${files.map((f) => f.name).join(', ')}`;
      await repository.addMessage(cid, content, 'user', ids);
      const history: Turn = [...list.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content }];
      setText(''); setFiles([]);
      if (!id) goto(`/workspace/chat/${cid}`);
      if (available) { if (consent) void run(cid, history); else setAsk({ cid, history }); }
    } catch (e) { setError(errMsg(e, 'Could not save your message locally.')); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function pick(fl: FileList | null) {
    const ok: File[] = [];
    for (const f of Array.from(fl ?? [])) { if (f.size > MAX_UPLOAD) notify(`${f.name} is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_UPLOAD)}.`); else ok.push(f); }
    setFiles((p) => [...p, ...ok]); if (fileRef.current) fileRef.current.value = '';
  }
  const attMap = new Map((atts.data ?? []).map((a) => [a.id, a]));
  const lastUserUnanswered = (m: Message, i: number) => m.role === 'user' && !list.slice(i + 1).some((x) => x.role === 'assistant');

  return <div className="flex h-full min-h-0 flex-col">
    {id && <div className="flex items-center justify-end gap-1 border-b border-white/[.05] px-4 py-2 text-xs text-slate-500">
      <span className="mr-auto truncate">Saved in this browser{conv.data ? ` · started ${ago(conv.data.createdAt)}` : ''}</span>
      <Button variant="quiet" onClick={() => setRenaming(conv.data?.title ?? '')}><Pencil size={13} />Rename</Button>
      <Button variant="quiet" onClick={() => setConfirmDel(true)}><Trash2 size={13} />Delete</Button>
      {conv.data && <ActionMenu label="More conversation actions" items={acts.items(conv.data)}><MoreHorizontal size={15} /></ActionMenu>}
    </div>}
    <div className={`mx-auto w-full ${studioWidth ? 'max-w-[1100px]' : 'max-w-[820px]'} flex-1 px-4 py-6 sm:px-6`}>
      {id && msgs.loading && !msgs.data && <div className="space-y-4"><Skeleton className="h-16 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /></div>}
      {msgs.error && <LoadError message={msgs.error} retry={msgs.refresh} />}
      {id && conv.data === undefined && !conv.loading && !conv.error && <Notice>This conversation was not found in this browser. <Link href="/workspace" className="underline">Start a new chat</Link>.</Notice>}
      {(!id || (msgs.data && list.length === 0)) && <div className="reveal py-8 sm:py-16">
        <h2 className="display text-3xl font-semibold tracking-[-.05em] sm:text-4xl">{prefs.displayName ? `Welcome back, ${prefs.displayName}.` : 'What are you working on?'}</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">Your messages are saved in this browser as you send them. Replies only appear when an Ayatrisya model connection is configured.</p>
        {!available && <div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-sm text-amber-100/90" data-testid="status-model-unavailable"><b>{prefs.model === 'v1-fast' ? 'V1 Fast' : 'V2 Best Result'} is unavailable.</b> {cap?.reason ?? 'No model connection is configured for this deployment.'} You can still write and save messages and drafts.<div className="mt-2"><Link href="/workspace/settings" className="underline">Model status in Settings</Link></div></div>}
        <div className="mt-8 flex flex-wrap gap-2">{starters.map((s) => <button key={s} onClick={() => { setText(s); taRef.current?.focus(); }} className="rounded-full border border-white/10 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/[.06]">{s}</button>)}</div>
      </div>}
      <ul className="space-y-5">
        {list.map((m, i) => <li key={m.id} className={m.role === 'user' ? 'flex flex-col items-end' : ''} data-testid={`message-${m.id}`}>
          {editing?.id === m.id ? <div className="w-full"><label className="sr-only" htmlFor="edit-msg">Edit message</label><textarea id="edit-msg" data-autofocus value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} className="min-h-24 w-full rounded-lg border border-white/10 bg-[#101116] p-3 text-sm" />
            <div className="mt-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={async () => { try { await repository.editMessage(m.id, editing.text); setEditing(null); } catch (e) { notify(errMsg(e)); } }}>Save edit</Button><Button disabled={!available || busy || !editing.text.trim()} title={available ? undefined : 'Resubmitting needs a connected model'} onClick={() => setResubmit({ m, text: editing.text })}>{available ? 'Save and resubmit' : 'Resubmit unavailable'}</Button></div></div>
            : <div className={m.role === 'user' ? 'max-w-[88%] rounded-2xl rounded-br-md border border-violet-300/15 bg-violet-400/[.1] px-4 py-3' : 'w-full'}>
              {m.role === 'assistant' ? <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{m.content}</p>}
              {m.attachmentIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.attachmentIds.map((a) => attMap.get(a) && <AttachmentChip key={a} attachment={attMap.get(a)!} />)}</div>}
            </div>}
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            {m.role === 'user' && lastUserUnanswered(m, i) && !busy && <span data-testid="status-not-sent">{available ? 'No reply recorded' : 'Saved locally, not sent to any model'}</span>}
            <IconButton label={copied === m.id ? 'Copied' : 'Copy message'} onClick={() => navigator.clipboard.writeText(m.content).then(() => { setCopied(m.id); window.setTimeout(() => setCopied(null), 1600); }, () => notify('Copy was blocked by the browser.'))}>{copied === m.id ? <Check size={13} className="text-teal-300" /> : <Copy size={13} />}</IconButton>
            {m.role === 'user' && <IconButton label="Edit message" onClick={() => setEditing({ id: m.id, text: m.content })}><Pencil size={13} /></IconButton>}
            {m.role === 'assistant' && i === list.length - 1 && <button type="button" disabled={!available || busy} title={available ? 'Regenerate this reply' : 'Regeneration needs a connected model'} aria-label={available ? 'Regenerate reply' : 'Regenerate unavailable: no model connected'} onClick={() => { const history: Turn = list.slice(0, i).map((x) => ({ role: x.role, content: x.content })); const go = async () => { try { await repository.deleteMessage(m.id); void run(id!, history); } catch (e) { notify(errMsg(e)); } }; if (consent) void go(); else setAsk({ cid: id!, history, after: go }); }} className="grid size-8 place-items-center rounded-lg hover:bg-white/[.07] disabled:opacity-40"><RefreshCw size={13} /></button>}
            <IconButton label="Delete message" onClick={() => setDelMsg(m)}><Trash2 size={13} /></IconButton>
          </div>
        </li>)}
        {streamFor === id && busy && <li><div className="prose prose-invert prose-sm max-w-none" aria-live="polite">{stream ? <ReactMarkdown components={mdComponents}>{stream}</ReactMarkdown> : <p className="flex items-center gap-2 text-slate-400" role="status"><span className="flex gap-1" aria-hidden><i className="pend-dot" /><i className="pend-dot" style={{ animationDelay: '.15s' }} /><i className="pend-dot" style={{ animationDelay: '.3s' }} /></span>Waiting for the model. Nothing has been received yet.</p>}</div></li>}
      </ul>
      {error && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-rose-400/20 bg-rose-400/[.06] p-3 text-sm text-rose-200">{error}{retryRef.current && !busy && <Button variant="outline" onClick={() => retryRef.current && (consent ? void run(retryRef.current.cid, retryRef.current.history) : setAsk(retryRef.current))}>Retry</Button>}</div>}
      <div ref={endRef} />
    </div>
    <div className="safe-b sticky bottom-0 border-t border-white/[.06] bg-[#101116]/95 px-3 pt-3 backdrop-blur sm:px-6">
      <div className={`mx-auto ${studioWidth ? 'max-w-[1100px]' : 'max-w-[820px]'}`}>
        {id && !available && <p className="mb-2 text-[11px] text-amber-200/80">Model unavailable. New messages are saved locally and not sent.</p>}
        {files.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{files.map((f, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-[11px]"><Paperclip size={11} />{f.name} · {formatBytes(f.size)}<button aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button></span>)}<span className="self-center text-[11px] text-slate-500">Attachments stay in this browser and are never sent to a model.</span></div>}
        <div className="flex items-end gap-1 rounded-2xl border border-white/10 bg-[#171920] p-2 focus-within:border-violet-400/40">
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => pick(e.target.files)} />
          <IconButton label="Attach files (stored locally)" onClick={() => fileRef.current?.click()}><Paperclip size={17} /></IconButton>
          <label className="sr-only" htmlFor="composer">Message</label>
          <textarea id="composer" ref={taRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && (prefs.enterToSend ? !e.shiftKey : (e.ctrlKey || e.metaKey))) { e.preventDefault(); void send(); } }} placeholder="Write a message" className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-slate-500 focus:outline-none" data-testid="input-message" aria-describedby="composer-hint" />
          <Link href="/workspace/voice" aria-label="Open voice studio" title="Voice studio" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[.07] hover:text-white"><Mic size={17} /></Link>
          {busy ? <button onClick={stop} aria-label="Stop generation" className="grid size-9 place-items-center rounded-lg bg-rose-500 text-white"><Square size={15} /></button>
            : <button onClick={() => void send()} disabled={saving || !!ask || (!text.trim() && !files.length)} aria-label="Send message" className="grid size-9 place-items-center rounded-lg bg-violet-500 text-white disabled:opacity-40" data-testid="button-send"><Send size={16} /></button>}
        </div>
        <p id="composer-hint" className="px-2 pb-2 pt-1 text-[11px] text-slate-500" aria-live="polite">{saving ? (files.length ? `Saving ${files.length} file${files.length > 1 ? 's' : ''} and your message to this browser…` : 'Saving to this browser…') : prefs.enterToSend ? 'Enter to send, Shift+Enter for a new line.' : 'Ctrl+Enter to send, Enter for a new line.'}</p>
      </div>
      {!atBottom && <button onClick={() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })} aria-label="Scroll to latest message" className="fixed bottom-28 right-5 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-[#20232c] text-slate-200 shadow-xl"><ArrowDown size={16} /></button>}
    </div>
    {acts.dialogs}
    {delMsg && <ConfirmDialog danger title="Delete message" confirmLabel="Delete message" body="Delete this message from the conversation? Files attached to it stay in your Library. This cannot be undone." onConfirm={async () => { try { await repository.deleteMessage(delMsg.id); } catch (e) { notify(errMsg(e)); } setDelMsg(null); }} onClose={() => setDelMsg(null)} />}
    {resubmit && id && <ConfirmDialog title="Save and resubmit" confirmLabel="Resubmit" body="Saving this edit will delete every later message in the conversation, then ask the model for a new reply. This cannot be undone." onConfirm={async () => { const { m, text: t } = resubmit; setResubmit(null); setEditing(null); try { await repository.editMessage(m.id, t); const idx = list.findIndex((x) => x.id === m.id); for (const later of list.slice(idx + 1)) await repository.deleteMessage(later.id); const history: Turn = [...list.slice(0, idx).map((x) => ({ role: x.role, content: x.content })), { role: 'user', content: t }]; if (consent) void run(id, history); else setAsk({ cid: id, history }); } catch (e) { notify(errMsg(e)); } }} onClose={() => setResubmit(null)} />}
    {ask && <Modal title="Send to the model server?" onClose={() => setAsk(null)}>
      <p className="text-sm leading-6 text-slate-400">Your conversation text will be sent to the configured Ayatrisya model server to produce a reply. Attachments are not sent. Your message is already saved locally either way.</p>
      <label className="mt-4 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-violet-500" />Do not ask again until I reload this page</label>
      <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setAsk(null)}>Keep local only</Button><Button onClick={() => { const a = ask; setAsk(null); if (remember) setConsent(true); if (a.after) void a.after(); else void run(a.cid, a.history); }}>Send</Button></div>
    </Modal>}
    {confirmDel && id && <ConfirmDialog danger title="Delete conversation" confirmLabel="Delete" body="Delete this conversation and its messages and attachments from this browser? This cannot be undone." onConfirm={async () => { try { await repository.deleteConversation(id); goto('/workspace'); } catch (e) { notify(errMsg(e)); setConfirmDel(false); } }} onClose={() => setConfirmDel(false)} />}
    {renaming !== null && id && <Modal title="Rename conversation" onClose={() => setRenaming(null)}><form onSubmit={async (e) => { e.preventDefault(); if (!renaming.trim()) return; try { await repository.renameConversation(id, renaming.trim()); setRenaming(null); } catch (er) { notify(errMsg(er)); } }}><input data-autofocus aria-label="Conversation title" value={renaming} onChange={(e) => setRenaming(e.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit">Save</Button></div></form></Modal>}
  </div>;
}
