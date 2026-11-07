import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import type { AssessmentQuestion } from './assessment-types';

interface PerformanceAnalysisProps {
  questions: AssessmentQuestion[];
  answers: Record<string, any>;
}

export function PerformanceAnalysis({ questions, answers }: PerformanceAnalysisProps) {
  // Group questions by topic
  const topicStats: Record<string, { total: number; correct: number }> = {};

  questions.forEach((q) => {
    const topic = q.topic || 'General Concepts';
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    topicStats[topic].total += 1;

    const userAns = answers[q.id];
    let isCorrect = false;

    if (Array.isArray(q.correctAnswer)) {
      const uArr = Array.isArray(userAns) ? userAns.map(String) : [];
      const cArr = q.correctAnswer.map(String);
      isCorrect = uArr.length === cArr.length && uArr.every((id) => cArr.includes(id));
    } else if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null) {
      const uMap = userAns || {};
      const cMap = q.correctAnswer as Record<string, string>;
      isCorrect = Object.keys(cMap).every((k) => cMap[k] === uMap[k]);
    } else {
      isCorrect = String(userAns || '').toLowerCase() === String(q.correctAnswer || '').toLowerCase();
    }

    if (isCorrect) {
      topicStats[topic].correct += 1;
    }
  });

  const topics = Object.entries(topicStats);
  if (topics.length <= 1 && topics[0]?.[0] === 'General Concepts') {
    return null;
  }

  return (
    <div className="space-y-3 pt-3 border-t border-white/[.08]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
        <BarChart3 size={14} className="text-violet-400" />
        <span>Topic-Wise Mastery Breakdown</span>
      </div>

      <div className="space-y-2">
        {topics.map(([topic, stat]) => {
          const pct = Math.round((stat.correct / stat.total) * 100);
          return (
            <div key={topic} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="truncate pr-2">{topic}</span>
                <span className="font-mono text-slate-400">
                  {stat.correct}/{stat.total} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 70
                      ? 'bg-emerald-400'
                      : pct >= 40
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

