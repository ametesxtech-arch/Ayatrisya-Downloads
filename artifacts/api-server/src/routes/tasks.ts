import { Router, type IRouter, type Request, type Response } from 'express';
import { verifiedFirebaseUid } from '../lib/firebase-auth';
import { defaultTaskStore } from '../lib/task-store';
import { defaultTaskScheduler, isValidTimezone, calculateNextRun } from '../lib/task-scheduler';
import type {
  ScheduledTaskRecord,
  ScheduledTaskRecurrence,
  ScheduledTaskActionType,
  ExecutionTarget,
} from '../lib/task-types';

const router: IRouter = Router();

const authMessages = {
  missing: 'Sign in to Ayatrisya to manage scheduled tasks.',
  unavailable: 'Authentication service is not configured.',
  invalid: 'Your session has expired. Please sign in again.',
};

/**
 * GET /api/tasks
 * Lists all tasks owned by the authenticated user.
 */
router.get('/tasks', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const tasks = defaultTaskStore.getTasks(uid);
  res.json({ tasks });
});

/**
 * POST /api/tasks
 * Creates or activates a scheduled task for the authenticated user.
 */
router.post('/tasks', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 300) {
    res.status(400).json({ error: 'Title must be between 1 and 300 characters.' });
    return;
  }

  const timezone = typeof body.timezone === 'string' && isValidTimezone(body.timezone)
    ? body.timezone
    : 'UTC';

  const validRecurrences: ScheduledTaskRecurrence[] = [
    'one-time',
    'daily',
    'weekly',
    'weekdays',
    'monthly',
    'interval_days',
  ];
  const recurrence: ScheduledTaskRecurrence = validRecurrences.includes(body.recurrence)
    ? body.recurrence
    : 'one-time';

  const validActions: ScheduledTaskActionType[] = [
    'notification',
    'study_reminder',
    'task_summary',
    'practice_quiz',
    'project_status',
    'code_review',
    'custom',
  ];
  const actionType: ScheduledTaskActionType = validActions.includes(body.actionType)
    ? body.actionType
    : 'custom';

  const executionTarget: ExecutionTarget =
    body.executionTarget === 'desktop' ? 'desktop' : 'cloud';

  const taskId =
    typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const now = new Date().toISOString();
  const status = body.status === 'draft' ? 'draft' : 'active';

  let nextRunAt = body.nextRunAt || null;
  if (status === 'active' && !nextRunAt) {
    nextRunAt = calculateNextRun({
      recurrence,
      time: body.time || '09:00',
      timezone,
      daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : undefined,
      dayOfMonth: typeof body.dayOfMonth === 'number' ? body.dayOfMonth : undefined,
      startDate: body.startDate,
      endDate: body.endDate,
    });
  }

  const record: ScheduledTaskRecord = {
    id: taskId,
    ownerId: uid,
    title,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    status,
    recurrence,
    time: typeof body.time === 'string' ? body.time : '09:00',
    timezone,
    daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : undefined,
    dayOfMonth: typeof body.dayOfMonth === 'number' ? body.dayOfMonth : undefined,
    intervalDays: typeof body.intervalDays === 'number' ? body.intervalDays : undefined,
    startDate: body.startDate,
    endDate: body.endDate,
    nextRunAt,
    lastRunAt: null,
    lastExecution: null,
    actionType,
    actionPayload: typeof body.actionPayload === 'object' ? body.actionPayload : {},
    executionTarget,
    requiresConfirmation: Boolean(body.requiresConfirmation),
    retriesRemaining: 3,
    maxRetries: 3,
    retryIntervalMinutes: 5,
    createdAt: now,
    updatedAt: now,
  };

  const saved = defaultTaskStore.saveTask(record);
  res.status(201).json({ task: saved });
});

/**
 * GET /api/tasks/health
 * Scheduler health, uptime, and Render free-tier compatibility notes.
 */
router.get('/tasks/health', (_req: Request, res: Response) => {
  const allTasks = defaultTaskStore.getTasks();
  res.json({
    status: 'healthy',
    activeTasks: allTasks.filter((t) => t.status === 'active').length,
    totalTasks: allTasks.length,
    serverUptimeSeconds: Math.floor(process.uptime()),
    renderNote:
      'Render free instances spin down after 15 minutes of inactivity. For 24/7 background cron execution without paid services, configure a free external pinger (e.g. cron-job.org or UptimeRobot) targeting /api/tasks/tick, or use Ayatrisya Desktop runner.',
  });
});

/**
 * POST /api/tasks/tick
 * Webhook or external ping trigger to run scheduler pass and wake Render instance.
 */
router.post('/tasks/tick', async (_req: Request, res: Response) => {
  const result = await defaultTaskScheduler.tick();
  res.json({ ok: true, ...result });
});

/**
 * GET /api/tasks/tick
 * GET variant for external cron webhook services that only support GET.
 */
router.get('/tasks/tick', async (_req: Request, res: Response) => {
  const result = await defaultTaskScheduler.tick();
  res.json({ ok: true, ...result });
});

/**
 * POST /api/tasks/heartbeat
 * Heartbeat from Ayatrisya Desktop app to report that local runner is online.
 */
router.post('/tasks/heartbeat', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  defaultTaskStore.recordDesktopHeartbeat(uid);
  res.json({ ok: true, timestamp: Date.now() });
});

/**
 * GET /api/tasks/:id
 * Retrieves a single task owned by user.
 */
router.get('/tasks/:id', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = defaultTaskStore.getTaskById(id, uid);
  if (!task) {
    res.status(404).json({ error: 'Scheduled task not found.' });
    return;
  }
  res.json({ task });
});

/**
 * PATCH /api/tasks/:id
 * Updates or pauses/resumes a scheduled task.
 */
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = defaultTaskStore.getTaskById(id, uid);
  if (!existing) {
    res.status(404).json({ error: 'Scheduled task not found.' });
    return;
  }

  const body = req.body || {};
  const patch: Partial<ScheduledTaskRecord> = {};

  if (typeof body.title === 'string' && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.description === 'string') {
    patch.description = body.description.trim();
  }
  if (typeof body.time === 'string') {
    patch.time = body.time;
  }
  if (typeof body.timezone === 'string' && isValidTimezone(body.timezone)) {
    patch.timezone = body.timezone;
  }
  if (body.recurrence) {
    patch.recurrence = body.recurrence;
  }
  if (body.status) {
    patch.status = body.status;
    if (body.status === 'active' && !existing.nextRunAt) {
      patch.nextRunAt = calculateNextRun({
        ...existing,
        ...patch,
      });
    }
  }

  const updated = defaultTaskStore.saveTask({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  res.json({ task: updated });
});

/**
 * POST /api/tasks/:id/run
 * Manually executes a task immediately ("Run now").
 */
router.post('/tasks/:id/run', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = defaultTaskStore.getTaskById(id, uid);
  if (!task) {
    res.status(404).json({ error: 'Scheduled task not found.' });
    return;
  }

  try {
    const execution = await defaultTaskScheduler.executeTask(task);
    res.json({ execution });
  } catch (err) {
    res.status(500).json({
      error: `Execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Deletes task and history.
 */
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = defaultTaskStore.deleteTask(id, uid);
  if (!success) {
    res.status(404).json({ error: 'Scheduled task not found.' });
    return;
  }
  res.json({ ok: true, deletedId: id });
});

/**
 * GET /api/tasks/:id/history
 * Returns execution audit logs for a task.
 */
router.get('/tasks/:id/history', async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const logs = defaultTaskStore.getLogs(id, uid);
  res.json({ history: logs });
});

export default router;
