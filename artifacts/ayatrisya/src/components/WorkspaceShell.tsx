import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  CircleHelp,
  Code2,
  Command,
  FileText,
  FolderKanban,
  Image,
  Library,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Presentation,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { Button, IconButton, Modal } from '@/components/Primitives';
import { recentChats, tools } from '@/data/fixtures';
import { cx } from '@/lib/cx';
import { session } from '@/lib/session';
import { Brand } from '@/components/Brand';
import { Toast } from '@/components/Toast';
import { FeaturePage } from '@/pages/workspace/FeaturePage';

export function Workspace() {
  const [path, setPath] = useLocation(),
    [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [dialog, setDialog] = useState(''),
    [toast, setToast] = useState(''),
    [mode, setMode] = useState('Normal'),
    [model, setModel] = useState('Seed · experimental'),
    [theme, setThemeState] = useState(session.appearance);
  const [search, setSearch] = useState('');
  const title = useMemo(
    () =>
      tools.find((t) => t.href === path)?.name ??
      (path.startsWith('/workspace/chat')
        ? 'Conversation'
        : path.startsWith('/workspace/projects/')
          ? 'Fieldnotes'
          : path.startsWith('/workspace/documents/')
            ? 'Product principles'
            : path.includes('settings')
              ? 'Settings'
              : path.includes('account')
                ? 'Account'
                : 'Workspace'),
    [path],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDialog('launcher');
      }
      if (e.key === 'Escape') {
        setDialog('');
        setMobileOpen(false);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.appearance =
      theme === 'Light' ? 'light' : 'dark';
    return () => {
      delete document.documentElement.dataset.appearance;
    };
  }, [theme]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3600);
  };
  const goto = (href: string) => {
    setPath(href);
    setDialog('');
    setMobileOpen(false);
  };
  return (
    <div className="app-noise flex min-h-[100dvh] overflow-hidden bg-[#101116] text-slate-100">
      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/[.065] bg-[#12141a] transition-transform duration-200 md:relative md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'md:w-[72px]',
        )}
      >
        <div className="flex h-[66px] items-center justify-between px-4">
          <Link href="/workspace" onClick={() => setMobileOpen(false)}>
            <Brand compact />
          </Link>
          <IconButton
            label="Close navigation"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={16} />
          </IconButton>
          <IconButton
            label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="hidden md:grid"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </IconButton>
        </div>
        <div className="px-3">
          <Button
            className="w-full justify-start"
            onClick={() => goto('/workspace')}
          >
            <Plus size={16} />
            {!collapsed && 'New chat'}
            {!collapsed && (
              <span className="ml-auto text-[10px] text-violet-100/60">
                ⌘ I
              </span>
            )}
          </Button>
          <button
            onClick={() => setDialog('launcher')}
            className={cx(
              'mt-2 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-xs text-slate-400 hover:bg-white/[.05] hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            <Search size={16} />
            {!collapsed && (
              <>
                Search workspace
                <span className="ml-auto rounded border border-white/[.08] px-1.5 py-0.5 text-[9px]">
                  ⌘ K
                </span>
              </>
            )}
          </button>
        </div>
        <div className="mt-7 flex-1 overflow-y-auto px-3">
          {!collapsed && (
            <div className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[.17em] text-slate-600">
              Workspace
            </div>
          )}
          <SideLink
            href="/workspace"
            active={path === '/workspace' || path.startsWith('/workspace/chat')}
            icon={<MessageSquare size={15} />}
            label="Chat"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <SideLink
            href="/workspace/research"
            active={path === '/workspace/research'}
            icon={<Search size={15} />}
            label="Research"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <SideLink
            href="/workspace/coding"
            active={path.startsWith('/workspace/coding')}
            icon={<Code2 size={15} />}
            label="Coding"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <SideLink
            href="/workspace/images"
            active={path === '/workspace/images'}
            icon={<Image size={15} />}
            label="Image studio"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <SideLink
            href="/workspace/documents"
            active={path.startsWith('/workspace/documents')}
            icon={<FileText size={15} />}
            label="Documents"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <SideLink
            href="/workspace/presentations"
            active={path === '/workspace/presentations'}
            icon={<Presentation size={15} />}
            label="Presentations"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <div className="mb-2 mt-7 px-2 text-[9px] font-bold uppercase tracking-[.17em] text-slate-600">
            {!collapsed ? 'Organize' : ''}
          </div>
          <SideLink
            href="/workspace/projects"
            active={path.startsWith('/workspace/projects')}
            icon={<FolderKanban size={15} />}
            label="Projects"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          <SideLink
            href="/workspace/library"
            active={path === '/workspace/library'}
            icon={<Library size={15} />}
            label="Library"
            collapsed={collapsed}
            onSelect={() => setMobileOpen(false)}
          />
          {!collapsed && (
            <>
              <div className="mb-2 mt-7 px-2 text-[9px] font-bold uppercase tracking-[.17em] text-slate-600">
                Recent chats
              </div>
              {recentChats.map((chat, i) => (
                <button
                  key={chat}
                  onClick={() => goto(`/workspace/chat/${i + 1}`)}
                  className="w-full truncate rounded-md px-2 py-2 text-left text-[11px] text-slate-500 hover:bg-white/[.04] hover:text-slate-200"
                >
                  {chat}
                </button>
              ))}
              <div className="mb-2 mt-6 px-2 text-[9px] font-bold uppercase tracking-[.17em] text-slate-600">
                Pinned
              </div>
              <button
                onClick={() =>
                  notify('No pinned items in this fresh demo session.')
                }
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] text-slate-600 hover:text-slate-300"
              >
                <Sparkles size={13} />
                No pinned items
              </button>
            </>
          )}
        </div>
        <div className="border-t border-white/[.06] p-3">
          <button
            onClick={() => goto('/workspace/account')}
            className={cx(
              'flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/[.05]',
              collapsed && 'justify-center',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-[#22242c] text-[10px] font-semibold text-slate-300">
              AM
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    Guest workspace
                  </span>
                  <span className="block text-[10px] text-slate-600">
                    Session-only demo
                  </span>
                </span>
                <MoreHorizontal size={15} className="text-slate-500" />
              </>
            )}
          </button>
          {!collapsed && (
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => goto('/workspace/settings')}
                className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-500 hover:bg-white/[.05] hover:text-slate-200"
              >
                <Settings size={14} />
                Settings
              </button>
              <button
                onClick={() => notify('Help resources are coming later.')}
                aria-label="Help"
                className="rounded-md px-2 text-slate-500 hover:bg-white/[.05]"
              >
                <CircleHelp size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[66px] shrink-0 items-center justify-between border-b border-white/[.06] px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton
              label="Open navigation"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={17} />
            </IconButton>
            <span className="truncate text-[13px] font-medium text-slate-300">
              {title}
            </span>
            {path.includes('/chat/') && (
              <span className="hidden text-[10px] text-slate-600 sm:inline">
                · Demo conversation
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <select
              aria-label="Model selection"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                notify(
                  'Model choice is a UI label only; no model is connected.',
                );
              }}
              className="max-w-[133px] rounded-md border border-white/[.08] bg-[#171920] px-2 py-2 text-[10px] text-slate-300 sm:max-w-none sm:px-3"
            >
              <option>Seed · experimental</option>
              <option>Core · planned</option>
              <option>Auto · planned routing</option>
            </select>
            <select
              aria-label="Mode selection"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="max-w-[90px] rounded-md border border-white/[.08] bg-[#171920] px-2 py-2 text-[10px] text-slate-300 sm:max-w-none sm:px-3"
            >
              <option>Normal</option>
              <option>Focus</option>
              <option>Creative</option>
            </select>
            <span className="hidden rounded-md border border-white/[.07] px-2 py-1.5 text-[9px] text-slate-600 lg:block">
              {mode === 'Focus'
                ? 'Quiet canvas'
                : mode === 'Creative'
                  ? 'Open canvas'
                  : 'Ready'}
            </span>
            <IconButton
              label="Open tools"
              onClick={() => setDialog('launcher')}
              className="hidden sm:grid"
            >
              <Command size={16} />
            </IconButton>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <FeaturePage
            path={path}
            goto={goto}
            notify={notify}
            theme={theme}
            setTheme={(value) => {
              session.appearance = value;
              setThemeState(value);
            }}
          />
        </main>
      </div>
      {dialog === 'launcher' && (
        <Modal title="Go to" onClose={() => setDialog('')}>
          <label className="block">
            <span className="sr-only">Search workspace tools</span>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools and pages…"
              className="h-11 w-full rounded-lg border border-white/10 bg-[#101116] px-3 text-sm text-white placeholder:text-slate-600"
            />
          </label>
          <div className="mt-3 max-h-[55vh] space-y-1 overflow-auto">
            {tools
              .filter((t) =>
                (t.name + t.detail)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => goto(t.href)}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-white/[.06]"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-violet-300/[.06] text-violet-200">
                    <ToolIcon name={t.name} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-xs font-semibold">
                      {t.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {t.detail}
                    </span>
                  </span>
                  <span className="text-[9px] text-slate-700">
                    {i === 0 ? '↵' : ''}
                  </span>
                </button>
              ))}
            {!tools.some((t) =>
              (t.name + t.detail).toLowerCase().includes(search.toLowerCase()),
            ) && (
              <p className="p-5 text-center text-xs text-slate-500">
                No matching workspace tools.
              </p>
            )}
          </div>
          <div className="mt-3 border-t border-white/[.07] pt-3 text-[10px] text-slate-600">
            Use <kbd className="rounded border border-white/10 px-1">Esc</kbd>{' '}
            to close · ⌘ K to open
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} close={() => setToast('')} />}
    </div>
  );
}

export function SideLink({
  href,
  active,
  icon,
  label,
  collapsed,
  onSelect,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      title={collapsed ? label : undefined}
      className={cx(
        'my-0.5 flex min-h-9 items-center gap-3 rounded-lg px-2.5 text-[11px] transition',
        active
          ? 'bg-violet-300/[.09] text-violet-100'
          : 'text-slate-500 hover:bg-white/[.04] hover:text-slate-200',
        collapsed && 'justify-center px-0',
      )}
    >
      {icon}
      {!collapsed && label}
    </Link>
  );
}

export function ToolIcon({ name }: { name: string }) {
  const className = 'size-4';
  switch (name) {
    case 'Chat':
      return <MessageSquare className={className} />;
    case 'Research':
      return <Search className={className} />;
    case 'Coding':
      return <Code2 className={className} />;
    case 'Image studio':
      return <Image className={className} />;
    case 'Documents':
      return <FileText className={className} />;
    case 'Presentations':
      return <Presentation className={className} />;
    case 'Projects':
      return <FolderKanban className={className} />;
    default:
      return <Library className={className} />;
  }
}
