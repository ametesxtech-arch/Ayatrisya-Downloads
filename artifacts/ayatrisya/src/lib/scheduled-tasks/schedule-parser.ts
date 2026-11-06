import type {
  ScheduledTaskActionType,
  ScheduledTaskData,
  ScheduledTaskRecurrence,
  ExecutionTarget,
} from './types';
import {
  calculateNextRun,
  createDateFromTimezone,
  getDateInTimezone,
  getDefaultTimezone,
  isValidTimezone,
} from './schedule-engine';

export interface ParsedScheduleResult {
  isScheduleIntent: boolean;
  task?: ScheduledTaskData;
  confidence: 'high' | 'medium' | 'low';
  rawPrompt: string;
}

const wordToNumber: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const dayNameToNumber: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/**
 * Parses natural language input strings to detect scheduling requests.
 */
export function parseScheduleRequest(
  prompt: string,
  userTimezone?: string
): ParsedScheduleResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const tz = isValidTimezone(userTimezone) ? userTimezone! : getDefaultTimezone();

  // Quick check for schedule intent
  const scheduleKeywords = [
    'remind me',
    'schedule',
    'every morning',
    'every day',
    'every evening',
    'every night',
    'every sunday',
    'every monday',
    'every tuesday',
    'every wednesday',
    'every thursday',
    'every friday',
    'every saturday',
    'every weekday',
    'every weekend',
    'tomorrow at',
    'in three days',
    'in 3 days',
    'in two days',
    'in 2 days',
    'in a week',
    'daily at',
    'weekly on',
    'every week',
    'every month',
  ];

  const hasIntent =
    scheduleKeywords.some((k) => lower.includes(k)) ||
    /\b(every|remind|schedule|at \d{1,2}(:\d{2})?\s*(am|pm)?)\b/i.test(lower);

  if (!hasIntent) {
    return { isScheduleIntent: false, confidence: 'low', rawPrompt: text };
  }

  let recurrence: ScheduledTaskRecurrence = 'one-time';
  let targetTime = '09:00'; // Default 9 AM
  let daysOfWeek: number[] | undefined;
  let intervalDays: number | undefined = undefined;
  let startDate: string | undefined;
  let actionType: ScheduledTaskActionType = 'custom';
  let executionTarget: ExecutionTarget = 'cloud';
  let title: string;
  let description = text;

  // 1. Time extraction (e.g., "at 6 PM", "at 7 AM", "at 18:00", "at 9:30 am", "morning", "evening")
  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = (timeMatch[3] || '').toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    targetTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  } else if (/\bmorning\b/i.test(lower)) {
    targetTime = '07:00';
  } else if (/\bevening\b/i.test(lower)) {
    targetTime = '18:00';
  } else if (/\bnight\b/i.test(lower)) {
    targetTime = '21:00';
  } else if (/\bafternoon\b/i.test(lower)) {
    targetTime = '14:00';
  }

  const now = new Date();
  const currentInTz = getDateInTimezone(now, tz);

  // 2. Recurrence detection
  if (/\bevery weekday\b/i.test(lower) || /\bweekdays\b/i.test(lower)) {
    recurrence = 'weekdays';
    daysOfWeek = [1, 2, 3, 4, 5];
  } else if (/\bevery (?:morning|day|evening|night)\b/i.test(lower) || /\bdaily\b/i.test(lower)) {
    recurrence = 'daily';
  } else if (
    /\bevery (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(lower) ||
    /\bweekly\b/i.test(lower)
  ) {
    recurrence = 'weekly';
    const dayMatch = lower.match(/\bevery (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch && dayNameToNumber[dayMatch[1].toLowerCase()] !== undefined) {
      daysOfWeek = [dayNameToNumber[dayMatch[1].toLowerCase()]];
    } else {
      daysOfWeek = [0]; // default Sunday
    }
  } else if (/\bevery month\b/i.test(lower) || /\bmonthly\b/i.test(lower)) {
    recurrence = 'monthly';
  } else if (/\btomorrow\b/i.test(lower)) {
    recurrence = 'one-time';
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomLocal = getDateInTimezone(tomorrow, tz);
    startDate = `${tomLocal.year}-${String(tomLocal.month).padStart(2, '0')}-${String(
      tomLocal.day
    ).padStart(2, '0')}`;
  } else {
    // Relative days: e.g. "in three days", "in 3 days"
    const inDaysMatch = lower.match(/\bin\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/i);
    if (inDaysMatch) {
      const rawNum = inDaysMatch[1].toLowerCase();
      const numDays = wordToNumber[rawNum] ?? parseInt(rawNum, 10) ?? 3;
      recurrence = 'one-time';
      const targetDate = new Date(now.getTime() + numDays * 24 * 3600 * 1000);
      const targetLocal = getDateInTimezone(targetDate, tz);
      startDate = `${targetLocal.year}-${String(targetLocal.month).padStart(2, '0')}-${String(
        targetLocal.day
      ).padStart(2, '0')}`;
    }
  }

  // 3. Action Type & Title Extraction
  if (/\b(?:summarize|summary)\s+(?:my\s+)?tasks?\b/i.test(lower)) {
    actionType = 'task_summary';
    title = 'Summarize daily tasks';
    description = 'Summarizes pending workspace tasks, deadlines, and active priority items.';
  } else if (/\b(?:practice\s+)?quiz\b/i.test(lower)) {
    actionType = 'practice_quiz';
    const topicMatch = text.match(/quiz\s+(?:on|about|for)\s+([^.,\n]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : 'General Knowledge';
    title = `Practice Quiz: ${topic}`;
    description = `Generates an interactive practice quiz on ${topic}.`;
  } else if (/\bproject\s+status\b/i.test(lower)) {
    actionType = 'project_status';
    title = 'Check project status';
    description = 'Evaluates recent project progress, commits, open canvas items, and milestones.';
  } else if (/\b(?:review\s+this\s+code|code\s+review)\b/i.test(lower)) {
    actionType = 'code_review';
    title = 'Review code and canvas';
    description = 'Reviews active code canvas revisions, diffs, and pending pull requests.';
  } else if (/\bstudy\s+([^.,\n]+)/i.test(lower)) {
    actionType = 'study_reminder';
    const studyMatch = text.match(/study\s+([^.,\n]+?)(?:\s+(?:tomorrow|every|at\b|$))/i);
    const subject = studyMatch ? studyMatch[1].trim() : 'Maths';
    title = `Study ${subject}`;
    description = `Study session reminder for ${subject}.`;
  } else {
    // Extract reminder phrase: "remind me to <do something>"
    const remindMatch = text.match(/remind(?:\s+me)?\s+to\s+([^.,\n]+?)(?:\s+(?:tomorrow|every|at\b|$))/i);
    if (remindMatch) {
      const verbPhrase = remindMatch[1].trim();
      title = verbPhrase.charAt(0).toUpperCase() + verbPhrase.slice(1);
      description = `Reminder: ${verbPhrase}`;
      actionType = 'notification';
    } else {
      title = text.length > 50 ? `${text.slice(0, 47)}...` : text;
    }
  }

  // 4. Desktop target check
  if (
    /\b(?:desktop|local computer|this pc|local machine|local files|native runner)\b/i.test(lower)
  ) {
    executionTarget = 'desktop';
  }

  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nextRunAt = calculateNextRun(
    {
      recurrence,
      time: targetTime,
      timezone: tz,
      daysOfWeek,
      startDate,
    },
    now
  );

  const taskData: ScheduledTaskData = {
    id: taskId,
    title,
    description,
    status: 'draft', // Confirmation card before activating
    recurrence,
    time: targetTime,
    timezone: tz,
    daysOfWeek,
    intervalDays,
    startDate,
    nextRunAt,
    actionType,
    actionPayload: {
      originalPrompt: text,
      targetTime,
    },
    executionTarget,
    requiresConfirmation: true,
    retriesRemaining: 3,
    maxRetries: 3,
    retryIntervalMinutes: 5,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    isScheduleIntent: true,
    task: taskData,
    confidence: 'high',
    rawPrompt: text,
  };
}
