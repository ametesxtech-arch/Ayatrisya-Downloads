import { ChatPage } from '@/pages/workspace/Chat';
import { ResearchPage } from '@/pages/workspace/Research';
import { CodingPage } from '@/pages/workspace/Coding';
import { ImagesPage } from '@/pages/workspace/Images';
import { DocumentsPage } from '@/pages/workspace/Documents';
import { PresentationsPage } from '@/pages/workspace/Presentations';
import { ProjectsPage } from '@/pages/workspace/Projects';
import { LibraryPage } from '@/pages/workspace/Library';
import { SettingsPage } from '@/pages/workspace/Settings';
import { AccountPage } from '@/pages/workspace/Account';

export function FeaturePage({
  path,
  goto,
  notify,
  theme,
  setTheme,
}: {
  path: string;
  goto: (href: string) => void;
  notify: (m: string) => void;
  theme: string;
  setTheme: (s: string) => void;
}) {
  if (path === '/workspace' || path.startsWith('/workspace/chat/'))
    return <ChatPage path={path} goto={goto} notify={notify} />;
  if (path === '/workspace/research') return <ResearchPage notify={notify} />;
  if (
    path === '/workspace/coding' ||
    path === '/workspace/coding/desktop-preview'
  )
    return (
      <CodingPage
        detailed={path.endsWith('desktop-preview')}
        notify={notify}
        goto={goto}
      />
    );
  if (path === '/workspace/images') return <ImagesPage notify={notify} />;
  if (
    path === '/workspace/documents' ||
    path.startsWith('/workspace/documents/')
  )
    return (
      <DocumentsPage
        detail={path.includes('/documents/') && path !== '/workspace/documents'}
        notify={notify}
        goto={goto}
      />
    );
  if (path === '/workspace/presentations')
    return <PresentationsPage notify={notify} />;
  if (path === '/workspace/projects' || path.startsWith('/workspace/projects/'))
    return (
      <ProjectsPage
        detail={
          path.startsWith('/workspace/projects/') &&
          path !== '/workspace/projects'
        }
        notify={notify}
        goto={goto}
      />
    );
  if (path === '/workspace/library') return <LibraryPage notify={notify} />;
  if (path === '/workspace/settings')
    return <SettingsPage theme={theme} setTheme={setTheme} notify={notify} />;
  if (path === '/workspace/account') return <AccountPage notify={notify} />;
  return <ChatPage path={path} goto={goto} notify={notify} />;
}
