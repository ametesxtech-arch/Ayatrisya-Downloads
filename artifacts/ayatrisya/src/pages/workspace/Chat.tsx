import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  Copy,
  FilePlus2,
  Image,
  Paperclip,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button, Eyebrow, IconButton } from '@/components/Primitives';
import { cx } from '@/lib/cx';
import { Mark } from '@/components/Brand';

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

export function ChatPage({
  path,
  goto,
  notify,
}: {
  path: string;
  goto: (href: string) => void;
  notify: (m: string) => void;
}) {
  const [input, setInput] = useState(''),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [thinking, setThinking] = useState(false),
    [attach, setAttach] = useState(false);
  const isWelcome = path === '/workspace';
  function send(value = input) {
    const text = value.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: 'user', text, time: 'Now' }]);
    setInput('');
    setThinking(true);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'This is a deterministic Ayatrisya demo response. The workspace interface is ready to connect to Ayatrisya’s own models in a future phase. For now, no AI request was made.',
          time: 'Just now',
        },
      ]);
      setThinking(false);
    }, 650);
  }
  return (
    <div className="mx-auto flex min-h-full max-w-[900px] flex-col px-4 pb-4 pt-7 sm:px-8 sm:pt-10">
      {isWelcome && messages.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center pb-8">
          <Eyebrow>Session-only demo</Eyebrow>
          <h1 className="display max-w-2xl text-4xl font-semibold leading-tight tracking-[-.06em] sm:text-5xl">
            What are we working on?
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
            Start with a question, a rough thought, or a task you want to make
            clearer. Modes only change this interface.
          </p>
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            {[
              [
                'Shape a project brief',
                'Turn a loose idea into a starting outline.',
              ],
              ['Explore a question', 'Gather the questions worth asking next.'],
              ['Draft a document', 'Find a clear first structure.'],
              ['Plan a small build', 'Break a project into manageable steps.'],
            ].map(([a, b]) => (
              <button
                key={a}
                onClick={() => send(a)}
                className="group rounded-xl border border-white/[.07] bg-[#14161c] p-4 text-left transition hover:border-violet-300/20 hover:bg-[#191b23]"
              >
                <span className="block text-xs font-semibold text-slate-300">
                  {a}
                  <ArrowUpRight
                    size={13}
                    className="ml-2 inline text-slate-600 group-hover:text-violet-200"
                  />
                </span>
                <span className="mt-1 block text-[10px] text-slate-600">
                  {b}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-7 pb-8">
          {messages.length === 0 && (
            <div className="py-10">
              <Eyebrow>Conversation preview</Eyebrow>
              <h1 className="display text-3xl font-semibold tracking-tight">
                Conversation
              </h1>
              <p className="mt-2 text-xs text-slate-500">
                Local demo state · disappears when you leave this page
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <article
              key={`${m.time}-${i}`}
              className={cx(
                'flex gap-3',
                m.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cx(
                  'max-w-[min(90%,680px)] rounded-2xl p-4 text-sm leading-7',
                  m.role === 'user'
                    ? 'bg-[#242631] text-slate-100'
                    : 'border border-white/[.07] bg-[#15171e] text-slate-300',
                )}
              >
                <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-slate-500">
                  {m.role === 'assistant' ? (
                    <>
                      <Mark small />
                      Ayatrisya{' '}
                      <span className="rounded border border-violet-300/15 px-1.5 py-0.5 text-[8px] text-violet-200">
                        DEMO
                      </span>
                    </>
                  ) : (
                    'You'
                  )}
                  <span className="font-normal normal-case tracking-normal">
                    {m.time}
                  </span>
                </div>
                {m.text}
                {m.role === 'assistant' && (
                  <div className="mt-3 flex gap-1 border-t border-white/[.06] pt-2">
                    <IconButton
                      label="Copy demo response"
                      onClick={() => {
                        void navigator.clipboard?.writeText(m.text);
                        notify('Demo response copied.');
                      }}
                    >
                      <Copy size={14} />
                    </IconButton>
                    <IconButton
                      label="Regenerate demo response"
                      onClick={() =>
                        notify(
                          'Regeneration is unavailable: this response is a fixed demo.',
                        )
                      }
                    >
                      <Activity size={14} />
                    </IconButton>
                    <IconButton
                      label="Give positive feedback"
                      onClick={() =>
                        notify('Feedback controls are a preview only.')
                      }
                    >
                      <Check size={14} />
                    </IconButton>
                  </div>
                )}
              </div>
            </article>
          ))}
          {thinking && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-[#15171e] p-4 text-xs text-slate-400"
            >
              <span className="flex gap-1">
                <i className="size-1.5 animate-pulse rounded-full bg-violet-300" />
                <i className="size-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:150ms]" />
                <i className="size-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:300ms]" />
              </span>
              Preparing demo response…
            </div>
          )}
        </div>
      )}
      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-[#101116] via-[#101116] to-transparent pb-1 pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="rounded-xl border border-white/[.11] bg-[#171920] shadow-lg focus-within:border-violet-300/25"
        >
          <label className="sr-only" htmlFor="chat-input">
            Message Ayatrisya demo
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything… (Shift + Enter for a new line)"
            rows={2}
            className="max-h-40 min-h-[58px] w-full resize-y bg-transparent px-4 pt-4 text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />
          <div className="flex items-center justify-between border-t border-white/[.06] px-3 py-2">
            <div className="flex items-center gap-1">
              <IconButton
                label="Attach file (preview)"
                onClick={() => setAttach(!attach)}
              >
                <Paperclip size={15} />
              </IconButton>
              <IconButton
                label="Open image studio"
                onClick={() => goto('/workspace/images')}
              >
                <Image size={15} />
              </IconButton>
              <IconButton
                label="Create document"
                onClick={() => goto('/workspace/documents')}
              >
                <FilePlus2 size={15} />
              </IconButton>
              <span className="hidden pl-2 text-[9px] text-slate-600 sm:inline">
                No file uploads in this preview
              </span>
            </div>
            <Button
              type="submit"
              className="min-h-8 px-3 text-xs"
              disabled={!input.trim() || thinking}
            >
              <Send size={13} />
              Send
            </Button>
          </div>
        </form>
        {attach && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-white/[.07] bg-[#171920] p-3 text-[11px] text-slate-400">
            File attachment is not available in this UI preview.
            <button
              onClick={() => setAttach(false)}
              className="text-slate-500 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-center gap-2 text-[9px] text-slate-600">
          <Sparkles size={11} /> Demo mode · no AI service · conversations are
          not saved
        </div>
      </div>
    </div>
  );
}
