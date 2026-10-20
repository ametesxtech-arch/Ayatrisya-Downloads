import { lazy, Suspense } from 'react';
import { ChatPage } from '@/pages/workspace/Chat';
import { Skeleton } from '@/components/Primitives';
import NotFound from '@/pages/not-found';
import { useAuth } from '@/integrations/firebase/AuthProvider';

const Research = lazy(() => import('@/pages/workspace/Research').then((m) => ({ default: m.ResearchPage })));
const Coding = lazy(() => import('@/pages/workspace/Coding').then((m) => ({ default: m.CodingPage })));
const Studios = lazy(() => import('@/pages/workspace/Studios'));
const Documents = lazy(() => import('@/pages/workspace/Documents').then((m) => ({ default: m.DocumentsPage })));
const Presentations = lazy(() => import('@/pages/workspace/Presentations').then((m) => ({ default: m.PresentationsPage })));
const Projects = lazy(() => import('@/pages/workspace/Projects').then((m) => ({ default: m.ProjectsPage })));
const History = lazy(() => import('@/pages/workspace/History').then((m) => ({ default: m.HistoryPage })));
const Library = lazy(() => import('@/pages/workspace/Library').then((m) => ({ default: m.LibraryPage })));
const Settings = lazy(() => import('@/pages/workspace/Settings').then((m) => ({ default: m.SettingsPage })));
const Account = lazy(() => import('@/pages/workspace/Account').then((m) => ({ default: m.AccountPage })));

export function FeaturePage({ path, goto, notify }: { path: string; goto: (href: string) => void; notify: (m: string) => void }) {
  const { guest } = useAuth();
  const seg = path.split('/');
  let body;
  if (path === '/workspace/chat' || path === '/workspace/chat/' || (path.startsWith('/workspace/chat/') && seg.length === 4)) return <ChatPage path={path} goto={goto} notify={notify} />;
  if (guest && path === '/workspace/images') body = <GuestImageAccess />;
  else if (path === '/workspace/research') body = <Research notify={notify} />;
  else if (path === '/workspace/coding' || path === '/workspace/coding/desktop-preview') body = <Coding notify={notify} />;
  else if (path === '/workspace/images') body = <Studios kind="image" />;
  else if (path === '/workspace/3d') body = <Studios kind="3d" />;
  else if (path === '/workspace/music') body = <Studios kind="music" />;
  else if (path === '/workspace/voice') body = <Studios kind="voice" notify={notify} />;
  else if (path === '/workspace/documents' || (path.startsWith('/workspace/documents/') && seg.length === 4)) body = <Documents id={seg[3] ?? null} goto={goto} notify={notify} />;
  else if (path === '/workspace/presentations') body = <Presentations notify={notify} />;
  else if (path === '/workspace/projects' || (path.startsWith('/workspace/projects/') && seg.length === 4)) body = <Projects id={seg[3] ?? null} goto={goto} notify={notify} />;
  else if (path === '/workspace/history') body = <History goto={goto} notify={notify} />;
  else if (path === '/workspace/library') body = <Library notify={notify} />;
  else if (path === '/workspace/settings') body = <Settings notify={notify} goto={goto} />;
  else if (path === '/workspace/storage') body = <Settings notify={notify} goto={goto} initial="storage" />;
  else if (path === '/workspace/account') body = <Account notify={notify} goto={goto} />;
  else body = <NotFound />;
  return <Suspense fallback={<div className="mx-auto max-w-[1000px] space-y-3 p-8"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>}>{body}</Suspense>;
}

function GuestImageAccess() {
  return <section className="mx-auto max-w-2xl p-5 sm:p-10">
    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">Guest image allowance</p>
    <h2 className="display mt-3 text-3xl font-semibold tracking-tight">Two image generations</h2>
    <p className="mt-3 text-sm leading-6 text-slate-400">Guest access includes up to two generated images. Image generation is not connected yet, so no images or guest allowance have been used.</p>
    <div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-sm leading-6 text-amber-100/90" role="status">Image generation will be available after an Ayatrisya image model is connected. Your chats remain saved in this browser.</div>
  </section>;
}
