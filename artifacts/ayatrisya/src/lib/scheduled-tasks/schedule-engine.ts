import type { ScheduledTaskData, ScheduledTaskRecurrence } from './types';

/**
 * Validates whether an IANA timezone string is recognized by the runtime.
 */
export function isValidTimezone(tz?: string | null): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the system's local IANA timezone or fallback to 'UTC'.
 */
export function getDefaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimezone(tz)) return tz;
  } catch {
    // fallback
  }
  return 'UTC';
}

/**
 * Extracts year, month (1-12), day (1-31), hour (0-23), minute (0-59), dayOfWeek (0=Sun..6=Sat)
 * for a specific UTC date converted into the given timezone.
 */
export function getDateInTimezone(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
} {
  const safeTz = isValidTimezone(timeZone) ? timeZone : getDefaultTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const weekdayStr = partMap.weekday || '';
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdays[weekdayStr] ?? date.getUTCDay();

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour === '24' ? '0' : partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
    dayOfWeek,
  };
}

/**
 * Constructs a Date object representing the given calendar wall-clock time in the given timezone.
 * Handles DST transitions using two-pass convergence.
 */
export function createDateFromTimezone(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const safeTz = isValidTimezone(timeZone) ? timeZone : getDefaultTimezone();

  // Initial estimate assuming UTC
  const estimate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Determine wall clock time of estimate in the target timezone
  const inTz1 = getDateInTimezone(estimate, safeTz);
  const offset1 =
    Date.UTC(inTz1.year, inTz1.month - 1, inTz1.day, inTz1.hour, inTz1.minute, 0) -
    estimate.getTime();

  // Adjust estimate by offset
  const candidate = new Date(estimate.getTime() - offset1);

  // Check and refine if DST boundary shifted offset
  const inTz2 = getDateInTimezone(candidate, safeTz);
  const offset2 =
    Date.UTC(inTz2.year, inTz2.month - 1, inTz2.day, inTz2.hour, inTz2.minute, 0) -
    candidate.getTime();

  if (offset1 !== offset2) {
    return new Date(estimate.getTime() - offset2);
  }

  return candidate;
}

/**
 * Formats a date into human-readable string in the given timezone.
 */
export function formatInTimezone(
  dateOrIso: Date | string | null | undefined,
  timeZone: string,
  options: { includeTime?: boolean; includeSeconds?: boolean } = { includeTime: true }
): string {
  if (!dateOrIso) return 'Not scheduled';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return 'Invalid date';

  const safeTz = isValidTimezone(timeZone) ? timeZone : getDefaultTimezone();
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(options.includeTime
        ? {
            hour: 'numeric',
            minute: '2-digit',
            ...(options.includeSeconds ? { second: '2-digit' } : {}),
            hour12: true,
          }
        : {}),
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/**
 * Calculates the next run timestamp (ISO string) for a scheduled task.
 * Returns null if the task should not run again (e.g. one-time task that already ran,
 * or end date reached).
 */
export function calculateNextRun(
  task: Pick<
    ScheduledTaskData,
    | 'recurrence'
    | 'time'
    | 'timezone'
    | 'daysOfWeek'
    | 'dayOfMonth'
    | 'intervalDays'
    | 'startDate'
    | 'endDate'
    | 'nextRunAt'
  >,
  fromDate: Date = new Date()
): string | null {
  const tz = isValidTimezone(task.timezone) ? task.timezone : getDefaultTimezone();
  const [targetHour, targetMinute] = (task.time || '09:00')
    .split(':')
    .map((s) => parseInt(s, 10) || 0);

  // Check end date
  let endDateTime: Date | null = null;
  if (task.endDate) {
    const endParts = task.endDate.split('T')[0].split('-').map(Number);
    if (endParts.length === 3) {
      endDateTime = createDateFromTimezone(
        endParts[0],
        endParts[1],
        endParts[2],
        23,
        59,
        tz
      );
    }
  }

  const currentLocal = getDateInTimezone(fromDate, tz);

  // 1. One-time schedule
  if (task.recurrence === 'one-time') {
    if (task.startDate) {
      // Check if start date contains time or is YYYY-MM-DD
      if (task.startDate.includes('T')) {
        const d = new Date(task.startDate);
        if (d.getTime() > fromDate.getTime()) {
          return d.toISOString();
        }
        return null;
      }
      const [y, m, d] = task.startDate.split('-').map(Number);
      const scheduled = createDateFromTimezone(y, m, d, targetHour, targetMinute, tz);
      if (scheduled.getTime() > fromDate.getTime()) {
        return scheduled.toISOString();
      }
      return null;
    }
    // If nextRunAt was already set in future
    if (task.nextRunAt) {
      const existing = new Date(task.nextRunAt);
      if (existing.getTime() > fromDate.getTime()) {
        return existing.toISOString();
      }
    }
    return null;
  }

  // 2. Daily schedule
  if (task.recurrence === 'daily') {
    let candidate = createDateFromTimezone(
      currentLocal.year,
      currentLocal.month,
      currentLocal.day,
      targetHour,
      targetMinute,
      tz
    );

    // If today's slot already passed, schedule for tomorrow
    if (candidate.getTime() <= fromDate.getTime()) {
      candidate = new Date(candidate.getTime() + 24 * 3600 * 1000);
      const candLocal = getDateInTimezone(candidate, tz);
      candidate = createDateFromTimezone(
        candLocal.year,
        candLocal.month,
        candLocal.day,
        targetHour,
        targetMinute,
        tz
      );
    }

    if (endDateTime && candidate.getTime() > endDateTime.getTime()) return null;
    return candidate.toISOString();
  }

  // 3. Weekdays (Monday through Friday)
  if (task.recurrence === 'weekdays') {
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const testDate = new Date(fromDate.getTime() + dayOffset * 24 * 3600 * 1000);
      const testLocal = getDateInTimezone(testDate, tz);
      if (testLocal.dayOfWeek >= 1 && testLocal.dayOfWeek <= 5) {
        const candidate = createDateFromTimezone(
          testLocal.year,
          testLocal.month,
          testLocal.day,
          targetHour,
          targetMinute,
          tz
        );
        if (candidate.getTime() > fromDate.getTime()) {
          if (endDateTime && candidate.getTime() > endDateTime.getTime()) return null;
          return candidate.toISOString();
        }
      }
    }
    return null;
  }

  // 4. Weekly schedule
  if (task.recurrence === 'weekly') {
    const targetDays =
      task.daysOfWeek && task.daysOfWeek.length > 0 ? task.daysOfWeek : [currentLocal.dayOfWeek];

    let earliestCandidate: Date | null = null;
    for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
      const testDate = new Date(fromDate.getTime() + dayOffset * 24 * 3600 * 1000);
      const testLocal = getDateInTimezone(testDate, tz);
      if (targetDays.includes(testLocal.dayOfWeek)) {
        const candidate = createDateFromTimezone(
          testLocal.year,
          testLocal.month,
          testLocal.day,
          targetHour,
          targetMinute,
          tz
        );
        if (candidate.getTime() > fromDate.getTime()) {
          if (!earliestCandidate || candidate.getTime() < earliestCandidate.getTime()) {
            earliestCandidate = candidate;
          }
        }
      }
    }

    if (!earliestCandidate) return null;
    if (endDateTime && earliestCandidate.getTime() > endDateTime.getTime()) return null;
    return earliestCandidate.toISOString();
  }

  // 5. Monthly schedule
  if (task.recurrence === 'monthly') {
    const targetDay = Math.min(31, Math.max(1, task.dayOfMonth || currentLocal.day));

    // Try current month
    let candidate = createDateFromTimezone(
      currentLocal.year,
      currentLocal.month,
      targetDay,
      targetHour,
      targetMinute,
      tz
    );

    if (candidate.getTime() <= fromDate.getTime()) {
      // Try next month
      let nextMonth = currentLocal.month + 1;
      let nextYear = currentLocal.year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      candidate = createDateFromTimezone(
        nextYear,
        nextMonth,
        targetDay,
        targetHour,
        targetMinute,
        tz
      );
    }

    if (endDateTime && candidate.getTime() > endDateTime.getTime()) return null;
    return candidate.toISOString();
  }

  // 6. Interval days (e.g. every 3 days)
  if (task.recurrence === 'interval_days') {
    const interval = Math.max(1, task.intervalDays || 1);
    let candidate = createDateFromTimezone(
      currentLocal.year,
      currentLocal.month,
      currentLocal.day,
      targetHour,
      targetMinute,
      tz
    );

    if (candidate.getTime() <= fromDate.getTime()) {
      candidate = new Date(candidate.getTime() + interval * 24 * 3600 * 1000);
    }

    if (endDateTime && candidate.getTime() > endDateTime.getTime()) return null;
    return candidate.toISOString();
  }

  return null;
}

/**
 * Produces a human-friendly sentence describing the schedule recurrence.
 */
export function describeRecurrence(
  task: Pick<
    ScheduledTaskData,
    'recurrence' | 'time' | 'timezone' | 'daysOfWeek' | 'dayOfMonth' | 'intervalDays' | 'nextRunAt'
  >
): string {
  const timeStr = task.time || '09:00';
  const tzAbbr = task.timezone ? `(${task.timezone})` : '';

  switch (task.recurrence) {
    case 'one-time':
      return task.nextRunAt
        ? `Once on ${formatInTimezone(task.nextRunAt, task.timezone)} ${tzAbbr}`
        : 'One-time run';
    case 'daily':
      return `Every day at ${timeStr} ${tzAbbr}`;
    case 'weekdays':
      return `Every weekday (Mon–Fri) at ${timeStr} ${tzAbbr}`;
    case 'weekly': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNames = (task.daysOfWeek || [0]).map((d) => days[d]).join(', ');
      return `Every ${dayNames} at ${timeStr} ${tzAbbr}`;
    }
    case 'monthly':
      return `Every month on day ${task.dayOfMonth || 1} at ${timeStr} ${tzAbbr}`;
    case 'interval_days':
      return `Every ${task.intervalDays || 1} days at ${timeStr} ${tzAbbr}`;
    default:
      return 'Scheduled run';
  }
}

/**
 * Calculates exponential backoff retry time.
 */
export function calculateRetryDelay(
  retryCount: number,
  baseIntervalMinutes = 5,
  maxBackoffMinutes = 60
): number {
  const delayMinutes = Math.min(
    maxBackoffMinutes,
    baseIntervalMinutes * Math.pow(2, Math.max(0, retryCount))
  );
  return delayMinutes * 60 * 1000;
}
