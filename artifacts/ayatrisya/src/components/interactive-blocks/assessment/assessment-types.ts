export type AssessmentQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'assertion_reason'
  | 'match_following'
  | 'case_based'
  | 'image_based';

export interface AssessmentOption {
  id: string; // 'a', 'b', 'c', 'd'
  label: string;
  hint?: string;
}

export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  question: string;
  options?: AssessmentOption[];
  // For single_choice / true_false: 'a'
  // For multiple_choice: ['a', 'c']
  // For assertion_reason: 'a' | 'b' | 'c' | 'd'
  // For match_following: Record<leftId, rightId> or matching pairs
  correctAnswer: string | string[] | Record<string, string>;
  explanation?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
  assertion?: string;
  reason?: string;
  casePassage?: string;
  caseTitle?: string;
  matchPairs?: MatchPair[];
  imageUrl?: string;
  isPyq?: boolean;
  pyqSource?: string; // e.g. "CBSE Class 12 2023", "JEE Main 2022"
}

export interface AssessmentBlockData {
  version?: '1.0';
  type: 'assessment' | 'quiz' | 'mock_test' | 'exam';
  id?: string;
  title: string;
  description?: string;
  topic?: string;
  subject?: string;
  mode?: 'practice' | 'exam';
  timeLimitMinutes?: number;
  passingScore?: number;
  allowReview?: boolean;
  questions: AssessmentQuestion[];
}

export interface AssessmentState {
  mode: 'practice' | 'exam';
  currentQuestionIndex: number;
  answers: Record<string, any>; // questionId -> selected answer(s)
  markedForReview: Record<string, boolean>;
  submitted: boolean;
  timeRemainingSeconds: number;
  totalTimeSpentSeconds: number;
  isTimerRunning: boolean;
  showPalette: boolean;
  reviewFilter: 'all' | 'mistakes' | 'marked';
  startTime: number;
}
