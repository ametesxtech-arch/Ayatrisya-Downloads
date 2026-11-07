// Proprietary notice: applies only to original material Ametesx owns or is authorized to license; third-party and prior licenses remain in force.
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
import { PublicDocumentation, PublicLegalRoute } from '@/pages/PublicPages';
import { wallpapers } from '@/data/wallpapers';
import { CloudPreferenceSyncProvider } from '@/integrations/firebase/CloudPreferenceSync';
import { PwaProvider } from '@/pwa/PwaProvider';
import { CanvasProvider } from '@/components/canvas/CanvasContext';

const Workspace = lazy(() => import('@/components/WorkspaceShell').then((m) => ({ default: m.Workspace })));
const AuthPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.AuthPage })));
const Onboarding = lazy(() => import('@/pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const DesktopHandoff = lazy(() => import('@/pages/DesktopHandoff').then((m) => ({ default: m.DesktopHandoff })));
const OAuthCallback = lazy(() => import('@/pages/OAuthCallback').then((m) => ({ default: m.OAuthCallback })));

const queryClient = new QueryClient();

function guestCanOpen(path: string) {
  return path === '/workspace/images' ||
    path === '/workspace/chat' ||
    path === '/workspace/tasks' ||
    path === '/workspace/canvas' ||
    /^\/workspace\/canvas(?:\/.*)?$/.test(path) ||
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
    const image = prefs.wallpaper === 'custom'
      ? prefs.customWallpaperData
      : wallpapers.find((wallpaper) => wallpaper.id === prefs.wallpaper)?.src ?? '';
    if (image) {
      root.dataset.wallpaperActive = 'true';
      root.style.setProperty('--workspace-wallpaper', `url("${image}")`);
    } else {
      delete root.dataset.wallpaperActive;
      root.style.removeProperty('--workspace-wallpaper');
    }
  }, [prefs.wallpaper, prefs.customWallpaperData]);
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

function MotionEffects() {
  useEffect(() => {
    const root = document.documentElement;
    if (!('IntersectionObserver' in window)) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const candidates = [
      '.landing-page main section',
      '.public-page-frame main > div',
      '.desktop-downloads main > div > section',
      '.auth-panel',
      '.workspace-main-content > div > *:not(.chat-page)',
      '.workspace-main-content section',
      '.workspace-home > div > section',
      '.chat-welcome',
      '[data-motion-text]',
    ].join(',');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        element.dataset.motionEntrance = 'visible';
        revealObserver.unobserve(element);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

    const motionAllowed = () => !media.matches &&
      root.dataset.motion !== 'reduced' &&
      root.dataset.intensity !== 'none';
    const markVisible = () => {
      document.querySelectorAll<HTMLElement>('[data-motion-entrance="pending"]').forEach((element) => {
        element.dataset.motionEntrance = 'visible';
        revealObserver.unobserve(element);
      });
    };
    const scan = (scope: ParentNode) => {
      if (!motionAllowed()) {
        markVisible();
        return;
      }
      const found: HTMLElement[] = [];
      if (scope instanceof HTMLElement && scope.matches(candidates)) found.push(scope);
      scope.querySelectorAll<HTMLElement>(candidates).forEach((element) => found.push(element));
      found.forEach((element) => {
        if (element.dataset.motionEntrance) return;
        element.dataset.motionEntrance = 'pending';
        revealObserver.observe(element);
      });
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) scan(node);
      }));
    });
    const sync = () => {
      if (motionAllowed()) scan(document);
      else markVisible();
    };
    const settingsObserver = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    settingsObserver.observe(root, { attributes: true, attributeFilter: ['data-motion', 'data-intensity'] });
    media.addEventListener('change', sync);
    sync();
    return () => {
      observer.disconnect();
      settingsObserver.disconnect();
      revealObserver.disconnect();
      media.removeEventListener('change', sync);
    };
  }, []);
  return null;
}

import { FractalGlassLoading } from '@/components/FractalGlassLoading';

function Router() {
  return (
    <RoutedBoundary>
      <Suspense fallback={<FractalGlassLoading />}>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/product" component={PublicLegalRoute} />
          <Route path="/desktop" component={DesktopDownloadsPage} />
          <Route path="/downloads" component={DesktopDownloadsPage} />
          <Route path="/download" component={DesktopDownloadsPage} />
          <Route path="/documentation" component={PublicDocumentation} />
          <Route path="/privacy" component={PublicLegalRoute} />
          <Route path="/terms" component={PublicLegalRoute} />
          <Route path="/contact" component={PublicLegalRoute} />
          <Route path="/copyright" component={PublicLegalRoute} />
          <Route path="/licenses" component={PublicLegalRoute} />
          <Route path="/cookies" component={PublicLegalRoute} />
          <Route path="/intro" component={LegacyIntroRedirect} />
          <Route path="/auth/sign-in" component={AuthPage} />
          <Route path="/auth/sign-in/" component={AuthPage} />
          <Route path="/sign-in" component={AuthPage} />
          <Route path="/signin" component={AuthPage} />
          <Route path="/login" component={AuthPage} />
          <Route path="/auth/create-account" component={AuthPage} />
          <Route path="/auth/create-account/" component={AuthPage} />
          <Route path="/create-account" component={AuthPage} />
          <Route path="/signup" component={AuthPage} />
          <Route path="/register" component={AuthPage} />
          <Route path="/auth/reset-password" component={AuthPage} />
          <Route path="/auth/reset-password/" component={AuthPage} />
          <Route path="/reset-password" component={AuthPage} />
          <Route path="/forgot-password" component={AuthPage} />
          <Route path="/auth/email-check" component={AuthPage} />
          <Route path="/auth/email-check/" component={AuthPage} />
          <Route path="/auth/desktop" component={DesktopHandoff} />
          <Route path="/auth/desktop/" component={DesktopHandoff} />
          <Route path="/auth/desktop-handoff" component={DesktopHandoff} />
          <Route path="/auth/desktop-handoff/" component={DesktopHandoff} />
          <Route path="/api/integrations/:provider/callback" component={OAuthCallback} />
          <Route path="/api/integrations/:provider/callback/" component={OAuthCallback} />
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
    <PwaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <CloudPreferenceSyncProvider>
              <CanvasProvider>
                <PrefsEffects />
                <MotionEffects />
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </CanvasProvider>
            </CloudPreferenceSyncProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </PwaProvider>
  );
}

export default App;
