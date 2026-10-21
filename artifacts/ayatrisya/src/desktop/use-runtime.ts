import { useCallback, useEffect, useState } from "react";
import { getVerifiedDesktopRuntime, type VerifiedDesktopRuntime } from "./runtime";

export function useDesktopRuntime() {
  const [runtime, setRuntime] = useState<VerifiedDesktopRuntime | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const next = await getVerifiedDesktopRuntime(true);
    setRuntime(next);
    setChecking(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("ayatrisya:desktop-runtime-changed"));
    }
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void getVerifiedDesktopRuntime().then((next) => {
      if (!active) return;
      setRuntime(next);
      setChecking(false);
    });
    return () => { active = false; };
  }, []);

  return { runtime, desktop: runtime?.api ?? null, checking, refresh };
}
