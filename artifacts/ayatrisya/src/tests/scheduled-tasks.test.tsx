import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseScheduleRequest } from '@/lib/scheduled-tasks/schedule-parser';
import {
  calculateNextRun,
  describeRecurrence,
  calculateRetryDelay,
  isValidTimezone,
  formatInTimezone,
} from '@/lib/scheduled-tasks/schedule-engine';
import { parseInteractiveBlock } from '@/components/interactive-blocks/schema';
import { ScheduledTaskBlockRenderer } from '@/components/interactive-blocks/ScheduledTaskBlockRenderer';
import type { ScheduledTaskData } from '@/lib/scheduled-tasks/types';

describe('Scheduled Tasks & Automation System', () => {
  describe('Natural Language Schedule Parser', () => {
    it('interprets "Remind me to study Maths tomorrow at 6 PM."', () => {
      const res = parseScheduleRequest('Remind me to study Maths tomorrow at 6 PM.', 'Asia/Kolkata');
      expect(res.isScheduleIntent).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task?.title).toContain('Study Maths');
      expect(res.task?.recurrence).toBe('one-time');
      expect(res.task?.time).toBe('18:00');
      expect(res.task?.actionType).toBe('study_reminder');
      expect(res.task?.status).toBe('draft');
      expect(res.task?.requiresConfirmation).toBe(true);
    });

    it('interprets "Every morning at 7 AM, summarize my tasks."', () => {
      const res = parseScheduleRequest('Every morning at 7 AM, summarize my tasks.', 'UTC');
      expect(res.isScheduleIntent).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task?.recurrence).toBe('daily');
      expect(res.task?.time).toBe('07:00');
      expect(res.task?.actionType).toBe('task_summary');
      expect(res.task?.status).toBe('draft');
    });

    it('interprets "Every Sunday, generate a practice quiz."', () => {
      const res = parseScheduleRequest('Every Sunday, generate a practice quiz.', 'America/New_York');
      expect(res.isScheduleIntent).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task?.recurrence).toBe('weekly');
      expect(res.task?.daysOfWeek).toEqual([0]); // Sunday is 0
      expect(res.task?.actionType).toBe('practice_quiz');
    });

    it('interprets "Check my project status every weekday."', () => {
      const res = parseScheduleRequest('Check my project status every weekday.', 'UTC');
      expect(res.isScheduleIntent).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task?.recurrence).toBe('weekdays');
      expect(res.task?.actionType).toBe('project_status');
    });

    it('interprets "Remind me to review this code in three days."', () => {
      const res = parseScheduleRequest('Remind me to review this code in three days.', 'UTC');
      expect(res.isScheduleIntent).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task?.recurrence).toBe('one-time');
      expect(res.task?.actionType).toBe('code_review');
      expect(res.task?.startDate).toBeDefined();
    });

    it('flags desktop requirement when local machine is mentioned', () => {
      const res = parseScheduleRequest('Run local tests on this desktop every weekday at 10 AM', 'UTC');
      expect(res.isScheduleIntent).toBe(true);
      expect(res.task?.executionTarget).toBe('desktop');
    });

    it('returns isScheduleIntent: false for non-scheduling prompts', () => {
      const res = parseScheduleRequest('What is the capital of France?');
      expect(res.isScheduleIntent).toBe(false);
      expect(res.task).toBeUndefined();
    });
  });

  describe('Schedule Math & Timezone Engine', () => {
    it('validates IANA timezones and rejects invalid ones', () => {
      expect(isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });

    it('formats dates accurately in specified timezone', () => {
      const d = new Date('2026-10-25T12:00:00Z');
      const formatted = formatInTimezone(d, 'UTC');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('12:00');
    });

    it('computes daily nextRunAt in future', () => {
      const base = new Date('2026-10-25T10:00:00Z');
      const next = calculateNextRun(
        {
          recurrence: 'daily',
          time: '18:00',
          timezone: 'UTC',
        },
        base
      );
      expect(next).toBeDefined();
      const nextDate = new Date(next!);
      expect(nextDate.getTime()).toBeGreaterThan(base.getTime());
      expect(nextDate.getUTCHours()).toBe(18);
    });

    it('computes weekdays nextRunAt correctly', () => {
      // Friday evening -> should schedule for Monday
      const friday = new Date('2026-10-23T20:00:00Z');
      const next = calculateNextRun(
        {
          recurrence: 'weekdays',
          time: '09:00',
          timezone: 'UTC',
        },
        friday
      );
      expect(next).toBeDefined();
      const nextDate = new Date(next!);
      expect(nextDate.getUTCDay()).toBeGreaterThanOrEqual(1);
      expect(nextDate.getUTCDay()).toBeLessThanOrEqual(5);
    });

    it('calculates exponential backoff delay for retries', () => {
      const delay0 = calculateRetryDelay(0, 5); // 5 mins = 300,000 ms
      const delay1 = calculateRetryDelay(1, 5); // 10 mins = 600,000 ms
      const delay2 = calculateRetryDelay(2, 5); // 20 mins = 1,200,000 ms
      expect(delay0).toBe(300_000);
      expect(delay1).toBe(600_000);
      expect(delay2).toBe(1_200_000);
    });

    it('generates friendly recurrence descriptions', () => {
      expect(describeRecurrence({ recurrence: 'daily', time: '08:00', timezone: 'UTC' })).toContain(
        'Every day at 08:00'
      );
      expect(describeRecurrence({ recurrence: 'weekdays', time: '09:30', timezone: 'UTC' })).toContain(
        'Every weekday (Mon–Fri) at 09:30'
      );
      expect(
        describeRecurrence({ recurrence: 'weekly', daysOfWeek: [0], time: '10:00', timezone: 'UTC' })
      ).toContain('Every Sun at 10:00');
    });
  });

  describe('Interactive Block Schema Validation', () => {
    it('successfully parses a scheduled_task block', () => {
      const raw = JSON.stringify({
        version: '1.0',
        type: 'scheduled_task',
        task: {
          id: 'test-task-1',
          title: 'Study Mathematics',
          description: 'Calculus review session',
          status: 'draft',
          recurrence: 'one-time',
          time: '18:00',
          timezone: 'Asia/Kolkata',
          actionType: 'study_reminder',
          executionTarget: 'cloud',
          requiresConfirmation: true,
        },
      });

      const res = parseInteractiveBlock(raw);
      expect(res.status).toBe('valid');
      if (res.status === 'valid' && res.block.type === 'scheduled_task') {
        expect(res.block.type).toBe('scheduled_task');
        expect(res.block.task.title).toBe('Study Mathematics');
        expect(res.block.task.status).toBe('draft');
      }
    });

    it('rejects invalid scheduled task schema gracefully', () => {
      const raw = JSON.stringify({
        version: '1.0',
        type: 'scheduled_task',
        task: {
          // missing title and timezone
          status: 'invalid_status',
        },
      });
      const res = parseInteractiveBlock(raw);
      expect(res.status).toBe('invalid');
    });
  });

  describe('ScheduledTaskBlockRenderer Component', () => {
    const sampleTask: ScheduledTaskData = {
      id: 'task-123',
      title: 'Summarize Daily Tasks',
      description: 'Collects pending workspace items at 7 AM',
      status: 'active',
      recurrence: 'daily',
      time: '07:00',
      timezone: 'UTC',
      nextRunAt: '2026-10-26T07:00:00Z',
      actionType: 'task_summary',
      executionTarget: 'cloud',
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '2026-10-25T10:00:00Z',
    };

    it('renders task card with title, cadence, controls, and next run', () => {
      const html = renderToStaticMarkup(
        <ScheduledTaskBlockRenderer
          block={{
            version: '1.0',
            type: 'scheduled_task',
            task: sampleTask,
          }}
        />
      );

      expect(html).toContain('Summarize Daily Tasks');
      expect(html).toContain('Cloud Plane');
      expect(html).toContain('Active Schedule');
      expect(html).toContain('Run now');
      expect(html).toContain('Pause');
      expect(html).toContain('Edit');
      expect(html).toContain('Delete');
      expect(html).toContain('Schedule Cadence');
    });

    it('renders confirmation callout when status is draft', () => {
      const draftTask: ScheduledTaskData = {
        ...sampleTask,
        status: 'draft',
        requiresConfirmation: true,
      };

      const html = renderToStaticMarkup(
        <ScheduledTaskBlockRenderer
          block={{
            version: '1.0',
            type: 'scheduled_task',
            task: draftTask,
          }}
        />
      );

      expect(html).toContain('Confirmation Required Before Activation');
      expect(html).toContain('Activate Schedule');
      expect(html).toContain('Edit Details');
    });

    it('renders desktop runner badge and warning when target is desktop', () => {
      const desktopTask: ScheduledTaskData = {
        ...sampleTask,
        executionTarget: 'desktop',
      };

      const html = renderToStaticMarkup(
        <ScheduledTaskBlockRenderer
          block={{
            version: '1.0',
            type: 'scheduled_task',
            task: desktopTask,
          }}
        />
      );

      expect(html).toContain('Desktop Runner');
      expect(html).toContain('Desktop Runner Required');
      expect(html).toContain('marked as missed');
    });
  });
});
