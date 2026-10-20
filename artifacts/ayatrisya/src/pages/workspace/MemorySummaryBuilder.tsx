import { useMemo, useState } from "react";
import { BookOpenCheck, Search } from "lucide-react";
import { buildMemorySummary } from "@/ai/memory-summary";
import { Button } from "@/components/Primitives";
import { useLocalQuery } from "@/storage/hooks";
import { repository } from "@/storage/repository";

const inputClass = "w-full rounded-lg border border-white/10 bg-[#101116] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-300/15";

export function MemorySummaryBuilder({ onUse }: { onUse: (summary: string) => void }) {
  const query = useLocalQuery(() => repository.listConversations({ limit: 100, pinnedFirst: false }), []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversations = query.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? conversations.filter((conversation) => conversation.title.toLocaleLowerCase().includes(term)) : conversations;
  }, [conversations, search]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length >= 10 ? current : [...current, id]);
    setError("");
  }

  async function build() {
    if (!selected.length) return;
    setBusy(true);
    setError("");
    try {
      const chosen = conversations.filter((conversation) => selected.includes(conversation.id));
      const withMessages = await Promise.all(chosen.map(async (conversation) => ({
        ...conversation,
        messages: await repository.getMessages(conversation.id),
      })));
      const result = buildMemorySummary(withMessages);
      if (!result) {
        setDraft("");
        setError("Those chats do not contain enough text from your messages to draft notes.");
      } else setDraft(result);
    } catch {
      setError("Could not read the selected chats from this browser. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 rounded-xl border border-white/[.07] bg-white/[.018] p-3.5">
    <div className="flex items-start gap-3">
      <BookOpenCheck size={17} className="mt-0.5 shrink-0 text-violet-200/80" />
      <div>
        <h3 className="text-sm font-medium text-slate-200">Build a draft from selected chats</h3>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">Ayatrisya extracts short passages from your own messages on this device. It does not send chats to a model. Review the draft before saving.</p>
      </div>
    </div>
    {query.loading && !query.data ? <p className="mt-3 text-xs text-slate-500" role="status">Loading your chats…</p> :
      query.error ? <p className="mt-3 text-xs text-rose-300" role="alert">{query.error}</p> :
      conversations.length === 0 ? <p className="mt-3 text-xs text-slate-500">Create a chat first, then return here to build a draft.</p> :
      <>
        <label className="relative mt-3 block">
          <span className="sr-only">Search conversations</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find conversations" className={`${inputClass} py-2 pl-9 text-xs`} />
        </label>
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/[.06] p-1.5" role="group" aria-label="Choose chats for memory summary">
          {filtered.map((conversation) => <label key={conversation.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-xs text-slate-300 hover:bg-white/[.04]">
            <input type="checkbox" checked={selected.includes(conversation.id)} disabled={!selected.includes(conversation.id) && selected.length >= 10} onChange={() => toggle(conversation.id)} className="h-3.5 w-3.5 accent-violet-300" />
            <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
            <time className="shrink-0 text-[10px] text-slate-500" dateTime={conversation.updatedAt}>{new Date(conversation.updatedAt).toLocaleDateString()}</time>
          </label>)}
          {!filtered.length && <p className="px-2 py-4 text-center text-xs text-slate-500">No matching conversations.</p>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">{selected.length}/10 chats selected</span>
          <Button variant="outline" disabled={!selected.length || busy} onClick={() => void build()}>{busy ? "Drafting…" : "Build draft"}</Button>
        </div>
      </>}
    {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
    {draft && <div className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/[.035] p-3">
      <label htmlFor="memory-summary-draft" className="text-[11px] font-medium text-violet-100/80">Review the extracted draft</label>
      <textarea id="memory-summary-draft" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2400} rows={5} className={`${inputClass} mt-1.5 resize-y text-xs leading-5`} />
      <div className="mt-2 flex justify-end"><Button onClick={() => onUse(draft)}>Use this draft</Button></div>
    </div>}
  </div>;
}
