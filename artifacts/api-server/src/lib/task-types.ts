export type ScheduledTaskStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'missed';

export type ScheduledTaskRecurrence =
  | 'one-time'
  | 'daily'
  | 'weekly'
  | 'weekdays'
  | 'monthly'
  | 'interval_days';

export type ScheduledTaskActionType =
  | 'notification'
  | 'study_reminder'
  | 'task_summary'
  | 'practice_quiz'
  | 'project_status'
  | 'code_review'
  | 'custom';

export type ExecutionTarget = 'cloud' | 'desktop';

export interface ScheduledTaskExecution {
  id: string;
  taskId: string;
  ownerId: string;
  triggeredAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'missed' | 'skipped';
  output?: string;
  error?: string;
  target: ExecutionTarget;
}

export interface ScheduledTaskRecord {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  status: ScheduledTaskStatus;
  recurrence: ScheduledTaskRecurrence;
  time?: string; // "HH:mm" in 24-hour format
  timezone: string; // IANA timezone, e.g. "Asia/Kolkata", "America/New_York", "UTC"
  daysOfWeek?: number[]; // 0 = Sun, 1 = Mon ...
  dayOfMonth?: number; // 1-31
  intervalDays?: number; // for interval_days
  startDate?: string;
  endDate?: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastExecution?: ScheduledTaskExecution | null;
  actionType: ScheduledTaskActionType;
  actionPayload?: Record<string, unknown>;
  executionTarget: ExecutionTarget;
  requiresConfirmation?: boolean;
  retriesRemaining?: number;
  maxRetries?: number;
  retryIntervalMinutes?: number;
  lockedAt?: number | null;
  lockedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}
