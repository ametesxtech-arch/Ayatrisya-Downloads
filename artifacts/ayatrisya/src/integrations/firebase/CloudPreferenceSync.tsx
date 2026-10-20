import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { usePrefs } from "@/hooks/use-prefs";
import { repository } from "@/storage/repository";
import {
  cloudSettingsFingerprint,
  cloudSettingsFromPreferences,
  watchCloudPersonalization,
  writeCloudPersonalization,
} from "./personalization-sync";

export type CloudPreferenceSyncState = "off" | "needs-account" | "connecting" | "synced" | "error";
const SyncContext = createContext<{ state: CloudPreferenceSyncState; error: string | null } | null>(null);

export function CloudPreferenceSyncProvider({ children }: { children: ReactNode }) {
  const { user, guest, loading: authLoading } = useAuth();
  const { prefs, loaded } = usePrefs();
  const [state, setState] = useState<CloudPreferenceSyncState>("off");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefs.syncAcrossDevices) {
      setState("off");
      setError(null);
      return;
    }
    if (authLoading || !loaded) {
      setState("connecting");
      return;
    }
    if (!user || guest) {
      setState("needs-account");
      return;
    }

    let active = true;
    let remoteReady = false;
    let remoteFingerprint: string | null = null;
    let queue = Promise.resolve();
    setState("connecting");
    setError(null);

    const stopWatching = watchCloudPersonalization(user.uid, (remote) => {
      remoteReady = true;
      if (!remote) {
        remoteFingerprint = null;
        queue = queue.then(async () => {
          if (!active) return;
          try {
            const local = await repository.getPreferences();
            if (!local.syncAcrossDevices) return;
            const written = await writeCloudPersonalization(user.uid, local);
            remoteFingerprint = cloudSettingsFingerprint(written);
            if (active) setState("synced");
          } catch (cause) {
            if (active) {
              setError(cause instanceof Error ? cause.message : "Cloud settings could not be saved.");
              setState("error");
            }
          }
        });
        return;
      }
      const incomingFingerprint = cloudSettingsFingerprint(remote);
      remoteFingerprint = incomingFingerprint;
      queue = queue.then(async () => {
        if (!active) return;
        try {
          const local = await repository.getPreferences();
          const localFingerprint = cloudSettingsFingerprint(cloudSettingsFromPreferences(local));
          if (localFingerprint !== incomingFingerprint) {
            await repository.savePreferences({
              wallpaper: remote.wallpaper,
              personalization: remote.personalization,
            });
          }
          if (active) {
            setError(null);
            setState("synced");
          }
        } catch (cause) {
          if (active) {
            setError(cause instanceof Error ? cause.message : "Cloud settings could not be applied.");
            setState("error");
          }
        }
      });
    }, (cause) => {
      if (!active) return;
      setError(cause.message || "Cloud sync is unavailable. Check Firebase Firestore and its security rules.");
      setState("error");
    });

    const stopLocal = repository.subscribe(() => {
      if (!active || !remoteReady) return;
      queue = queue.then(async () => {
        if (!active) return;
        const local = await repository.getPreferences();
        if (!local.syncAcrossDevices) return;
        const value = cloudSettingsFromPreferences(local);
        const fingerprint = cloudSettingsFingerprint(value);
        if (fingerprint === remoteFingerprint) return;
        const previous = remoteFingerprint;
        remoteFingerprint = fingerprint;
        try {
          await writeCloudPersonalization(user.uid, local);
          if (active) {
            setError(null);
            setState("synced");
          }
        } catch (cause) {
          remoteFingerprint = previous;
          if (active) {
            setError(cause instanceof Error ? cause.message : "Cloud settings could not be saved.");
            setState("error");
          }
        }
      }).catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Cloud settings could not be saved.");
          setState("error");
        }
      });
    });

    return () => {
      active = false;
      stopWatching();
      stopLocal();
    };
  }, [authLoading, guest, loaded, prefs.syncAcrossDevices, user?.uid]);

  const value = useMemo(() => ({ state, error }), [state, error]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useCloudPreferenceSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error("CloudPreferenceSyncProvider is required.");
  return value;
}
