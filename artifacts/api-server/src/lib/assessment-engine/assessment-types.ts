export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "assertion_reason"
  | "match_following"
  | "case_based"
  | "image_based";

export interface StoredAssessmentOption {
  id: string;
  label: string;
  hint?: string;
}

export interface StoredMatchPair {
  id: string;
  left: string;
  right: string;
}

export interface StoredQuestion {
  id: string;
  type: QuestionType;
  question: string;
  assertion?: string;
  reason?: string;
  passage?: string;
  imageUrl?: string;
  options?: StoredOption[];
  matchPairs?: StoredMatchPair[];
  correctAnswer: string | string[] | Record<string, string>;
  explanation: string;
  hint?: string;
  topic: string;
  difficulty?: "easy" | "medium" | "hard";
  isPyq?: boolean;
  examTag?: string;
  marks?: number;
}

export type StoredOption = StoredAssessmentOption;

export interface StoredAssessment {
  id: string;
  title: string;
  description?: string;
  mode: "practice" | "examination";
  timeLimitMinutes: number;
  passingScore: number;
  examType?: string;
  questions: StoredQuestion[];
  topicSummary?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSubmission {
  assessmentId: string;
  userId: string;
  submittedAt: string;
  timeSpentSeconds: number;
  scorePercent: number;
  isPassed: boolean;
  totalMarksObtained: number;
  maxMarks: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  userAnswers: Record<string, any>;
  questionResults: Array<{
    questionId: string;
    isCorrect: boolean;
    userAnswer: any;
    correctAnswer: any;
    explanation: string;
    topic: string;
  }>;
  topicBreakdown: Record<string, { total: number; correct: number; percent: number }>;
}

