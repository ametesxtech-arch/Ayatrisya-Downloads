import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/Primitives";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaContextValue {
  isBrowserPwa: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  offline: boolean;
  updateAvailable: boolean;
  serviceWorkerState: "disabled" | "registering" | "ready" | "error" | "unsupported";
  install: () => Promise<void>;
  applyUpdate: () => void;
}

const PwaContext = createContext<PwaContextValue | null>(null);

export function usePwa(): PwaContextValue {
  const value = useContext(PwaContext);
  if (!value) throw new Error("PWA controls must be rendered inside PwaProvider.");
  return value;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return standaloneMedia || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function StatusBanners({
  offline,
  updateAvailable,
  applyUpdate,
}: Pick<PwaContextValue, "offline" | "updateAvailable" | "applyUpdate">) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [offline, updateAvailable]);
  if (dismissed || (!offline && !updateAvailable)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[100] flex justify-center px-3" data-testid="pwa-status-banner">
      <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-[#171922]/95 px-4 py-3 text-xs text-slate-200 shadow-xl backdrop-blur">
        {offline ? <WifiOff size={15} className="shrink-0 text-amber-200" /> : <RefreshCw size={15} className="shrink-0 text-violet-200" />}
        <p className="min-w-0 flex-1 leading-5" role="status">
          {offline
            ? "Offline. Saved browser data may remain available; sign-in, hosted AI, sync, and downloads need a connection."
            : "An Ayatrisya update is ready to install."}
        </p>
        {updateAvailable && <Button className="min-h-8 shrink-0 px-3 text-[11px]" onClick={applyUpdate} data-testid="button-pwa-update">Update</Button>}
        <button type="button" className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-white/10" aria-label="Dismiss status" onClick={() => setDismissed(true)} data-testid="button-dismiss-pwa-status"><X size={14} /></button>
      </div>
    </div>
  );
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(isStandalone);
  const [canInstall, setCanInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serviceWorkerState, setServiceWorkerState] = useState<PwaContextValue["serviceWorkerState"]>("disabled");
  const installPrompt = useRef<InstallPromptEvent | null>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const applyingUpdate = useRef(false);
  const isDesktop = typeof window !== "undefined" && window.ayatrisyaDesktop?.isDesktop === true;

  useEffect(() => {
    const updateOnline = () => setOffline(!navigator.onLine);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as InstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      installPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isDesktop || import.meta.env.DEV) {
      setServiceWorkerState("disabled");
      return () => {
        window.removeEventListener("online", updateOnline);
        window.removeEventListener("offline", updateOnline);
        window.removeEventListener("beforeinstallprompt", onInstallPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }
    if (!("serviceWorker" in navigator)) {
      setServiceWorkerState("unsupported");
      return () => {
        window.removeEventListener("online", updateOnline);
        window.removeEventListener("offline", updateOnline);
        window.removeEventListener("beforeinstallprompt", onInstallPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let onUpdateFound: (() => void) | null = null;
    const onControllerChange = () => {
      if (applyingUpdate.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    setServiceWorkerState("registering");

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    }).then((registered) => {
      if (disposed) return;
      registration = registered;
      setServiceWorkerState("ready");
      const checkWaiting = () => {
        if (registered.waiting && navigator.serviceWorker.controller) {
          waitingWorker.current = registered.waiting;
          setUpdateAvailable(true);
        }
      };
      checkWaiting();
      onUpdateFound = () => {
        const installing = registered.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker.current = registered.waiting;
            setUpdateAvailable(Boolean(registered.waiting));
          }
        });
      };
      registered.addEventListener("updatefound", onUpdateFound);
    }).catch(() => {
      if (!disposed) setServiceWorkerState("error");
    });

    return () => {
      disposed = true;
      if (registration && onUpdateFound) registration.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isDesktop]);

  const install = useCallback(async () => {
    const prompt = installPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installPrompt.current = null;
    setCanInstall(false);
    if (choice.outcome === "accepted") setIsInstalled(true);
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker.current) return;
    applyingUpdate.current = true;
    waitingWorker.current.postMessage({ type: "AYATRISYA_ACTIVATE_UPDATE" });
  }, []);

  const value: PwaContextValue = {
    isBrowserPwa: !isDesktop,
    isInstalled,
    canInstall,
    offline,
    updateAvailable,
    serviceWorkerState,
    install,
    applyUpdate,
  };

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!isDesktop && <StatusBanners offline={offline} updateAvailable={updateAvailable} applyUpdate={applyUpdate} />}
    </PwaContext.Provider>
  );
}
