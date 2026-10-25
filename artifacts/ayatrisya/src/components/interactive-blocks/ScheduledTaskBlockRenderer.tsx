import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Copy,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCw,
  Monitor,
  Cloud,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import type { ScheduledTaskBlock } from './types';
import type {
  ScheduledTaskData,
  ScheduledTaskExecution,
  ScheduledTaskRecurrence,
} from '@/lib/scheduled-tasks/types';
import {
  describeRecurrence,
  formatInTimezone,
  isValidTimezone,
  getDefaultTimezone,
  calculateNextRun,
} from '@/lib/scheduled-tasks/schedule-engine';
import { taskClient } from '@/lib/scheduled-tasks/task-client';

interface Props {
  block: ScheduledTaskBlock;
  blockId?: string;
  onUpdate?: (updated: ScheduledTaskData) => void;
  onDelete?: (id: string) => void;
}

export function ScheduledTaskBlockRenderer({ block, onUpdate, onDelete }: Props) {
  const [task, setTask] = useState<ScheduledTaskData>(block.task);
  const [isRunning, setIsRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScheduledTaskExecution[]>(block.history || []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editTime, setEditTime] = useState(task.time || '09:00');
  const [editTz, setEditTz] = useState(task.timezone || getDefaultTimezone());
  const [editRecurrence, setEditRecurrence] = useState<ScheduledTaskRecurrence>(task.recurrence);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setTask(block.task);
    setEditTitle(block.task.title);
    setEditTime(block.task.time || '09:00');
    setEditTz(block.task.timezone || getDefaultTimezone());
    setEditRecurrence(block.task.recurrence);
  }, [block.task]);

  const loadHistory = async () => {
    try {
      const logs = await taskClient.getTaskHistory(task.id);
      setHistory(logs);
    } catch {
      // ignore
    }
  };

  const handleActivate = async () => {
    const updated: ScheduledTaskData = {
      ...task,
      status: 'active',
      nextRunAt: calculateNextRun(task),
      requiresConfirmation: false,
    };
    try {
      const saved = await taskClient.saveTask(updated);
      setTask(saved);
      onUpdate?.(saved);
      setActionMessage('Schedule activated successfully.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Activation failed: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  const handleTogglePause = async () => {
    const nextStatus = task.status === 'paused' ? 'active' : 'paused';
    try {
      const updated = await taskClient.updateTask(task.id, { status: nextStatus });
      setTask(updated);
      onUpdate?.(updated);
      setActionMessage(nextStatus === 'active' ? 'Schedule resumed.' : 'Schedule paused.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Update failed: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    setActionMessage('Executing task now...');
    try {
      const result = await taskClient.runTaskNow(task.id);
      setIsRunning(false);
      setActionMessage(`Execution finished: ${result.status.toUpperCase()}`);
      await loadHistory();
      const refreshed = await taskClient.getTask(task.id);
      if (refreshed) {
        setTask(refreshed);
        onUpdate?.(refreshed);
      }
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setIsRunning(false);
      setActionMessage(`Execution error: ${err instanceof Error ? err.message : 'Failed'}`);
    }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await taskClient.duplicateTask(task.id);
      setActionMessage(`Duplicated as "${copy.title}"`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Duplicate failed: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  const handleDelete = async () => {
    try {
      await taskClient.deleteTask(task.id);
      setShowDeleteConfirm(false);
      onDelete?.(task.id);
      setActionMessage('Task deleted.');
    } catch (err) {
      setActionMessage(`Delete failed: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  const handleSaveEdit = async () => {
    const tz = isValidTimezone(editTz) ? editTz : getDefaultTimezone();
    const patch: Partial<ScheduledTaskData> = {
      title: editTitle.trim() || task.title,
      time: editTime,
      timezone: tz,
      recurrence: editRecurrence,
    };
    try {
      const updated = await taskClient.updateTask(task.id, patch);
      setTask(updated);
      setIsEditing(false);
      onUpdate?.(updated);
      setActionMessage('Schedule updated.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Update failed: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  // Status badge coloring
  const statusBadges: Record<
    ScheduledTaskData['status'],
    { label: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    draft: {
      label: 'Draft / Confirmation Required',
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      icon: <Clock size={12} />,
    },
    active: {
      label: 'Active Schedule',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-400',
      icon: <CheckCircle2 size={12} />,
    },
    paused: {
      label: 'Paused',
      bg: 'bg-slate-500/10 border-slate-500/30',
      text: 'text-slate-400',
      icon: <Pause size={12} />,
    },
    completed: {
      label: 'Completed',
      bg: 'bg-blue-500/10 border-blue-500/30',
      text: 'text-blue-400',
      icon: <CheckCircle2 size={12} />,
    },
    failed: {
      label: 'Failed',
      bg: 'bg-rose-500/10 border-rose-500/30',
      text: 'text-rose-400',
      icon: <XCircle size={12} />,
    },
    missed: {
      label: 'Missed (Offline)',
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-300',
      icon: <AlertCircle size={12} />,
    },
  };

  const badge = statusBadges[task.status] || statusBadges.active;

  return (
    <div
      className="my-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e14]/90 p-5 shadow-2xl backdrop-blur-md transition-all duration-200"
      data-testid="scheduled-task-card"
      data-task-id={task.id}
    >
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 shadow-inner">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
              Scheduled Task & Automation
            </div>
            <h3 className="text-sm font-medium text-slate-100">{task.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Target: Cloud vs Desktop */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
              task.executionTarget === 'desktop'
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
            }`}
          >
            {task.executionTarget === 'desktop' ? (
              <>
                <Monitor size={11} />
                Desktop Runner
              </>
            ) : (
              <>
                <Cloud size={11} />
                Cloud Plane
              </>
            )}
          </span>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text}`}
          >
            {badge.icon}
            {badge.label}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="mt-3 text-xs leading-relaxed text-slate-300">{task.description}</p>
      )}

      {/* Confirmation Callout for Draft */}
      {task.status === 'draft' && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="flex-1 text-xs text-amber-200">
              <div className="font-semibold text-amber-300">Confirmation Required Before Activation</div>
              <p className="mt-0.5 text-[11px] text-amber-200/90 leading-normal">
                Please verify the scheduled timing, recurrence, and timezone below before activating
                this automation.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleActivate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition-colors"
                >
                  <CheckCircle2 size={13} />
                  Activate Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-slate-200 transition-colors"
                >
                  <Edit2 size={13} />
                  Edit Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Runner Notice */}
      {task.executionTarget === 'desktop' && (
        <div className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-500/[.05] p-2.5 text-[11px] text-indigo-200 flex items-start gap-2">
          <Monitor size={14} className="mt-0.5 shrink-0 text-indigo-400" />
          <div>
            <span className="font-semibold">Desktop Runner Required: </span>
            Ayatrisya Desktop must be running and online. If your computer is offline at the
            scheduled time, the task will be marked as missed and notify you, rather than silently
            running in the cloud.
          </div>
        </div>
      )}

      {/* Timing Details Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-white/[.06] bg-black/20 p-3">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Clock size={12} className="text-violet-400" />
            Next Scheduled Run
          </div>
          <div className="mt-1 font-semibold text-slate-100 text-sm">
            {formatInTimezone(task.nextRunAt, task.timezone)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
            Timezone: {task.timezone || 'UTC'}
          </div>
        </div>

        <div className="rounded-xl border border-white/[.06] bg-black/20 p-3">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <RotateCw size={12} className="text-cyan-400" />
            Schedule Cadence
          </div>
          <div className="mt-1 font-medium text-slate-200 text-xs">
            {describeRecurrence(task)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            Action: <span className="font-mono text-cyan-300">{task.actionType}</span>
          </div>
        </div>
      </div>

      {/* Last Execution Info */}
      {task.lastExecution && (
        <div className="mt-3 rounded-xl border border-white/[.06] bg-black/30 p-2.5 text-[11px]">
          <div className="flex items-center justify-between text-slate-400">
            <span>
              Last run:{' '}
              <strong className="text-slate-200">
                {formatInTimezone(task.lastExecution.triggeredAt, task.timezone)}
              </strong>
            </span>
            <span
              className={`font-semibold uppercase text-[10px] ${
                task.lastExecution.status === 'success'
                  ? 'text-emerald-400'
                  : task.lastExecution.status === 'missed'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {task.lastExecution.status}
            </span>
          </div>
          {task.lastExecution.output && (
            <p className="mt-1 text-slate-300 font-mono text-[10px] line-clamp-2">
              {task.lastExecution.output}
            </p>
          )}
          {task.lastExecution.error && (
            <p className="mt-1 text-rose-400 font-mono text-[10px]">
              Error: {task.lastExecution.error}
            </p>
          )}
        </div>
      )}

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-xs text-violet-200 transition-all">
          {actionMessage}
        </div>
      )}

      {/* Inline Edit Form */}
      {isEditing && (
        <div className="mt-4 rounded-xl border border-white/20 bg-slate-900/90 p-3.5 space-y-3">
          <div className="text-xs font-semibold text-slate-200">Edit Task Schedule</div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Time (24h)</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Recurrence</label>
              <select
                value={editRecurrence}
                onChange={(e) => setEditRecurrence(e.target.value as ScheduledTaskRecurrence)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
              >
                <option value="one-time">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Timezone</label>
              <input
                type="text"
                value={editTz}
                onChange={(e) => setEditTz(e.target.value)}
                placeholder="e.g. Asia/Kolkata"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-slate-100 font-mono focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow"
            >
              Save Schedule
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200">
          <div className="font-semibold text-rose-300 flex items-center gap-1.5">
            <AlertCircle size={14} />
            Confirm Task Deletion
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            Are you sure you want to delete &ldquo;{task.title}&rdquo;? This will cancel all future
            runs and remove execution logs.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition-colors"
            >
              Yes, Delete Task
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Control Buttons Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.08] pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Run Now */}
          <button
            type="button"
            onClick={handleRunNow}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-600/20 hover:bg-violet-600/30 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors disabled:opacity-50"
            title="Execute task immediately"
          >
            <Play size={12} className={isRunning ? 'animate-spin' : ''} />
            {isRunning ? 'Running...' : 'Run now'}
          </button>

          {/* Pause / Resume */}
          {task.status !== 'completed' && task.status !== 'draft' && (
            <button
              type="button"
              onClick={handleTogglePause}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors"
            >
              {task.status === 'paused' ? (
                <>
                  <Play size={12} />
                  Resume
                </>
              ) : (
                <>
                  <Pause size={12} />
                  Pause
                </>
              )}
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs text-slate-300 transition-colors"
            title="Edit schedule details"
          >
            <Edit2 size={12} />
            Edit
          </button>

          {/* Duplicate */}
          <button
            type="button"
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs text-slate-300 transition-colors"
            title="Duplicate task"
          >
            <Copy size={12} />
            Duplicate
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-300 transition-colors"
            title="Delete task"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>

        {/* Toggle History */}
        <button
          type="button"
          onClick={() => {
            if (!showHistory) void loadHistory();
            setShowHistory(!showHistory);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>History ({history.length})</span>
          {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Execution History Section */}
      {showHistory && (
        <div className="mt-3 rounded-xl border border-white/[.08] bg-black/40 p-3 text-xs">
          <div className="text-[11px] font-semibold text-slate-300 mb-2">Execution Logs</div>
          {history.length === 0 ? (
            <div className="text-[11px] text-slate-400 py-1">No prior runs recorded yet.</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border border-white/[.04] bg-white/[.02] p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatInTimezone(h.triggeredAt, task.timezone, {
                        includeTime: true,
                        includeSeconds: true,
                      })}
                    </span>
                    <span
                      className={`font-semibold uppercase text-[10px] ${
                        h.status === 'success'
                          ? 'text-emerald-400'
                          : h.status === 'missed'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {h.status} ({h.target})
                    </span>
                  </div>
                  {h.output && <div className="mt-1 text-slate-300 font-mono text-[10px]">{h.output}</div>}
                  {h.error && <div className="mt-1 text-rose-400 font-mono text-[10px]">{h.error}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
