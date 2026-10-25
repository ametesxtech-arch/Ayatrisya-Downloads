import fs from "node:fs";
import path from "node:path";
import type { ScheduledTaskRecord, ScheduledTaskExecution } from "./task-types";

interface StorageSchema {
  version: 1;
  tasks: Record<string, ScheduledTaskRecord>;
  logs: ScheduledTaskExecution[];
  desktopHeartbeats: Record<string, number>; // ownerId -> timestamp
}

export class TaskStore {
  private filePath: string;
  private data: StorageSchema = {
    version: 1,
    tasks: {},
    logs: [],
    desktopHeartbeats: {},
  };
  private isLoaded = false;
  private locks: Map<string, { lockedAt: number; lockedBy: string }> = new Map();

  constructor(customPath?: string) {
    const dataDir = customPath
      ? path.dirname(customPath)
      : path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.filePath = customPath || path.resolve(dataDir, "scheduled-tasks.json");
    this.load();
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.tasks === "object") {
          this.data = {
            version: 1,
            tasks: parsed.tasks || {},
            logs: Array.isArray(parsed.logs) ? parsed.logs : [],
            desktopHeartbeats: parsed.desktopHeartbeats || {},
          };
        }
      }
    } catch (err) {
      console.warn("[TaskStore] Could not load storage file, starting fresh:", err);
    }
    this.isLoaded = true;
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error("[TaskStore] Atomic persist error:", err);
    }
  }

  getTasks(ownerId?: string): ScheduledTaskRecord[] {
    this.load();
    const all = Object.values(this.data.tasks);
    if (!ownerId) return all;
    return all.filter((t) => t.ownerId === ownerId);
  }

  getTaskById(id: string, ownerId?: string): ScheduledTaskRecord | undefined {
    this.load();
    const task = this.data.tasks[id];
    if (!task) return undefined;
    if (ownerId && task.ownerId !== ownerId) return undefined;
    return task;
  }

  saveTask(task: ScheduledTaskRecord): ScheduledTaskRecord {
    this.load();
    const now = new Date().toISOString();
    const existing = this.data.tasks[task.id];
    const record: ScheduledTaskRecord = {
      ...task,
      createdAt: existing?.createdAt || task.createdAt || now,
      updatedAt: now,
    };
    this.data.tasks[task.id] = record;
    this.persist();
    return record;
  }

  deleteTask(id: string, ownerId?: string): boolean {
    this.load();
    const task = this.data.tasks[id];
    if (!task) return false;
    if (ownerId && task.ownerId !== ownerId) return false;

    delete this.data.tasks[id];
    this.locks.delete(id);
    this.data.logs = this.data.logs.filter((l) => l.taskId !== id);
    this.persist();
    return true;
  }

  appendLog(log: ScheduledTaskExecution): void {
    this.load();
    this.data.logs.unshift(log);
    if (this.data.logs.length > 500) {
      this.data.logs = this.data.logs.slice(0, 500);
    }
    this.persist();
  }

  getLogs(taskId: string, ownerId?: string): ScheduledTaskExecution[] {
    this.load();
    return this.data.logs.filter((l) => {
      if (l.taskId !== taskId) return false;
      if (ownerId && l.ownerId !== ownerId) return false;
      return true;
    });
  }

  recordDesktopHeartbeat(ownerId: string): void {
    this.load();
    this.data.desktopHeartbeats[ownerId] = Date.now();
    this.persist();
  }

  isDesktopOnline(ownerId: string, maxAgeMs = 70_000): boolean {
    this.load();
    const last = this.data.desktopHeartbeats[ownerId];
    if (!last) return false;
    return Date.now() - last < maxAgeMs;
  }

  acquireLock(taskId: string, lockedBy: string, timeoutMs = 60_000): boolean {
    const now = Date.now();
    const existing = this.locks.get(taskId);
    if (existing && now - existing.lockedAt < timeoutMs) {
      return false; // Still held by another worker
    }
    this.locks.set(taskId, { lockedAt: now, lockedBy });
    return true;
  }

  releaseLock(taskId: string): void {
    this.locks.delete(taskId);
  }

  clearAll(): void {
    this.data = {
      version: 1,
      tasks: {},
      logs: [],
      desktopHeartbeats: {},
    };
    this.locks.clear();
    this.persist();
  }
}

export const defaultTaskStore = new TaskStore();
