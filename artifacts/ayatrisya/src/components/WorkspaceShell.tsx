import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Box, Code2, Command as CommandIcon, FileText, History as HistoryIcon, Home, MoreHorizontal, Pin, UserRound, FolderKanban, HardDrive, Image, Library, Menu, MessageSquare, Mic, Music2,
  PanelLeftClose, PanelLeftOpen, Plus, Presentation, Search, Settings, StickyNote, X,
} from 'lucide-react';
import { Button, IconButton } from '@/components/Primitives';
import { Palette, type Command } from '@/components/Palette';
import { ActionMenu, useContextMenu, type MenuItem } from '@/components/Menus';
import { useConvActions } from '@/hooks/use-conv-actions';
import { pushNotice } from '@/lib/notify';
import { exportBackup, downloadBlob } from '@/storage/backup';
import { tools } from '@/data/nav';
import { confirmDiscard } from '@/lib/dirty';
import { errMsg } from '@/lib/format';
import { cx } from '@/lib/cx';
import { Brand } from '@/components/Brand';
import { NoticeHost } from '@/components/Toast';
import { FeaturePage } from '@/pages/workspace/FeaturePage';
import { useCaps, usePrefs } from '@/hooks/use-prefs';
import { useLocalQuery } from '@/storage/hooks';
import { repository } from '@/storage/repository';
import { useAuth } from '@/integrations/firebase/AuthProvider';
import type { ChatMode, ModelId, WorkspaceMode } from '@/storage/types';
import { WorkspaceHome } from '@/pages/workspace/WorkspaceHome';
import { GuestWorkspace } from '@/components/GuestWorkspace';
import { MotionText } from '@/components/MotionText';

const modelNames: Record<ModelId, string> = { 'v1-fast': 'V1 Fast', 'v2-best': 'V2 Best Result' };
const workspaceModeNames: Record<WorkspaceMode, string> = {
  standard: 'Standard', focus: 'Focus', studio: 'Studio', developer: 'Developer', compact: 'Compact',
};

export function Workspace() {
  return <WorkspaceContent />;
}

function WorkspaceContent() {
  const [path, setPath] = useLocation();
  const { prefs, save } = usePrefs();
  const { caps } = useCaps();
  const { user, guest, signOut } = useAuth();
  const collapsed = prefs.sidebarCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false), [dialog, setDialog] = useState(''), [chatSearch, setChatSearch] = useState(''), [chatPage, setChatPage] = useState(0);
  const menuBtn = useRef<HTMLButtonElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  const convs = useLocalQuery(() => repository.listConversations({ limit: 31, offset: chatPage * 30, search: chatSearch || undefined }), [chatSearch, chatPage]);
  const stats = useLocalQuery(() => repository.stats(), []);
  const homeProjects = useLocalQuery(() => repository.listProjects({ archived: false, limit: 8 }), []);
  const homeConversations = useLocalQuery(() => repository.listConversations({ archived: false, limit: 10, sort: 'newest' }), []);
  const homeItems = useLocalQuery(() => repository.listItems({ limit: 10, sort: 'date' }), []);
  const chatId = path.startsWith('/workspace/chat/') ? path.split('/')[3] : null;
  const current = useLocalQuery(() => (chatId ? repository.getConversation(chatId) : Promise.resolve(undefined)), [chatId]);
  const title = chatId ? (current.data?.title ?? 'Conversation') : (tools.find((t) => t.href === path)?.name ?? (path.startsWith('/workspace/projects/') ? 'Project' : path.startsWith('/workspace/documents/') ? 'Document' : path.includes('account') ? 'Account' : 'Workspace'));

  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = pageRef.current; if (!el) return; el.classList.remove('route-in'); void el.offsetWidth; el.classList.add('route-in'); }, [path]);
  const gotoRef = useRef<(h: string) => void>(() => undefined);
  const newChatRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const t = e.target as HTMLElement | null;
      const editing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const modal = !!document.querySelector('[role="dialog"][aria-modal="true"]');
      if (e.key === 'Escape') setMobileOpen(false);
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k') { e.preventDefault(); setDialog('palette'); return; }
      if (editing || modal) return;
      if (k === 'n' && e.shiftKey) { e.preventDefault(); gotoRef.current('/workspace/projects?new=1'); }
      else if (k === 'n') { e.preventDefault(); void newChatRef.current(); }
      else if (e.key === ',') { e.preventDefault(); gotoRef.current('/workspace/settings'); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const asideRef = useRef<HTMLElement>(null), mainRef = useRef<HTMLDivElement>(null), wasOpen = useRef(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [creating, setCreating] = useState(false);

  // Prevent scroll drift / canvas going up on route change
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [path]);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const f = () => setIsMobile(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    if (!asideRef.current || !mainRef.current) return;
    const hide = isMobile && !mobileOpen;
    (asideRef.current as (HTMLElement & { inert: boolean }) | null)!.inert = hide;
    (mainRef.current as (HTMLElement & { inert: boolean }) | null)!.inert = isMobile && mobileOpen;
    if (mobileOpen) { wasOpen.current = true; closeBtn.current?.focus(); }
    else if (wasOpen.current) { wasOpen.current = false; menuBtn.current?.focus(); }
  }, [mobileOpen, isMobile]);
  function trap(e: React.KeyboardEvent) {
    if (!(isMobile && mobileOpen) || e.key !== 'Tab') return;
    const f = Array.from(asideRef.current!.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea')).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  async function newChat() {
    if (creating || !confirmDiscard()) return;
    setCreating(true);
    try { const c = await repository.createConversation("New conversation", prefs.mode); setChatPage(0); setPath(`/workspace/chat/${c.id}`); setMobileOpen(false); setDialog(''); }
    catch (e) { notify(`Could not create a conversation: ${errMsg(e)}`); } finally { setCreating(false); }
  }
  async function createDocument() {
    if (!confirmDiscard()) return;
    try {
      const item = await repository.saveItem({ title: 'Untitled document', kind: 'document', content: '', projectId: null, tags: [] });
      setPath(`/workspace/documents/${item.id}`);
      setMobileOpen(false);
      setDialog('');
    } catch (e) { notify(`Could not create a document: ${errMsg(e)}`); }
  }
  function homeAction(action: 'new-chat' | 'new-project' | 'create-document' | 'library' | 'projects' | 'image-studio' | 'voice-studio' | 'coding' | 'search') {
    if (action === 'new-chat') { void newChat(); return; }
    if (action === 'new-project') { goto('/workspace/projects?new=1'); return; }
    if (action === 'create-document') { void createDocument(); return; }
    if (action === 'search') { setDialog('palette'); return; }
    const destinations = {
      library: '/workspace/library',
      projects: '/workspace/projects',
      'image-studio': '/workspace/images',
      'voice-studio': '/workspace/voice',
      coding: '/workspace/coding',
    } as const;
    goto(destinations[action]);
  }
  const notify = (m: string) => pushNotice(m);
  const goto = (href: string) => { if (!confirmDiscard()) return; setPath(href); setDialog(''); setMobileOpen(false); };
  gotoRef.current = goto;
  newChatRef.current = newChat;
  const acts = useConvActions({ notify, goto, onDeleted: (ids) => { if (chatId && ids.includes(chatId)) setPath('/workspace'); } });
  const ctx = useContextMenu();
  const toggleTheme = () => save({ theme: prefs.theme === 'Light' ? 'Dark' : 'Light' });
  if (guest) return <GuestWorkspace path={path} onNewChat={() => void newChat()} creating={creating}>
    <FeaturePage path={path} goto={goto} notify={notify} />
  </GuestWorkspace>;
  const isChat = path === '/workspace/chat' || path.startsWith('/workspace/chat/');
  const isCoding = path === '/workspace/coding';
  const isCanvas = path === '/workspace/canvas' || path.startsWith('/workspace/canvas/');
  const isFullViewport = isChat || isCoding || isCanvas;
  const commands: Command[] = [
    { id: 'home', category: 'Navigate', keywords: ['dashboard', 'overview'], label: 'Open workspace home', run: () => goto('/workspace') },
    { id: 'chat', category: 'Create', keywords: ['conversation'], label: 'New chat', hint: 'Ctrl N', run: () => void newChat() },
    { id: 'project', category: 'Create', keywords: ['workspace'], label: 'New project', hint: 'Ctrl Shift N', run: () => goto('/workspace/projects?new=1') },
    { id: 'document', category: 'Create', keywords: ['writing', 'page'], label: 'Create document', run: () => void createDocument() },
    { id: 'research', category: 'Navigate', keywords: ['notes', 'findings'], label: 'Open research notes', run: () => goto('/workspace/research') },
    { id: 'presentations', category: 'Navigate', keywords: ['slides'], label: 'Open presentations', run: () => goto('/workspace/presentations') },
    { id: 'coding', category: 'Navigate', keywords: ['developer'], label: 'Open coding workspace', run: () => goto('/workspace/coding') },
    { id: 'images', category: 'Navigate', keywords: ['visual', 'image studio'], label: 'Open Image Studio', run: () => goto('/workspace/images') },
    { id: 'voice', category: 'Navigate', keywords: ['audio', 'record'], label: 'Open Voice Studio', run: () => goto('/workspace/voice') },
    { id: 'history', category: 'Navigate', keywords: ['conversations'], label: 'Open conversation history', run: () => goto('/workspace/history') },
    { id: 'library', category: 'Navigate', keywords: ['files', 'items'], label: 'Open library', run: () => goto('/workspace/library') },
    { id: 'settings', category: 'Workspace', keywords: ['preferences'], label: 'Open settings', hint: 'Ctrl ,', run: () => goto('/workspace/settings') },
    { id: 'storage', category: 'Workspace', keywords: ['backup', 'local data'], label: 'Open storage and backup', run: () => goto('/workspace/storage') },
    { id: 'account', category: 'Workspace', keywords: ['profile', 'sign in'], label: 'Open account', run: () => goto('/workspace/account') },
    { id: 'focus-mode', category: 'Workspace mode', keywords: ['focus', 'distraction free'], label: 'Switch to Focus mode', run: () => void save({ workspaceMode: 'focus' }) },
    { id: 'studio-mode', category: 'Workspace mode', keywords: ['wide', 'canvas'], label: 'Switch to Studio mode', run: () => void save({ workspaceMode: 'studio' }) },
    { id: 'developer-mode', category: 'Workspace mode', keywords: ['diagnostics'], label: 'Switch to Developer mode', run: () => void save({ workspaceMode: 'developer' }) },
    { id: 'compact-mode', category: 'Workspace mode', keywords: ['dense'], label: 'Switch to Compact mode', run: () => void save({ workspaceMode: 'compact' }) },
    { id: 'standard-mode', category: 'Workspace mode', keywords: ['default'], label: 'Switch to Standard mode', run: () => void save({ workspaceMode: 'standard' }) },
    { id: 'sidebar', category: 'Workspace', keywords: ['navigation'], label: collapsed ? 'Expand sidebar' : 'Collapse sidebar', run: () => void save({ sidebarCollapsed: !collapsed }) },
    { id: 'theme', category: 'Appearance', keywords: ['light', 'dark'], label: prefs.theme === 'Light' ? 'Switch to dark theme' : 'Switch to light theme', run: () => void toggleTheme() },
    { id: 'export', category: 'Data', keywords: ['backup', 'download'], label: 'Export full backup (JSON)', run: () => { exportBackup().then((b) => { downloadBlob(b, `ayatrisya-backup-${new Date().toISOString().slice(0, 10)}.json`); notify('Backup downloaded. It is unencrypted and contains private data.'); }, (e) => notify(errMsg(e))); } },
  ];
  const recordCommand = async (id: string): Promise<void> => {
    await save({ recentCommands: [id, ...prefs.recentCommands.filter((item) => item !== id)].slice(0, 5) });
  };
  const profileItems: MenuItem[] = [
    { label: 'Account', onSelect: () => goto('/workspace/account') },
    { label: 'Settings', onSelect: () => goto('/workspace/settings') },
    { label: 'Storage and backup', onSelect: () => goto('/workspace/storage') },
    { label: prefs.theme === 'Light' ? 'Dark theme' : 'Light theme', onSelect: () => void toggleTheme() },
    ...(user ? [{ label: 'Sign out', danger: true, onSelect: () => { signOut().then(() => { notify('Signed out.'); goto('/auth/sign-in'); }, (e) => notify(errMsg(e))); } }] : []),
  ];
  const capFor = (id: ModelId) => caps.find((c) => c.id === id);
  const selectedCap = capFor(prefs.model);
  const anyReady = caps.some((c) => c.available);
  const L = (href: string, active: boolean, icon: ReactNode, label: string) => <SideLink href={href} active={active} icon={icon} label={label} collapsed={collapsed} onSelect={() => setMobileOpen(false)} />;
  const initials = (user?.displayName || prefs.displayName || user?.email || 'G').slice(0, 2).toUpperCase();
  const h = (t: string) => !collapsed && <div className="mb-2 mt-6 px-2 text-[10px] font-bold uppercase tracking-[.17em] text-slate-500">{t}</div>;
  return (
    <div className="app-noise workspace-shell flex h-[100dvh] min-h-0 overflow-hidden bg-[#101116] text-slate-100" data-workspace-mode={prefs.workspaceMode}>
      <a href="#main" className="skip-link">Skip to content</a>
      {mobileOpen && <button aria-label="Close navigation overlay" tabIndex={-1} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}
      <aside ref={asideRef} onKeyDown={trap} onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a[href]') && !confirmDiscard()) { e.preventDefault(); e.stopPropagation(); } }} role={isMobile && mobileOpen ? 'dialog' : undefined} aria-modal={isMobile && mobileOpen ? true : undefined} aria-label="Workspace navigation" className={cx('workspace-sidebar safe-t fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-white/[.065] bg-[#12141a] transition-transform duration-200 lg:relative lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed && 'lg:w-[72px]')}>
        <div className="flex h-[66px] items-center justify-between px-4">
          <Link href="/workspace" onClick={() => setMobileOpen(false)} aria-label="Ayatrisya home"><Brand compact /></Link>
          <button ref={closeBtn} aria-label="Close navigation" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[.07] lg:hidden" onClick={() => setMobileOpen(false)}><X size={16} /></button>
          <IconButton label={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="hidden lg:grid" onClick={() => save({ sidebarCollapsed: !collapsed })}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton>
        </div>
        <div className="px-3">
          <Button className="w-full justify-start" onClick={() => void newChat()} disabled={creating} data-testid="button-new-chat"><Plus size={16} />{!collapsed && 'New chat'}</Button>
          <button onClick={() => setDialog('palette')} aria-label="Search workspace" className={cx('mt-2 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-xs text-slate-400 hover:bg-white/[.05] hover:text-white', collapsed && 'justify-center px-0')}>
            <Search size={16} />{!collapsed && <>Search workspace<span className="ml-auto rounded border border-white/[.08] px-1.5 py-0.5 text-[9px]">Ctrl K</span></>}
          </button>
        </div>
        <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
          {h('Create')}
          {L('/workspace', path === '/workspace', <Home size={15} />, 'Home')}
          {L('/workspace/chat', path === '/workspace/chat' || path.startsWith('/workspace/chat/'), <MessageSquare size={15} />, 'Chat')}
          {L('/workspace/research', path === '/workspace/research', <StickyNote size={15} />, 'Research notes')}
          {L('/workspace/documents', path.startsWith('/workspace/documents'), <FileText size={15} />, 'Documents')}
          {L('/workspace/presentations', path === '/workspace/presentations', <Presentation size={15} />, 'Presentations')}
          {L('/workspace/coding', path.startsWith('/workspace/coding'), <Code2 size={15} />, 'Coding')}
          {L('/workspace/canvas', path.startsWith('/workspace/canvas'), <Code2 size={15} className="text-violet-400" />, 'Canvas IDE')}
          {h('Studios')}
          {L('/workspace/images', path === '/workspace/images', <Image size={15} />, 'Image studio')}
          {L('/workspace/3d', path === '/workspace/3d', <Box size={15} />, '3D studio')}
          {L('/workspace/music', path === '/workspace/music', <Music2 size={15} />, 'Music studio')}
          {L('/workspace/voice', path === '/workspace/voice', <Mic size={15} />, 'Voice studio')}
          {h('Organise')}
          {L('/workspace/projects', path.startsWith('/workspace/projects'), <FolderKanban size={15} />, 'Projects')}
          {L('/workspace/library', path === '/workspace/library', <Library size={15} />, 'Library')}
          {!collapsed && <>
            <div className="mb-2 mt-6 px-2 text-[10px] font-bold uppercase tracking-[.17em] text-slate-500">Recent chats</div>
            <label className="sr-only" htmlFor="chat-search">Search conversations</label>
            <input id="chat-search" value={chatSearch} onChange={(e) => { setChatSearch(e.target.value); setChatPage(0); }} placeholder="Search conversations" className="mb-1 h-8 w-full rounded-md border border-white/[.07] bg-transparent px-2 text-[11px] text-slate-300 placeholder:text-slate-500" />
            {convs.loading && !convs.data && <div className="space-y-1 px-1 pt-1"><div className="h-6 animate-pulse rounded bg-white/[.05]" /><div className="h-6 animate-pulse rounded bg-white/[.05]" /></div>}
            {convs.error && <button onClick={convs.refresh} className="px-2 py-2 text-left text-[11px] text-rose-300">Could not load chats. Retry</button>}
            {convs.data?.length === 0 && <p className="px-2 py-2 text-[11px] leading-5 text-slate-500">{chatPage ? 'No more conversations on this page.' : chatSearch ? 'No conversations match.' : 'No conversations yet. Start one and it is saved here, in this browser.'}</p>}
            {convs.data?.slice(0,30).map((c) => (
              <div key={c.id} className="group relative flex items-center">
                <Link
                  href={`/workspace/chat/${c.id}`}
                  onContextMenu={ctx.open(acts.items(c))}
                  onClick={() => setMobileOpen(false)}
                  aria-current={chatId === c.id ? 'page' : undefined}
                  className={cx(
                    'block min-w-0 flex-1 truncate rounded-md px-2 py-2 text-[12px] hover:bg-white/[.04] hover:text-slate-100',
                    chatId === c.id ? 'bg-white/[.06] text-slate-100' : 'text-slate-400'
                  )}
                >
                  {c.pinned && <Pin size={10} className="mr-1 inline text-violet-300" aria-label="Pinned" />}
                  {c.title}
                </Link>
                <button
                  type="button"
                  aria-label={`Options for ${c.title}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ctx.open(acts.items(c))(e as any);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-white rounded transition-opacity"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            ))}
            <Link href="/workspace/history" onClick={() => setMobileOpen(false)} className="mt-1 flex items-center gap-2 px-2 py-2 text-[11px] text-slate-400 hover:text-slate-100"><HistoryIcon size={12} />All conversations</Link>
            {(chatPage > 0 || (convs.data?.length ?? 0) > 30) && <div className="flex items-center justify-between gap-1 px-2 py-2 text-[11px] text-slate-400"><button disabled={!chatPage} onClick={() => setChatPage(p => Math.max(0,p-1))} className="disabled:opacity-40">Newer</button><span>Page {chatPage+1}</span><button disabled={(convs.data?.length ?? 0) <= 30} onClick={() => setChatPage(p => p+1)} className="disabled:opacity-40">Older</button></div>}
          </>}
        </nav>
        <div className="safe-b border-t border-white/[.06] p-3">
          <Link href="/workspace/storage" onClick={() => setMobileOpen(false)} className={cx('mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-400 hover:bg-white/[.05] hover:text-slate-100', collapsed && 'justify-center')} title="Storage and backup">
            <HardDrive size={14} />{!collapsed && <span className="truncate">Local only{stats.data ? ` · ${stats.data.conversations} chats, ${stats.data.projects} projects` : ''}</span>}
          </Link>
          <Link href="/workspace/account" onClick={() => setMobileOpen(false)} className={cx('flex items-center gap-2 rounded-lg p-2 hover:bg-white/[.05]', collapsed && 'justify-center')} aria-label="Account">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-[#22242c] text-[10px] font-semibold text-slate-300">{initials}</span>
            {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{user ? user.displayName || user.email : prefs.displayName || 'Account'}</span><span className="block truncate text-[10px] text-slate-500">{user ? (user.emailVerified ? 'Signed in, verified' : 'Signed in, unverified') : 'Not signed in'}</span></span>}
          </Link>
          <Link href="/workspace/settings" onClick={() => setMobileOpen(false)} className={cx('mt-1 flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-400 hover:bg-white/[.05] hover:text-slate-100', collapsed && 'justify-center')} title="Settings"><Settings size={14} />{!collapsed && 'Settings'}</Link>
        </div>
      </aside>
      <div ref={mainRef} className="flex min-w-0 flex-1 flex-col h-full min-h-0 overflow-hidden">
        <header className="safe-t flex min-h-[56px] sm:min-h-[66px] shrink-0 items-center justify-between gap-2 border-b border-white/[.06] px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button ref={menuBtn} aria-label="Open navigation" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[.07] lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={17} /></button>
            <h1 className="truncate text-[13px] font-medium text-slate-200"><MotionText>{title}</MotionText></h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <select aria-label="Workspace mode" value={prefs.workspaceMode} onChange={(e) => void save({ workspaceMode: e.target.value as WorkspaceMode })} className="hidden max-w-[126px] rounded-md border border-white/[.08] bg-[#171920] px-2 py-2 text-[11px] text-slate-200 lg:block">
              {Object.entries(workspaceModeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {prefs.workspaceMode === 'developer' && <div className="hidden items-center gap-2 rounded-md border border-cyan-200/10 bg-cyan-200/[.035] px-2.5 py-1.5 text-[10px] text-cyan-100/75 xl:flex" role="status" aria-label="Developer diagnostics">
              <span>{stats.data ? `${stats.data.conversations + stats.data.projects + stats.data.items} local records` : 'Local records unavailable'}</span>
              <span className="text-cyan-100/30">/</span>
              <span>{caps.filter((cap) => cap.available).length} model capabilities reported ready</span>
            </div>}
            <select aria-label="Model" value={prefs.model} onChange={(e) => { const m = e.target.value as ModelId; void save({ model: m }); const c = capFor(m); if (!c?.available) notify(`${modelNames[m]} is not available: ${c?.reason ?? 'no model connection is configured.'}`); }} className="max-w-[118px] rounded-md border border-white/[.08] bg-[#171920] px-2 py-2 text-[11px] text-slate-200 sm:max-w-none sm:px-3">
              {(Object.keys(modelNames) as ModelId[]).map((m) => <option key={m} value={m}>{modelNames[m]}{capFor(m)?.available ? '' : ' (unavailable)'}</option>)}
            </select>
            <select aria-label="Chat mode" value={prefs.mode} onChange={(e) => void save({ mode: e.target.value as ChatMode })} className="hidden max-w-[84px] rounded-md border border-white/[.08] bg-[#171920] px-2 py-2 text-[11px] text-slate-200 lg:block sm:max-w-none sm:px-3">
              <option>Normal</option><option>Savage</option><option>Joke</option>
            </select>
            <span role="status" className={cx('hidden rounded-md border px-2 py-1.5 text-[10px] lg:block', selectedCap?.available ? 'border-teal-300/30 text-teal-300 bg-teal-400/[.06]' : 'border-amber-400/30 text-amber-300 bg-amber-400/[.06]')}>
              {selectedCap?.available ? `${modelNames[prefs.model]} · Ready` : `${modelNames[prefs.model]} · Unavailable`}
            </span>
            <IconButton label="Search and commands (Ctrl K)" onClick={() => setDialog('palette')} className="hidden sm:grid"><CommandIcon size={16} /></IconButton>
            <ActionMenu label="Profile menu" items={profileItems}><UserRound size={16} /></ActionMenu>
          </div>
        </header>
        <main id="main" tabIndex={-1} className={cx('workspace-main-content min-h-0 flex-1 focus:outline-none overflow-hidden', isFullViewport ? 'flex flex-col h-full' : 'overflow-y-auto')}><div ref={pageRef} className={cx(isFullViewport ? 'flex-1 h-full min-h-0 flex flex-col overflow-hidden' : 'min-h-full')}>
          {path === '/workspace' ? <WorkspaceHome
            displayName={user?.displayName || prefs.displayName || ''}
            projects={homeProjects.data ?? []}
            conversations={homeConversations.data ?? []}
            items={homeItems.data ?? []}
            stats={stats.data ?? null}
            loading={homeProjects.loading || homeConversations.loading || homeItems.loading}
            error={homeProjects.error || homeConversations.error || homeItems.error}
            modelAvailable={anyReady}
            sections={prefs.homeSections}
            density={prefs.homeDensity}
            onAction={homeAction}
            onOpenProject={(id) => goto(`/workspace/projects/${id}`)}
            onOpenConversation={(id) => goto(`/workspace/chat/${id}`)}
            onOpenItem={(id) => {
              const item = homeItems.data?.find((entry) => entry.id === id);
              goto(item?.kind === 'document' ? `/workspace/documents/${id}` : `/workspace/library?item=${encodeURIComponent(id)}`);
            }}
            onToggleSection={(section) => void save({ homeSections: { ...prefs.homeSections, [section]: !prefs.homeSections[section] } })}
            onChangeDensity={(density) => void save({ homeDensity: density })}
            onRetry={() => { homeProjects.refresh(); homeConversations.refresh(); homeItems.refresh(); }}
          /> : <FeaturePage path={path} goto={goto} notify={notify} />}
        </div></main>
      </div>
      {dialog === 'palette' && <Palette commands={commands} goto={goto} notify={notify} onClose={() => setDialog('')} recentCommandIds={prefs.recentCommands} onCommandRun={recordCommand} />}
      {acts.dialogs}{ctx.node}
      <NoticeHost />
    </div>
  );
}

export function SideLink({ href, active, icon, label, collapsed, onSelect }: { href: string; active: boolean; icon: ReactNode; label: string; collapsed: boolean; onSelect: () => void }) {
  return (
    <Link href={href} onClick={onSelect} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} aria-current={active ? 'page' : undefined} className={cx('workspace-nav-link my-0.5 flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-[12px] transition', active ? 'bg-violet-300/[.1] text-violet-100' : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-100', collapsed && 'justify-center px-0')}>
      {icon}{!collapsed && label}
    </Link>
  );
}
