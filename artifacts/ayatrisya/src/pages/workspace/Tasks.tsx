import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  RotateCw,
  Bell,
  Monitor,
  Cloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { Button, inputCls } from '@/components/Primitives';
import type {
  ScheduledTaskData,
  ScheduledTaskRecurrence,
  ScheduledTaskActionType,
  ExecutionTarget,
} from '@/lib/scheduled-tasks/types';
import {
  calculateNextRun,
  describeRecurrence,
  getDefaultTimezone,
  isValidTimezone,
  formatInTimezone,
} from '@/lib/scheduled-tasks/schedule-engine';
import { parseScheduleRequest } from '@/lib/scheduled-tasks/schedule-parser';
import { taskClient } from '@/lib/scheduled-tasks/task-client';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  requestDesktopNotificationPermission,
  hasDesktopNotificationPermission,
  getInAppNotifications,
  clearAllNotifications,
  type AppNotification,
} from '@/lib/notifications';
import { ScheduledTaskBlockRenderer } from '@/components/interactive-blocks/ScheduledTaskBlockRenderer';

interface Props {
  goto: (href: string) => void;
  notify: (msg: string) => void;
}

const TEMPLATE_PROMPTS = [
  'Remind me to study Maths tomorrow at 6 PM',
  'Every morning at 7 AM, summarize my tasks',
  'Every Sunday, generate a practice quiz',
  'Check my project status every weekday',
  'Remind me to review this code in three days',
];

export function TasksPage({ notify }: Props) {
  const [tasks, setTasks] = useState<ScheduledTaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'failed'>('all');
  const [targetFilter, setTargetFilter] = useState<'all' | 'cloud' | 'desktop'>('all');

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<ScheduledTaskRecurrence>('daily');
  const [targetTime, setTargetTime] = useState('09:00');
  const [timezone, setTimezone] = useState(getDefaultTimezone());
  const [actionType, setActionType] = useState<ScheduledTaskActionType>('notification');
  const [executionTarget, setExecutionTarget] = useState<ExecutionTarget>('cloud');

  // Notifications drawer state
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasDesktopPerm, setHasDesktopPerm] = useState(false);

  useEffect(() => {
    setHasDesktopPerm(hasDesktopNotificationPermission());
    setNotifications(getInAppNotifications());

    const load = async () => {
      setLoading(true);
      try {
        const list = await taskClient.listTasks();
        setTasks(list);
      } catch (err) {
        console.warn('Could not load tasks:', err);
      } finally {
        setLoading(false);
      }
    };

    void load();
    return taskClient.subscribe(() => {
      void load();
    });
  }, []);

  const handleApplyNaturalLanguage = (promptText: string) => {
    const parsed = parseScheduleRequest(promptText, timezone);
    if (parsed.task) {
      setTitle(parsed.task.title);
      setDescription(parsed.task.description || '');
      setRecurrence(parsed.task.recurrence);
      setTargetTime(parsed.task.time || '09:00');
      setTimezone(parsed.task.timezone || getDefaultTimezone());
      setActionType(parsed.task.actionType);
      setExecutionTarget(parsed.task.executionTarget);
      notify('AI interpreted schedule parameters from prompt.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notify('Please enter a task title.');
      return;
    }

    const safeTz = isValidTimezone(timezone) ? timezone : getDefaultTimezone();
    const newTask: ScheduledTaskData = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      description: description.trim(),
      status: 'active',
      recurrence,
      time: targetTime,
      timezone: safeTz,
      actionType,
      executionTarget,
      retriesRemaining: 3,
      maxRetries: 3,
      retryIntervalMinutes: 5,
    };
    newTask.nextRunAt = calculateNextRun(newTask);

    try {
      await taskClient.saveTask(newTask);
      notify(`Schedule "${newTask.title}" activated.`);
      setShowCreateModal(false);
      // Reset form
      setTitle('');
      setDescription('');
      setNaturalPrompt('');
    } catch (err) {
      notify(`Failed to create task: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  const handleRequestDesktopPerm = async () => {
    const granted = await requestDesktopNotificationPermission();
    setHasDesktopPerm(granted);
    const prefs = getNotificationPreferences();
    saveNotificationPreferences({ ...prefs, desktop: granted });
    notify(granted ? 'Desktop notifications enabled.' : 'Desktop notifications permission denied.');
  };

  // Metrics computation
  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'active').length;
    const paused = tasks.filter((t) => t.status === 'paused').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failedOrMissed = tasks.filter((t) => t.status === 'failed' || t.status === 'missed').length;

    // Find next upcoming run
    const upcomingTasks = tasks
      .filter((t) => t.status === 'active' && t.nextRunAt)
      .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime());

    const nextUpcoming = upcomingTasks[0] || null;

    return {
      total: tasks.length,
      active,
      paused,
      completed,
      failedOrMissed,
      nextUpcoming,
    };
  }, [tasks]);

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'failed') {
          if (t.status !== 'failed' && t.status !== 'missed') return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }
      if (targetFilter !== 'all' && t.executionTarget !== targetFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, targetFilter, search]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8 space-y-6">
      {/* Page Heading */}
      <PageHeading
        eyebrow="Automation & Scheduler"
        title="Scheduled Tasks & Automation"
        description="Schedule reminders, quizzes, project summaries, and code checkpoints. Runs reliably in the cloud or via your native desktop runner."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNotifications(getInAppNotifications());
                setShowNotifDrawer(true);
              }}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
              title="In-app notification center"
            >
              <Bell size={16} />
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-black" />
              )}
            </button>
            <Button
              variant="solid"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold"
            >
              <Plus size={16} />
              New Schedule
            </Button>
          </div>
        }
      />

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/[.08] bg-[#12131a] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-slate-400">Total Tasks</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {stats.active} active • {stats.paused} paused
          </div>
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-[#12131a] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Clock size={13} className="text-violet-400" />
            Next Scheduled Run
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100 truncate">
            {stats.nextUpcoming?.nextRunAt
              ? formatInTimezone(stats.nextUpcoming.nextRunAt, stats.nextUpcoming.timezone)
              : 'None scheduled'}
          </div>
          <div className="mt-1 text-[11px] text-violet-300 truncate">
            {stats.nextUpcoming?.title || 'No active timers'}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-[#12131a] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            Completed
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{stats.completed}</div>
          <div className="mt-1 text-[11px] text-slate-500">One-time & cadence runs</div>
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-[#12131a] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <AlertCircle size={13} className="text-amber-400" />
            Failed / Missed
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{stats.failedOrMissed}</div>
          <div className="mt-1 text-[11px] text-slate-500">Offline desktop or errors</div>
        </div>
      </div>

      {/* Runner & Notifications Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-[#0f1017] p-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
          <span>Cloud Task Control Plane: <strong className="text-slate-200">Online</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRequestDesktopPerm}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
              hasDesktopPerm
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Bell size={12} />
            {hasDesktopPerm ? 'Desktop Notifications Active' : 'Enable Desktop Notifications'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[.08] bg-[#12131a] p-1 text-xs">
          {(['all', 'active', 'paused', 'completed', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-lg px-3 py-1 font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'failed' ? 'Failed / Missed' : tab}
            </button>
          ))}
        </div>

        {/* Search & Target Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schedules..."
              className="h-9 w-48 sm:w-64 rounded-xl border border-white/10 bg-[#12131a] pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value as 'all' | 'cloud' | 'desktop')}
            className="h-9 rounded-xl border border-white/10 bg-[#12131a] px-3 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All Targets</option>
            <option value="cloud">Cloud Plane</option>
            <option value="desktop">Desktop Runner</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 rounded-2xl border border-white/5 bg-white/[.02] animate-pulse" />
          <div className="h-44 rounded-2xl border border-white/5 bg-white/[.02] animate-pulse" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-white/[.08] bg-[#12131a] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-400 border border-violet-500/20">
            <Calendar size={24} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-200">
            {search ? 'No matching schedules found' : 'No scheduled tasks yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            {search
              ? 'Try modifying your search or filters.'
              : 'Create your first scheduled automation or pick one of the quick starter templates below:'}
          </p>

          {/* Quick starter templates */}
          <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {TEMPLATE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setNaturalPrompt(prompt);
                  handleApplyNaturalLanguage(prompt);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-violet-600/20 hover:border-violet-500/30 px-3 py-1.5 text-xs text-slate-300 hover:text-violet-200 transition-all text-left"
              >
                <Sparkles size={12} className="text-violet-400 shrink-0" />
                <span>&ldquo;{prompt}&rdquo;</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((t) => (
            <ScheduledTaskBlockRenderer
              key={t.id}
              block={{
                version: '1.0',
                type: 'scheduled_task',
                task: t,
              }}
              onUpdate={(updated) => {
                setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              }}
              onDelete={(id) => {
                setTasks((prev) => prev.filter((item) => item.id !== id));
                notify('Task deleted.');
              }}
            />
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12131a] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Calendar size={18} className="text-violet-400" />
                Schedule New Automation
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* AI Natural Language Bar */}
            <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5">
              <div className="text-[11px] font-semibold text-violet-300 flex items-center gap-1.5">
                <Sparkles size={13} />
                Natural Language Quick Schedule
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={naturalPrompt}
                  onChange={(e) => setNaturalPrompt(e.target.value)}
                  placeholder="e.g. Every morning at 7 AM, summarize my tasks"
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleApplyNaturalLanguage(naturalPrompt)}
                  className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  Interpret
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Task Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Study Maths, Daily Task Summary..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Additional context or notes..."
                  className="w-full rounded-lg border border-white/10 bg-[#0d0e12] px-3 py-2 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">Recurrence</label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as ScheduledTaskRecurrence)}
                    className={inputCls}
                  >
                    <option value="one-time">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays (Mon–Fri)</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">Time (24h)</label>
                  <input
                    type="time"
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">Action Type</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as ScheduledTaskActionType)}
                    className={inputCls}
                  >
                    <option value="notification">Notification / Alert</option>
                    <option value="study_reminder">Study Reminder</option>
                    <option value="task_summary">Task Summary</option>
                    <option value="practice_quiz">Practice Quiz Generator</option>
                    <option value="project_status">Project Health Check</option>
                    <option value="code_review">Code Review Reminder</option>
                    <option value="custom">Custom Automation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Execution Target</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setExecutionTarget('cloud')}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                      executionTarget === 'cloud'
                        ? 'border-violet-500 bg-violet-600/15 text-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Cloud size={14} className="text-cyan-400" />
                    <div className="text-left">
                      <div className="font-semibold text-[11px]">Cloud Plane</div>
                      <div className="text-[10px] text-slate-400">Runs independently</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExecutionTarget('desktop')}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                      executionTarget === 'desktop'
                        ? 'border-violet-500 bg-violet-600/15 text-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Monitor size={14} className="text-indigo-400" />
                    <div className="text-left">
                      <div className="font-semibold text-[11px]">Desktop Runner</div>
                      <div className="text-[10px] text-slate-400">Requires PC online</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[.08]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  variant="solid"
                  className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs"
                >
                  Activate Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {showNotifDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-[#12131a] border-l border-white/10 p-6 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[.08] pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Bell size={18} className="text-violet-400" />
                Notification Center
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllNotifications();
                      setNotifications([]);
                      notify('Notifications cleared.');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotifDrawer(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
              {notifications.length === 0 ? (
                <div className="text-center py-16 text-xs text-slate-500">
                  No notifications yet. Upcoming and executed task alerts will appear here.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-3 text-xs transition-colors ${
                      n.type === 'failed'
                        ? 'border-rose-500/20 bg-rose-950/20 text-rose-200'
                        : n.type === 'missed'
                        ? 'border-amber-500/20 bg-amber-950/20 text-amber-200'
                        : n.type === 'completed'
                        ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'
                        : 'border-white/10 bg-white/[.02] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-normal">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
