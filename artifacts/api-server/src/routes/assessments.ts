import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { assessmentStore } from "../lib/assessment-engine/assessment-store";
import { gradeAssessment } from "../lib/assessment-engine/assessment-grader";
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
    type: z.enum(["single_choice", "multiple_choice", "true_false", "assertion_reason", "match_following", "case_based", "image_based"]),
    question: z.string().min(1),
    assertion: z.string().optional(),
    reason: z.string().optional(),
    passage: z.string().optional(),
    imageUrl: z.string().optional(),
    options: z.array(z.object({ id: z.string(), label: z.string(), hint: z.string().optional() })).optional(),
    matchPairs: z.array(z.object({ id: z.string(), left: z.string(), right: z.string() })).optional(),
    correctAnswer: z.union([z.string(), z.array(z.string()), z.record(z.string())]),
    explanation: z.string().optional(),
    hint: z.string().optional(),
    topic: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    isPyq: z.boolean().optional(),
    examTag: z.string().optional(),
    marks: z.number().optional(),
  })).min(1),
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

// 1. Create or register an assessment
router.post("/assessments/generate", (req: Request, res: Response): void => {
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

  // Return the client-safe view (strip answers if in exam mode)
  res.status(201).json(assessmentStore.getClientAssessment(assessmentId));
});

// 2. Get assessment metadata and questions
router.get("/assessments/:id", (req: Request, res: Response): void => {
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
    progress: progress || null,
  });
});

// 3. Save student progress (autosave)
router.post("/assessments/:id/progress", (req: Request, res: Response): void => {
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

  res.status(200).json({ status: "saved" });
});

// 4. Secure server-side submit and evaluation
router.post("/assessments/:id/submit", (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const assessment = assessmentStore.getAssessment(id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found." });
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

// 5. Get previous submission results
router.get("/assessments/:id/results", (req: Request, res: Response): void => {
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
