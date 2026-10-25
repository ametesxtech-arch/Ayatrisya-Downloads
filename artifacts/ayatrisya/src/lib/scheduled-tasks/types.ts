export type ScheduledTaskStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'missed';

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
  triggeredAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'missed' | 'skipped';
  output?: string;
  error?: string;
  target: ExecutionTarget;
}

export interface ScheduledTaskData {
  id: string;
  ownerId?: string;
  title: string;
  description?: string;
  status: ScheduledTaskStatus;
  recurrence: ScheduledTaskRecurrence;
  time?: string; // "HH:mm" in 24h format
  timezone: string; // IANA timezone e.g. "Asia/Kolkata", "America/New_York", "UTC"
  daysOfWeek?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  dayOfMonth?: number; // 1-31
  intervalDays?: number; // e.g. 3 for every 3 days
  startDate?: string; // ISO date string (YYYY-MM-DD or full ISO)
  endDate?: string; // ISO date string
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
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduledTaskFilter {
  status?: ScheduledTaskStatus | 'all';
  target?: ExecutionTarget | 'all';
  search?: string;
}
