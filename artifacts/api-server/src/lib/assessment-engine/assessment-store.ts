import fs from "node:fs";
import path from "node:path";
import type { StoredAssessment, AssessmentSubmission } from "./assessment-types";

const DATA_DIR = path.resolve(process.cwd(), "artifacts/api-server/data");
const ASSESSMENTS_FILE = path.join(DATA_DIR, "assessments.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

interface StudentProgress {
  assessmentId: string;
  userId: string;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  markedForReview: Record<string, boolean>;
  timeRemainingSeconds: number;
  totalTimeSpentSeconds: number;
  updatedAt: string;
}

export class AssessmentStore {
  private assessments = new Map<string, StoredAssessment>();
  private submissions = new Map<string, AssessmentSubmission[]>(); // assessmentId -> submissions
  private progress = new Map<string, StudentProgress>(); // `${userId}:${assessmentId}` -> progress

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {}
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(ASSESSMENTS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(ASSESSMENTS_FILE, "utf8"));
        if (Array.isArray(raw)) {
          for (const a of raw) {
            if (a && a.id) this.assessments.set(a.id, a);
          }
        }
      }
    } catch {}

    try {
      if (fs.existsSync(SUBMISSIONS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, "utf8"));
        if (Array.isArray(raw)) {
          for (const s of raw) {
            if (s && s.assessmentId) {
              const list = this.submissions.get(s.assessmentId) || [];
              list.push(s);
              this.submissions.set(s.assessmentId, list);
            }
          }
        }
      }
    } catch {}

    try {
      if (fs.existsSync(PROGRESS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
        if (typeof raw === "object" && raw !== null) {
          for (const [key, p] of Object.entries(raw)) {
            this.progress.set(key, p as StudentProgress);
          }
        }
      }
    } catch {}
  }

  private saveToDisk() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(ASSESSMENTS_FILE, JSON.stringify(Array.from(this.assessments.values()), null, 2));
      const allSubmissions: AssessmentSubmission[] = [];
      for (const list of this.submissions.values()) {
        allSubmissions.push(...list);
      }
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(allSubmissions, null, 2));
      const progObj: Record<string, StudentProgress> = {};
      for (const [k, v] of this.progress.entries()) {
        progObj[k] = v;
      }
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progObj, null, 2));
    } catch {}
  }

  saveAssessment(assessment: StoredAssessment): void {
    this.assessments.set(assessment.id, assessment);
    this.saveToDisk();
  }

  getAssessment(id: string): StoredAssessment | null {
    return this.assessments.get(id) || null;
  }

  /**
   * Returns a sanitized client view of the assessment.
   * If in examination mode, correct answers and explanations are stripped to prevent cheating.
   */
  getClientAssessment(id: string): any | null {
    const assessment = this.getAssessment(id);
    if (!assessment) return null;

    if (assessment.mode === "examination") {
      return {
        ...assessment,
        questions: assessment.questions.map((q) => {
          const { correctAnswer, explanation, ...sanitized } = q;
          return sanitized;
        }),
      };
    }

    return assessment;
  }

  saveProgress(progress: StudentProgress): void {
    const key = `${progress.userId}:${progress.assessmentId}`;
    this.progress.set(key, progress);
    this.saveToDisk();
  }

  getProgress(userId: string, assessmentId: string): StudentProgress | null {
    const key = `${userId}:${assessmentId}`;
    return this.progress.get(key) || null;
  }

  saveSubmission(submission: AssessmentSubmission): void {
    const list = this.submissions.get(submission.assessmentId) || [];
    list.push(submission);
    this.submissions.set(submission.assessmentId, list);
    this.saveToDisk();
  }

  getLatestSubmission(userId: string, assessmentId: string): AssessmentSubmission | null {
    const list = this.submissions.get(assessmentId) || [];
    const userSubs = list.filter((s) => s.userId === userId);
    if (userSubs.length === 0) return null;
    return userSubs[userSubs.length - 1];
  }
}

export const assessmentStore = new AssessmentStore();
