import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/integrations/firebase/AuthProvider';
import { usePrefs } from '@/hooks/use-prefs';
import { Emblem } from '@/components/Brand';
import { Landing } from '@/pages/Landing';
import { DesktopDownloadsPage } from '@/pages/DesktopDownloads';

const Workspace = lazy(() => import('@/components/WorkspaceShell').then((m) => ({ default: m.Workspace })));
const AuthPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.AuthPage })));
const Onboarding = lazy(() => import('@/pages/Onboarding').then((m) => ({ default: m.Onboarding })));

const queryClient = new QueryClient();

function guestCanOpen(path: string) {
  return path === '/workspace/images' ||
    path === '/workspace/chat' ||
    /^\/workspace\/chat\/[^/]+\/?$/.test(path);
}

function ProtectedWorkspace() {
  const { user, guest, loading } = useAuth();
  const [path, setPath] = useLocation();
  useEffect(() => {
    if (loading || user) return;
    if (!guest) setPath('/auth/sign-in', { replace: true });
    else if (!guestCanOpen(path)) setPath('/workspace/chat', { replace: true });
  }, [guest, loading, path, setPath, user]);
  if (loading) return <div className="grid min-h-[100dvh] place-items-center text-xs text-slate-500" role="status">Checking your access…</div>;
  if (user || (guest && guestCanOpen(path))) return <Workspace />;
  return <div className="grid min-h-[100dvh] place-items-center text-xs text-slate-500" role="status">Opening your guest workspace…</div>;
}

function ProtectedOnboarding() {
  const { user, guest, loading } = useAuth();
  const [, setPath] = useLocation();
  useEffect(() => {
    if (!loading && !user) setPath(guest ? '/workspace/chat' : '/auth/sign-in', { replace: true });
  }, [guest, loading, setPath, user]);
  if (loading) return <div className="grid min-h-[100dvh] place-items-center text-xs text-slate-500" role="status">Checking your account…</div>;
  return user ? <Onboarding /> : <div className="grid min-h-[100dvh] place-items-center text-xs text-slate-500" role="status">Opening your workspace…</div>;
}

function LegacyIntroRedirect() {
  const [, setPath] = useLocation();
  useEffect(() => { setPath('/auth/create-account', { replace: true }); }, [setPath]);
  return <div className="grid min-h-[100dvh] place-items-center text-xs text-slate-500" role="status">Opening account setup…</div>;
}

function RoutedBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function PrefsEffects() {
  const { prefs } = usePrefs();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => { root.dataset.appearance = prefs.theme === 'Light' || (prefs.theme === 'Follow system' && mq.matches) ? 'light' : 'dark'; };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [prefs.theme]);
  useEffect(() => { if (prefs.reducedMotion) document.documentElement.dataset.motion = 'reduced'; else delete document.documentElement.dataset.motion; }, [prefs.reducedMotion]);
  useEffect(() => { document.documentElement.dataset.intensity = prefs.animationIntensity ?? 'full'; }, [prefs.animationIntensity]);
  useEffect(() => {
    const f = () => { if (document.hidden) document.documentElement.dataset.hidden = ''; else delete document.documentElement.dataset.hidden; };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  return null;
}

function Router() {
  return (
    <RoutedBoundary>
      <Suspense fallback={<div className="grid min-h-[100dvh] place-items-center text-xs text-slate-500" role="status"><span className="grid place-items-center gap-3"><Emblem size={44} mode="loading" /><span>Loading Ayatrisya</span></span></div>}>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/desktop" component={DesktopDownloadsPage} />
          <Route path="/intro" component={LegacyIntroRedirect} />
          <Route path="/auth/sign-in" component={AuthPage} />
          <Route path="/auth/create-account" component={AuthPage} />
          <Route path="/auth/reset-password" component={AuthPage} />
          <Route path="/auth/email-check" component={AuthPage} />
          <Route path="/onboarding" component={ProtectedOnboarding} />
          <Route path={/^\/workspace(?:\/.*)?$/} component={ProtectedWorkspace} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </RoutedBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PrefsEffects />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
