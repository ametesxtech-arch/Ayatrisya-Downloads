import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Workspace } from '@/components/WorkspaceShell';
import { Landing } from '@/pages/Landing';
import { AuthPage } from '@/pages/Auth';
import { Onboarding } from '@/pages/Onboarding';

const queryClient = new QueryClient();

function RoutedBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <RoutedBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth/sign-in" component={AuthPage} />
        <Route path="/auth/create-account" component={AuthPage} />
        <Route path="/auth/reset-password" component={AuthPage} />
        <Route path="/auth/email-check" component={AuthPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/workspace" component={Workspace} />
        <Route path="/workspace/chat/:id" component={Workspace} />
        <Route path="/workspace/research" component={Workspace} />
        <Route path="/workspace/coding" component={Workspace} />
        <Route path="/workspace/coding/desktop-preview" component={Workspace} />
        <Route path="/workspace/images" component={Workspace} />
        <Route path="/workspace/documents" component={Workspace} />
        <Route path="/workspace/documents/:id" component={Workspace} />
        <Route path="/workspace/presentations" component={Workspace} />
        <Route path="/workspace/projects" component={Workspace} />
        <Route path="/workspace/projects/:id" component={Workspace} />
        <Route path="/workspace/library" component={Workspace} />
        <Route path="/workspace/settings" component={Workspace} />
        <Route path="/workspace/account" component={Workspace} />
        <Route component={NotFound} />
      </Switch>
    </RoutedBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
