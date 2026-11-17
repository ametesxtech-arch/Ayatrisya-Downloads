import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { assessmentStore } from "../lib/assessment-engine/assessment-store";
import { gradeAssessment, evaluateSingleQuestionAnswer } from "../lib/assessment-engine/assessment-grader";
import { validateAndSanitizeQuestions } from "../lib/assessment-engine/assessment-validator";
import type { StoredAssessment } from "../lib/assessment-engine/assessment-types";

const router: IRouter = Router();

function getUserId(req: Request): string {
  const authorization = req.get("authorization");
  if (authorization && authorization.startsWith("Bearer ")) {
    const match = authorization.match(/^Bearer ([^\s]+)$/i);
    if (match) return match[1].slice(0, 32);
  }

  const customId = req.headers["x-ayatrisya-user-id"] || req.headers["x-user-id"];
  if (typeof customId === "string" && customId.trim()) return customId.trim();

  return "guest_user";
}

const CreateAssessmentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  mode: z.enum(["practice", "examination"]).default("practice"),
  timeLimitMinutes: z.number().int().min(1).max(360).default(30),
  passingScore: z.number().min(0).max(100).default(70),
  examType: z.string().optional(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "single_choice",
      "multiple_choice",
      "true_false",
      "numerical",
      "assertion_reason",
      "match_following",
      "case_based",
      "image_based",
    ]),
    question: z.string().min(1),
    assertion: z.string().optional(),
    reason: z.string().optional(),
    passage: z.string().optional(),
    imageUrl: z.string().optional(),
    options: z.array(z.object({ id: z.string(), label: z.string(), hint: z.string().optional() })).optional(),
    matchPairs: z.array(z.object({ id: z.string(), left: z.string(), right: z.string() })).optional(),
    correctAnswer: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])), z.record(z.string())]),
    explanation: z.string().optional(),
    hint: z.string().optional(),
    topic: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    isPyq: z.boolean().optional(),
    examTag: z.string().optional(),
    marks: z.number().optional(),
    tolerance: z.number().optional(),
  })).min(1),
});

const EvaluateAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.any(),
  timeSpentSeconds: z.number().int().min(0).optional().default(0),
});

const SaveProgressSchema = z.object({
  currentQuestionIndex: z.number().int().min(0),
  answers: z.record(z.any()),
  markedForReview: z.record(z.boolean()).optional().default({}),
  timeRemainingSeconds: z.number().int().min(0),
  totalTimeSpentSeconds: z.number().int().min(0),
});

const SubmitAssessmentSchema = z
  .object({
    userAnswers: z.record(z.any()).optional(),
    answers: z.record(z.any()).optional(),
    timeSpentSeconds: z.number().int().min(0),
  })
  .refine((data) => Boolean(data.userAnswers || data.answers), {
    message: "Either userAnswers or answers must be provided.",
  });

// 1. Create or register an assessment / interactive activity
router.post(["/assessments/generate", "/activities", "/activities/generate"], (req: Request, res: Response): void => {
  const parsed = CreateAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid assessment specification.", details: parsed.error.issues });
    return;
  }

  const userId = getUserId(req);
  const data = parsed.data;
  const assessmentId = data.id || `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const validation = validateAndSanitizeQuestions(data.questions);
  if (!validation.valid || validation.sanitizedQuestions.length === 0) {
    res.status(400).json({ error: "Questions failed validation.", errors: validation.errors });
    return;
  }

  const questions = validation.sanitizedQuestions;

  const stored: StoredAssessment = {
    id: assessmentId,
    title: data.title,
    description: data.description,
    mode: data.mode,
    timeLimitMinutes: data.timeLimitMinutes,
    passingScore: data.passingScore,
    examType: data.examType,
    questions,
    topicSummary: Array.from(new Set(questions.map((q: any) => q.topic))),
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assessmentStore.saveAssessment(stored);

  // Return client-safe view (answers and explanations are securely held on server until submitted)
  res.status(201).json(assessmentStore.getClientAssessment(assessmentId));
});

// 2. Get assessment or activity metadata and questions
router.get(["/assessments/:id", "/activities/:id"], (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const clientView = assessmentStore.getClientAssessment(id);
  if (!clientView) {
    res.status(404).json({ error: "The requested assessment was not found." });
    return;
  }

  const userId = getUserId(req);
  const progress = assessmentStore.getProgress(userId, id);

  res.status(200).json({
    assessment: clientView,
    activity: clientView,
    progress: progress || null,
  });
});

// 3. Save student progress / advance questions (autosave)
router.post(["/assessments/:id/progress", "/activities/:id/progress", "/activities/:id/advance"], (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const assessment = assessmentStore.getAssessment(id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }

  const parsed = SaveProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid progress payload.", details: parsed.error.issues });
    return;
  }

  const userId = getUserId(req);
  assessmentStore.saveProgress({
    assessmentId: id,
    userId,
    currentQuestionIndex: parsed.data.currentQuestionIndex,
    answers: parsed.data.answers,
    markedForReview: parsed.data.markedForReview,
    timeRemainingSeconds: parsed.data.timeRemainingSeconds,
    totalTimeSpentSeconds: parsed.data.totalTimeSpentSeconds,
    updatedAt: new Date().toISOString(),
  });

  res.status(200).json({ status: "saved", currentQuestionIndex: parsed.data.currentQuestionIndex });
});

// 4. Real-time individual answer evaluation (one-question-at-a-time interactive practice)
router.post(["/assessments/:id/evaluate", "/activities/:id/evaluate", "/activities/:id/answer"], (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const assessment = assessmentStore.getAssessment(id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment or activity not found." });
    return;
  }

  const parsed = EvaluateAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid evaluation request payload.", details: parsed.error.issues });
    return;
  }

  const question = assessment.questions.find((q) => q.id === parsed.data.questionId);
  if (!question) {
    res.status(404).json({ error: `Question with id '${parsed.data.questionId}' was not found in this assessment.` });
    return;
  }

  const userId = getUserId(req);
  const evalResult = evaluateSingleQuestionAnswer({
    question,
    userAnswer: parsed.data.answer,
  });

  // Persist updated progress
  const currentProg = assessmentStore.getProgress(userId, id);
  const updatedAnswers = { ...(currentProg?.answers || {}), [question.id]: parsed.data.answer };
  const totalSpent = (currentProg?.totalTimeSpentSeconds || 0) + (parsed.data.timeSpentSeconds || 0);

  assessmentStore.saveProgress({
    assessmentId: id,
    userId,
    currentQuestionIndex: currentProg?.currentQuestionIndex ?? 0,
    answers: updatedAnswers,
    markedForReview: currentProg?.markedForReview || {},
    timeRemainingSeconds: currentProg?.timeRemainingSeconds ?? assessment.timeLimitMinutes * 60,
    totalTimeSpentSeconds: totalSpent,
    updatedAt: new Date().toISOString(),
  });

  // Calculate current score summary across answered questions
  const answeredCount = Object.keys(updatedAnswers).length;
  let correctSoFar = 0;
  for (const q of assessment.questions) {
    if (updatedAnswers[q.id] !== undefined) {
      const qEval = evaluateSingleQuestionAnswer({ question: q, userAnswer: updatedAnswers[q.id] });
      if (qEval.isCorrect) correctSoFar += 1;
    }
  }

  res.status(200).json({
    assessmentId: id,
    questionId: question.id,
    isCorrect: evalResult.isCorrect,
    correctAnswer: evalResult.correctAnswer,
    explanation: evalResult.explanation,
    marksObtained: evalResult.marksObtained,
    maxMarks: evalResult.maxMarks,
    stats: {
      correctCount: correctSoFar,
      totalAnswered: answeredCount,
      totalQuestions: assessment.questions.length,
      progressPercent: Math.round((answeredCount / assessment.questions.length) * 100),
    },
  });
});

// 5. Secure server-side submit and complete
router.post(["/assessments/:id/submit", "/activities/:id/submit", "/activities/:id/complete"], (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const assessment = assessmentStore.getAssessment(id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment or activity not found." });
    return;
  }

  const parsed = SubmitAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid submission data.", details: parsed.error.issues });
    return;
  }

  const userId = getUserId(req);
  const userAnswers = (parsed.data.userAnswers || parsed.data.answers || {}) as Record<string, any>;
  const gradedResult = gradeAssessment({
    assessment,
    userId,
    userAnswers,
    timeSpentSeconds: parsed.data.timeSpentSeconds,
  });

  assessmentStore.saveSubmission(gradedResult);

  res.status(200).json(gradedResult);
});

// 6. Get previous submission results
router.get(["/assessments/:id/results", "/activities/:id/results"], (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const userId = getUserId(req);
  const latest = assessmentStore.getLatestSubmission(userId, id);
  if (!latest) {
    res.status(404).json({ error: "No completed submission found for this assessment." });
    return;
  }

  res.status(200).json(latest);
});

export default router;
