import { lazy, Suspense } from 'react';
import { ChatPage } from '@/pages/workspace/Chat';
import { Skeleton } from '@/components/Primitives';
import NotFound from '@/pages/not-found';

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
  const seg = path.split('/');
  let body;
  if (path === '/workspace' || path === '/workspace/' || (path.startsWith('/workspace/chat/') && seg.length === 4)) return <ChatPage path={path} goto={goto} notify={notify} />;
  if (path === '/workspace/research') body = <Research notify={notify} />;
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
