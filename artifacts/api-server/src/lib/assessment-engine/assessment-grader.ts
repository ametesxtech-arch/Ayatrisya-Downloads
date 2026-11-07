import type { StoredAssessment, AssessmentSubmission, StoredQuestion } from "./assessment-types";

/**
 * Trusted server-side assessment grader.
 * Ensures cheat-proof scoring for competitive examinations and board tests.
 */
export function gradeAssessment(params: {
  assessment: StoredAssessment;
  userId: string;
  userAnswers: Record<string, any>;
  timeSpentSeconds: number;
}): AssessmentSubmission {
  const { assessment, userId, userAnswers, timeSpentSeconds } = params;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let totalMarksObtained = 0;
  let maxMarks = 0;

  const topicStats: Record<string, { total: number; correct: number }> = {};
  const questionResults: AssessmentSubmission["questionResults"] = [];

  for (const q of assessment.questions) {
    const topic = q.topic || "General";
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    topicStats[topic].total += 1;

    const questionMarks = q.marks || 1;
    maxMarks += questionMarks;

    const ans = userAnswers[q.id];
    const isUnattempted =
      ans === undefined ||
      ans === null ||
      ans === "" ||
      (Array.isArray(ans) && ans.length === 0) ||
      (typeof ans === "object" && !Array.isArray(ans) && Object.keys(ans).length === 0);

    if (isUnattempted) {
      unattemptedCount += 1;
      questionResults.push({
        questionId: q.id,
        isCorrect: false,
        userAnswer: null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "No explanation provided.",
        topic,
      });
      continue;
    }

    let isCorrect = false;

    switch (q.type) {
      case "single_choice":
      case "true_false":
      case "assertion_reason": {
        isCorrect = String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        break;
      }

      case "multiple_choice": {
        if (Array.isArray(ans) && Array.isArray(q.correctAnswer)) {
          const userArr = ans.map((x) => String(x).trim().toLowerCase()).sort();
          const correctArr = q.correctAnswer.map((x) => String(x).trim().toLowerCase()).sort();
          isCorrect = userArr.length === correctArr.length && userArr.every((val, idx) => val === correctArr[idx]);
        }
        break;
      }

      case "match_following": {
        if (typeof ans === "object" && ans !== null && typeof q.correctAnswer === "object" && q.correctAnswer !== null) {
          const targetMap = q.correctAnswer as Record<string, string>;
          const userMap = ans as Record<string, string>;
          const keys = Object.keys(targetMap);
          isCorrect = keys.length > 0 && keys.every((k) => String(userMap[k]).trim() === String(targetMap[k]).trim());
        }
        break;
      }

      case "case_based": {
        if (Array.isArray(q.correctAnswer)) {
          const userArr = Array.isArray(ans) ? ans.map(String) : [String(ans)];
          isCorrect = q.correctAnswer.some((c) => userArr.includes(String(c)));
        } else {
          isCorrect = String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        }
        break;
      }

      default: {
        isCorrect = String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      }
    }

    if (isCorrect) {
      correctCount += 1;
      totalMarksObtained += questionMarks;
      topicStats[topic].correct += 1;
    } else {
      incorrectCount += 1;
    }

    questionResults.push({
      questionId: q.id,
      isCorrect,
      userAnswer: ans,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "No explanation provided.",
      topic,
    });
  }

  const totalQuestions = assessment.questions.length;
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isPassed = scorePercent >= assessment.passingScore;

  const topicBreakdown: Record<string, { total: number; correct: number; percent: number }> = {};
  for (const [topic, stats] of Object.entries(topicStats)) {
    topicBreakdown[topic] = {
      total: stats.total,
      correct: stats.correct,
      percent: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    };
  }

  return {
    assessmentId: assessment.id,
    userId,
    submittedAt: new Date().toISOString(),
    timeSpentSeconds,
    scorePercent,
    isPassed,
    totalMarksObtained,
    maxMarks,
    totalQuestions,
    correctCount,
    incorrectCount,
    unattemptedCount,
    userAnswers,
    questionResults,
    topicBreakdown,
  };
}

