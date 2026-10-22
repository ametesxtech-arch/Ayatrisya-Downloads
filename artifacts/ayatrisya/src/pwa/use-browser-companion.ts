import { useCallback, useEffect, useMemo, useState } from "react";
import type { DesktopCommandResult, DesktopFile, DesktopProject } from "@/desktop/contracts";

const COMPANION_BASE_URL = "http://127.0.0.1:49381/v1";
const PROTOCOL_HEADER = "X-Ayatrisya-Protocol";

type CompanionMode = "checking" | "unavailable" | "available" | "paired" | "desktop";
export interface CompanionAuditEntry {
  at: string;
  operation: string;
  status: string;
}
export type CodingDesktopApi = {
  listProjects: () => Promise<DesktopProject[]>;
  chooseProjectFolder: () => Promise<DesktopProject | null>;
  removeProjectFolder: (projectId: string) => Promise<void>;
  listFiles: (projectId: string, relativePath: string) => Promise<DesktopFile[]>;
  readFile: (projectId: string, relativePath: string) => Promise<string>;
  createFile: (projectId: string, relativePath: string) => Promise<void>;
  writeFile: (projectId: string, relativePath: string, content: string) => Promise<void>;
  runCommand: (projectId: string, command: string, commandId?: string) => Promise<DesktopCommandResult>;
  cancelCommand: (commandId: string) => Promise<void>;
};

export interface BrowserCompanionState {
  mode: CompanionMode;
  api: CodingDesktopApi | null;
  busy: boolean;
  error: string;
  audit: CompanionAuditEntry[];
  pair: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshAudit: () => Promise<void>;
}

interface CompanionStatusResponse {
  available: boolean;
  protocolVersion: number;
}

async function companionFetch<T>(
  path: string,
  options: { method?: "GET" | "POST"; token?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { [PROTOCOL_HEADER]: "1" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${COMPANION_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new Error("Ayatrisya Desktop could not be reached. The desktop app must be open on this same computer, with the local companion enabled. Replit preview origins are not allowed.");
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "The desktop companion request failed.");
  }
  return data as T;
}

export function useBrowserCompanion(): BrowserCompanionState {
  const [mode, setMode] = useState<CompanionMode>("checking");
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<CompanionAuditEntry[]>([]);

  const refresh = useCallback(async () => {
    if (typeof window !== "undefined" && window.ayatrisyaDesktop?.isDesktop === true) {
      setMode("desktop");
      return;
    }
    try {
      const status = await companionFetch<CompanionStatusResponse>("/status", { method: "GET" });
      setMode(status.available && status.protocolVersion === 1 ? (token ? "paired" : "available") : "unavailable");
      setError("");
    } catch {
      setMode("unavailable");
      setToken("");
      setExpiresAt("");
      setAudit([]);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;
    if (typeof window !== "undefined" && window.ayatrisyaDesktop?.isDesktop === true) {
      setMode("desktop");
      return () => { active = false; };
    }
    const probe = async () => {
      try {
        const status = await companionFetch<CompanionStatusResponse>("/status", { method: "GET" });
        if (active) setMode(status.available && status.protocolVersion === 1 ? (token ? "paired" : "available") : "unavailable");
      } catch {
        if (active) {
          setMode("unavailable");
          setToken("");
          setExpiresAt("");
          setAudit([]);
        }
      }
    };
    void probe();
    interval = setInterval(() => void probe(), 8_000);
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !expiresAt) return;
    const delay = Math.max(0, Date.parse(expiresAt) - Date.now());
    const timeout = setTimeout(() => {
      setToken("");
      setExpiresAt("");
      setMode("available");
      setError("The browser companion session expired. Pair again to continue.");
    }, delay);
    return () => clearTimeout(timeout);
  }, [token, expiresAt]);

  useEffect(() => {
    if (!token) return;
    const sessionToken = token;
    return () => {
      void companionFetch("/session/revoke", { method: "POST", token: sessionToken, body: {} }).catch(() => undefined);
    };
  }, [token]);

  const clearSession = useCallback(() => {
    setToken("");
    setExpiresAt("");
    setAudit([]);
    setMode("available");
  }, []);

  const refreshAudit = useCallback(async () => {
    if (!token) {
      setAudit([]);
      return;
    }
    try {
      const result = await companionFetch<{ entries: CompanionAuditEntry[] }>("/audit", { token });
      setAudit(result.entries);
    } catch (reason) {
      if (reason instanceof Error && /pair this browser/i.test(reason.message)) clearSession();
    }
  }, [clearSession, token]);

  useEffect(() => {
    if (token) void refreshAudit();
  }, [refreshAudit, token]);

  const pair = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await companionFetch<{ token: string; expiresAt: string }>("/pair", {
        method: "POST",
        body: {},
      });
      setToken(response.token);
      setExpiresAt(response.expiresAt);
      setMode("paired");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not pair with Ayatrisya Desktop.";
      await refresh();
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      await companionFetch("/session/revoke", { method: "POST", token, body: {} });
      clearSession();
      setError("");
    } catch (reason) {
      clearSession();
      setError(reason instanceof Error ? reason.message : "The local session could not be revoked.");
    } finally {
      setBusy(false);
    }
  }, [clearSession, token]);

  const api = useMemo<CodingDesktopApi | null>(() => {
    if (!token || mode !== "paired") return null;
    const request = async <T,>(path: string, body?: unknown, signal?: AbortSignal) => {
      const result = await companionFetch<T>(path, { method: body === undefined ? "GET" : "POST", token, body, signal });
      if (path !== "/audit") void refreshAudit();
      return result;
    };
    const onUnauthorized = (reason: unknown): never => {
      if (reason instanceof Error && /pair this browser/i.test(reason.message)) clearSession();
      throw reason;
    };
    return {
      async listProjects() {
        try {
          const result = await request<{ projects: Array<Omit<DesktopProject, "path">> }>("/projects");
          return result.projects.map((project) => ({ ...project, path: "" }));
        } catch (reason) { return onUnauthorized(reason); }
      },
      async chooseProjectFolder() {
        try {
          const result = await request<{ project: Omit<DesktopProject, "path"> | null }>("/projects/choose", {});
          return result.project ? { ...result.project, path: "" } : null;
        } catch (reason) { return onUnauthorized(reason); }
      },
      async removeProjectFolder(projectId) {
        try {
          const result = await request<{ removed: boolean }>("/projects/remove", { projectId });
          if (!result.removed) throw new Error("Folder access removal was cancelled in Ayatrisya Desktop.");
        } catch (reason) { return onUnauthorized(reason); }
      },
      async listFiles(projectId, relativePath) {
        try {
          const result = await request<{ files: DesktopFile[] }>("/files/list", { projectId, relativePath });
          return result.files;
        } catch (reason) { return onUnauthorized(reason); }
      },
      async readFile(projectId, relativePath) {
        try {
          const result = await request<{ content: string }>("/files/read", { projectId, relativePath });
          return result.content;
        } catch (reason) { return onUnauthorized(reason); }
      },
      async createFile(projectId, relativePath) {
        try {
          await request("/files/create", { projectId, relativePath });
        } catch (reason) { return onUnauthorized(reason); }
      },
      async writeFile(projectId, relativePath, content) {
        try {
          await request("/files/write", { projectId, relativePath, content });
        } catch (reason) { return onUnauthorized(reason); }
      },
      async runCommand(projectId, command, commandId = crypto.randomUUID()) {
        try {
          return await request<DesktopCommandResult>("/commands/run", { projectId, command, commandId });
        } catch (reason) { return onUnauthorized(reason); }
      },
      async cancelCommand(commandId) {
        try {
          await request("/commands/cancel", { commandId });
        } catch (reason) { return onUnauthorized(reason); }
      },
    };
  }, [clearSession, mode, refreshAudit, token]);

  return { mode, api, busy, error, audit, pair, disconnect, refresh, refreshAudit };
}
