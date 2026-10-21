import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Image, MessageSquare, Plus } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { useLocalQuery } from '@/storage/hooks';
import { repository } from '@/storage/repository';

export function GuestWorkspace({ children, path, onNewChat, creating }: { children: ReactNode; path: string; onNewChat: () => void; creating: boolean }) {
  const chats = useLocalQuery(() => repository.listConversations({ limit: 20, sort: 'newest' }), []);
  const activeChat = path === '/workspace/chat' || path.startsWith('/workspace/chat/');
  return <div className="guest-workspace app-noise flex h-[100dvh] min-h-0 overflow-hidden bg-[#101116] text-slate-100">
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-white/[.065] bg-[#12141a] p-4 lg:flex">
      <Link href="/workspace/chat" aria-label="Ayatrisya guest workspace"><Brand compact /></Link>
      <button type="button" onClick={onNewChat} disabled={creating} className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-300 px-3 text-xs font-bold text-[#171523] disabled:opacity-50"><Plus size={15} />New chat</button>
      <nav className="mt-4 space-y-1" aria-label="Guest workspace">
        <Link href="/workspace/chat" aria-current={activeChat ? 'page' : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-xs ${activeChat ? 'bg-violet-300/[.1] text-violet-100' : 'text-slate-400 hover:bg-white/[.04]'}`}><MessageSquare size={15} />Chat</Link>
        <Link href="/workspace/images" aria-current={path === '/workspace/images' ? 'page' : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-xs ${path === '/workspace/images' ? 'bg-violet-300/[.1] text-violet-100' : 'text-slate-400 hover:bg-white/[.04]'}`}><Image size={15} />Image generation</Link>
      </nav>
      <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.17em] text-slate-500">Your chats</p>
        {chats.data?.map((chat) => <Link key={chat.id} href={`/workspace/chat/${chat.id}`} className={`block truncate rounded-md px-2 py-2 text-xs hover:bg-white/[.04] ${path.endsWith(chat.id) ? 'text-violet-100' : 'text-slate-400'}`}>{chat.title || 'New chat'}</Link>)}
        {!chats.loading && !chats.data?.length && <p className="px-2 text-[11px] leading-5 text-slate-500">Chats you start will appear here.</p>}
      </div>
      <div className="border-t border-white/[.06] pt-4">
        <p className="px-2 text-[11px] leading-5 text-slate-500">Guest access · unlimited chats · 2 images</p>
        <Link href="/auth/create-account" className="mt-3 flex h-10 items-center justify-center rounded-lg border border-violet-300/20 text-xs font-semibold text-violet-100 hover:bg-violet-300/[.06]">Create an account</Link>
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="safe-t flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-b border-white/[.06] px-4 sm:px-6">
        <div className="lg:hidden"><Brand compact /></div>
        <span className="hidden truncate text-[13px] font-medium text-slate-200 lg:block">{path === '/workspace/images' ? 'Image generation' : 'Chat'}</span>
        <Link href="/auth/create-account" className="ml-auto rounded-lg border border-violet-300/20 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-300/[.06]">Create account</Link>
      </header>
      <nav className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/[.06] px-3 py-2 lg:hidden" aria-label="Guest workspace">
        <Link href="/workspace/chat" className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs ${activeChat ? 'bg-violet-300/[.1] text-violet-100' : 'text-slate-400'}`}><MessageSquare size={14} />Chat</Link>
        <button type="button" data-testid="guest-new-chat" onClick={onNewChat} disabled={creating} className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 disabled:opacity-50"><Plus size={14} />New</button>
        <Link href="/workspace/images" className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs ${path === '/workspace/images' ? 'bg-violet-300/[.1] text-violet-100' : 'text-slate-400'}`}><Image size={14} />Images · 2</Link>
        {(chats.data ?? []).slice(0, 8).map((chat) => <Link key={chat.id} href={`/workspace/chat/${chat.id}`} className={`max-w-36 shrink-0 truncate rounded-lg px-3 py-2 text-xs ${path.endsWith(chat.id) ? 'text-violet-100' : 'text-slate-500'}`}>{chat.title || 'Chat'}</Link>)}
      </nav>
      <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none">{children}</main>
    </div>
  </div>;
}
