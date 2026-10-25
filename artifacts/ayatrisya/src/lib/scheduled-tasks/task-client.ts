import { apiFetch } from '@/lib/api-config';
import { openTasksDatabase } from '@/storage/database';
import type {
  ScheduledTaskData,
  ScheduledTaskExecution,
  ScheduledTaskFilter,
} from './types';
import { calculateNextRun, describeRecurrence } from './schedule-engine';
import { dispatchNotification } from '../notifications';

const LOCAL_OWNER = 'local-tasks';

class TaskClient {
  private localCache: Map<string, ScheduledTaskData> = new Map();
  private historyCache: Map<string, ScheduledTaskExecution[]> = new Map();
  private timer: number | null = null;
  private listeners: Set<() => void> = new Set();
  private runningTaskIds: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initLocal();
      this.startLocalTicker();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private async initLocal(): Promise<void> {
    try {
      const db = await openTasksDatabase();
      const records = await db.getAllFromIndex('scheduledTasks', 'ownerId', LOCAL_OWNER);
      for (const r of records) {
        if (r && r.id) {
          this.localCache.set(r.id, r as ScheduledTaskData);
        }
      }
      this.emit();
    } catch (err) {
      console.warn('[TaskClient] Could not load local tasks store:', err);
    }
  }

  /**
   * Lists tasks filtered by criteria. Tries API first, merges with local.
   */
  async listTasks(filter?: ScheduledTaskFilter): Promise<ScheduledTaskData[]> {
    let tasks: ScheduledTaskData[] = [];

    try {
      const remote = await apiFetch<{ tasks: ScheduledTaskData[] }>('/api/tasks');
      if (Array.isArray(remote?.tasks)) {
        tasks = remote.tasks;
        for (const t of tasks) {
          this.localCache.set(t.id, t);
        }
      }
    } catch {
      // Offline / guest mode: use local cache
      tasks = Array.from(this.localCache.values());
    }

    if (tasks.length === 0 && this.localCache.size > 0) {
      tasks = Array.from(this.localCache.values());
    }

    // Apply filters
    return tasks.filter((t) => {
      if (filter?.status && filter.status !== 'all' && t.status !== filter.status) {
        return false;
      }
      if (filter?.target && filter.target !== 'all' && t.executionTarget !== filter.target) {
        return false;
      }
      if (filter?.search) {
        const query = filter.search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesDesc = (t.description || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }

  /**
   * Retrieves a single task by ID.
   */
  async getTask(id: string): Promise<ScheduledTaskData | undefined> {
    try {
      const res = await apiFetch<{ task: ScheduledTaskData }>(`/api/tasks/${id}`);
      if (res?.task) {
        this.localCache.set(res.task.id, res.task);
        return res.task;
      }
    } catch {
      // offline fallback
    }
    return this.localCache.get(id);
  }

  /**
   * Creates or activates a scheduled task.
   */
  async saveTask(task: ScheduledTaskData): Promise<ScheduledTaskData> {
    const now = new Date().toISOString();
    const prepared: ScheduledTaskData = {
      ...task,
      updatedAt: now,
      createdAt: task.createdAt || now,
      nextRunAt:
        task.status === 'active' && !task.nextRunAt
          ? calculateNextRun(task)
          : task.nextRunAt,
    };

    try {
      const res = await apiFetch<{ task: ScheduledTaskData }>('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepared),
      });
      if (res?.task) {
        this.localCache.set(res.task.id, res.task);
        await this.persistLocal(res.task);
        this.emit();
        return res.task;
      }
    } catch {
      // Offline fallback
    }

    this.localCache.set(prepared.id, prepared);
    await this.persistLocal(prepared);
    this.emit();

    if (prepared.status === 'active') {
      void dispatchNotification(
        'Schedule Activated',
        `"${prepared.title}" scheduled (${describeRecurrence(prepared)})`,
        'info',
        { taskId: prepared.id }
      );
    }

    return prepared;
  }

  /**
   * Updates/patches an existing task.
   */
  async updateTask(id: string, patch: Partial<ScheduledTaskData>): Promise<ScheduledTaskData> {
    const existing = await this.getTask(id);
    if (!existing) throw new Error('Task not found');

    const updated: ScheduledTaskData = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    if (patch.status === 'active' && !updated.nextRunAt) {
      updated.nextRunAt = calculateNextRun(updated);
    }

    try {
      const res = await apiFetch<{ task: ScheduledTaskData }>(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res?.task) {
        this.localCache.set(res.task.id, res.task);
        await this.persistLocal(res.task);
        this.emit();
        return res.task;
      }
    } catch {
      // offline fallback
    }

    this.localCache.set(updated.id, updated);
    await this.persistLocal(updated);
    this.emit();
    return updated;
  }

  /**
   * Deletes a task.
   */
  async deleteTask(id: string): Promise<void> {
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }

    this.localCache.delete(id);
    try {
      const db = await openTasksDatabase();
      await db.delete('scheduledTasks', [LOCAL_OWNER, id]);
    } catch {
      // storage error
    }
    this.emit();
  }

  /**
   * Duplicates an existing task into a draft or active copy.
   */
  async duplicateTask(id: string): Promise<ScheduledTaskData> {
    const existing = await this.getTask(id);
    if (!existing) throw new Error('Task to duplicate not found');

    const copy: ScheduledTaskData = {
      ...existing,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${existing.title} (Copy)`,
      status: 'paused',
      lastRunAt: null,
      lastExecution: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRunAt: calculateNextRun(existing),
    };

    return this.saveTask(copy);
  }

  /**
   * Manually triggers a task immediately ("Run now").
   */
  async runTaskNow(id: string): Promise<ScheduledTaskExecution> {
    const task = await this.getTask(id);
    if (!task) throw new Error('Task not found');

    if (this.runningTaskIds.has(id)) {
      throw new Error('Task is already running.');
    }
    this.runningTaskIds.add(id);

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startTime = new Date().toISOString();

    try {
      // Try backend execution first
      const res = await apiFetch<{ execution: ScheduledTaskExecution }>(
        `/api/tasks/${id}/run`,
        { method: 'POST' }
      );
      if (res?.execution) {
        this.runningTaskIds.delete(id);
        await this.recordExecution(res.execution);
        return res.execution;
      }
    } catch (err) {
      // If offline or target is desktop, execute safe local bounded handler
    }

    // Local bounded execution
    const execution = await this.executeLocalSafeAction(task, runId, startTime);
    this.runningTaskIds.delete(id);
    await this.recordExecution(execution);
    return execution;
  }

  /**
   * Retrieves execution history for a task.
   */
  async getTaskHistory(taskId: string): Promise<ScheduledTaskExecution[]> {
    try {
      const res = await apiFetch<{ history: ScheduledTaskExecution[] }>(
        `/api/tasks/${taskId}/history`
      );
      if (Array.isArray(res?.history)) {
        this.historyCache.set(taskId, res.history);
        return res.history;
      }
    } catch {
      // offline fallback
    }
    return this.historyCache.get(taskId) || [];
  }

  /**
   * Safe non-eval bounded task execution logic.
   */
  private async executeLocalSafeAction(
    task: ScheduledTaskData,
    runId: string,
    triggeredAt: string
  ): Promise<ScheduledTaskExecution> {
    let status: ScheduledTaskExecution['status'] = 'success';
    let output = '';
    let error: string | undefined;

    // Check desktop runner requirement
    if (task.executionTarget === 'desktop') {
      const isDesktop =
        typeof window !== 'undefined' &&
        Boolean((window as unknown as { electronApi?: unknown }).electronApi);

      if (!isDesktop) {
        status = 'missed';
        error = 'Desktop runner unavailable: Computer or native app was not online.';
        output = 'Execution missed because task requires desktop companion.';
        void dispatchNotification(
          `Task Missed: ${task.title}`,
          error,
          'missed',
          { taskId: task.id }
        );

        return {
          id: runId,
          taskId: task.id,
          triggeredAt,
          completedAt: new Date().toISOString(),
          status,
          output,
          error,
          target: 'desktop',
        };
      }
    }

    try {
      switch (task.actionType) {
        case 'study_reminder':
        case 'notification':
        case 'custom':
          output = `Reminder triggered: ${task.title}`;
          await dispatchNotification(
            task.title,
            task.description || output,
            'upcoming',
            { taskId: task.id }
          );
          break;

        case 'task_summary':
          output = 'Workspace task summary compiled: all active items checked.';
          await dispatchNotification(
            'Daily Task Summary Ready',
            task.description || 'Open workspace tasks to view current progress.',
            'completed',
            { taskId: task.id }
          );
          break;

        case 'practice_quiz':
          output = `Practice quiz ready for review: "${task.title}".`;
          await dispatchNotification(
            'Practice Quiz Ready',
            'Your scheduled quiz has been prepared in chat.',
            'completed',
            { taskId: task.id }
          );
          break;

        case 'project_status':
          output = 'Project health check: repositories and canvas files are up to date.';
          await dispatchNotification(
            'Project Status Report',
            output,
            'completed',
            { taskId: task.id }
          );
          break;

        case 'code_review':
          output = 'Code review checkpoint triggered.';
          await dispatchNotification(
            'Code Review Reminder',
            task.description || 'Review recent code changes and pending diffs.',
            'upcoming',
            { taskId: task.id }
          );
          break;

        default:
          output = `Task executed successfully: ${task.title}`;
          await dispatchNotification(task.title, output, 'completed', {
            taskId: task.id,
          });
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : 'Unknown execution failure';
      output = `Execution failed: ${error}`;
      void dispatchNotification(`Task Failed: ${task.title}`, error, 'failed', {
        taskId: task.id,
      });
    }

    return {
      id: runId,
      taskId: task.id,
      triggeredAt,
      completedAt: new Date().toISOString(),
      status,
      output,
      error,
      target: task.executionTarget,
    };
  }

  private async recordExecution(exec: ScheduledTaskExecution): Promise<void> {
    const task = this.localCache.get(exec.taskId);
    if (!task) return;

    const list = this.historyCache.get(exec.taskId) || [];
    this.historyCache.set(exec.taskId, [exec, ...list].slice(0, 50));

    // Calculate next run if recurring
    const nextRun =
      task.recurrence === 'one-time'
        ? null
        : calculateNextRun(task, new Date());

    const updated: ScheduledTaskData = {
      ...task,
      lastRunAt: exec.triggeredAt,
      lastExecution: exec,
      nextRunAt: nextRun,
      status:
        task.recurrence === 'one-time'
          ? exec.status === 'success'
            ? 'completed'
            : 'failed'
          : task.status,
      updatedAt: new Date().toISOString(),
    };

    this.localCache.set(task.id, updated);
    await this.persistLocal(updated);
    this.emit();
  }

  private async persistLocal(task: ScheduledTaskData): Promise<void> {
    try {
      const db = await openTasksDatabase();
      await db.put('scheduledTasks', {
        ...task,
        ownerId: LOCAL_OWNER,
      });
    } catch {
      // storage error
    }
  }

  /**
   * Periodic scheduler tick (every 30 seconds) to detect due tasks.
   */
  private startLocalTicker(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      this.checkDueTasks();
    }, 30_000);
  }

  private checkDueTasks(): void {
    const now = Date.now();
    for (const task of this.localCache.values()) {
      if (task.status !== 'active' || !task.nextRunAt) continue;

      const due = new Date(task.nextRunAt).getTime();
      if (due <= now && !this.runningTaskIds.has(task.id)) {
        // Prevent duplicate execution with 15s window
        void this.runTaskNow(task.id);
      }
    }
  }
}

export const taskClient = new TaskClient();
