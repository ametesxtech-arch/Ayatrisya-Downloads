import React, { useEffect } from 'react';
import { Timer, AlertTriangle, Pause, Play } from 'lucide-react';

interface AssessmentTimerProps {
  timeRemainingSeconds: number;
  totalTimeSpentSeconds: number;
  isExamMode: boolean;
  isRunning: boolean;
  onTick: () => void;
  onTimeExpire?: () => void;
  onTogglePause?: () => void;
}

export function AssessmentTimer({
  timeRemainingSeconds,
  totalTimeSpentSeconds,
  isExamMode,
  isRunning,
  onTick,
  onTimeExpire,
  onTogglePause,
}: AssessmentTimerProps) {
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      onTick();
      if (isExamMode && timeRemainingSeconds <= 1 && onTimeExpire) {
        onTimeExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, isExamMode, timeRemainingSeconds, onTick, onTimeExpire]);

  const displaySeconds = isExamMode ? Math.max(0, timeRemainingSeconds) : totalTimeSpentSeconds;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLowTime = isExamMode && timeRemainingSeconds <= 120 && timeRemainingSeconds > 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-mono transition-colors ${
        isLowTime
          ? 'border-rose-500/50 bg-rose-500/15 text-rose-300 animate-pulse'
          : 'border-white/10 bg-white/[.04] text-slate-300'
      }`}
    >
      {isLowTime ? (
        <AlertTriangle size={13} className="text-rose-400" />
      ) : (
        <Timer size={13} className="text-violet-400" />
      )}

      <span className="font-semibold">{formatted}</span>

      {!isExamMode && onTogglePause && (
        <button
          type="button"
          onClick={onTogglePause}
          title={isRunning ? 'Pause timer' : 'Resume timer'}
          className="ml-1 text-slate-400 hover:text-white"
        >
          {isRunning ? <Pause size={11} /> : <Play size={11} />}
        </button>
      )}
    </div>
  );
}

