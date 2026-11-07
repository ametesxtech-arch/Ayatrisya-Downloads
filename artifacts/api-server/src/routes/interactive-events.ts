import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { assessmentStore } from "../lib/assessment-engine/assessment-store";
import { gradeAssessment } from "../lib/assessment-engine/assessment-grader";

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

export const InteractiveEventSchema = z.object({
  blockId: z.string().min(1),
  blockType: z.enum([
    "calculator",
    "form",
    "poll",
    "table",
    "chart",
    "assessment",
    "artifact",
    "timetable",
    "code",
  ]),
  action: z.string().min(1),
  payload: z.record(z.any()),
});

// In-memory poll votes store
const pollVotes = new Map<string, Record<string, number>>();

router.post("/interactive/event", (req: Request, res: Response): void => {
  const parsed = InteractiveEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid interactive event payload.", details: parsed.error.issues });
    return;
  }

  const { blockId, blockType, action, payload } = parsed.data;
  const userId = getUserId(req);

  switch (blockType) {
    case "assessment": {
      const assessment = assessmentStore.getAssessment(blockId);
      if (!assessment) {
        res.status(404).json({ error: "Assessment associated with this interactive event was not found." });
        return;
      }

      if (action === "answer_selected") {
        const { questionId, answer, timeRemainingSeconds, totalTimeSpentSeconds } = payload;
        if (!questionId) {
          res.status(400).json({ error: "questionId is required for answer_selected event." });
          return;
        }

        const existing = assessmentStore.getProgress(userId, blockId) || {
          assessmentId: blockId,
          userId,
          currentQuestionIndex: 0,
          answers: {},
          markedForReview: {},
          timeRemainingSeconds: timeRemainingSeconds || assessment.timeLimitMinutes * 60,
          totalTimeSpentSeconds: totalTimeSpentSeconds || 0,
          updatedAt: new Date().toISOString(),
        };

        existing.answers[questionId] = answer;
        if (typeof timeRemainingSeconds === "number") existing.timeRemainingSeconds = timeRemainingSeconds;
        if (typeof totalTimeSpentSeconds === "number") existing.totalTimeSpentSeconds = totalTimeSpentSeconds;
        existing.updatedAt = new Date().toISOString();

        assessmentStore.saveProgress(existing);
        res.status(200).json({ status: "saved", questionId, recorded: true });
        return;
      }

      if (action === "mark_review") {
        const { questionId, marked } = payload;
        if (!questionId) {
          res.status(400).json({ error: "questionId is required." });
          return;
        }
        const existing = assessmentStore.getProgress(userId, blockId) || {
          assessmentId: blockId,
          userId,
          currentQuestionIndex: 0,
          answers: {},
          markedForReview: {},
          timeRemainingSeconds: assessment.timeLimitMinutes * 60,
          totalTimeSpentSeconds: 0,
          updatedAt: new Date().toISOString(),
        };
        existing.markedForReview[questionId] = Boolean(marked);
        assessmentStore.saveProgress(existing);
        res.status(200).json({ status: "saved", questionId, marked: Boolean(marked) });
        return;
      }

      if (action === "submit") {
        const userAnswers = (payload.userAnswers || payload.answers || {}) as Record<string, any>;
        const timeSpentSeconds = Number(payload.timeSpentSeconds) || 0;
        const graded = gradeAssessment({
          assessment,
          userId,
          userAnswers,
          timeSpentSeconds,
        });
        assessmentStore.saveSubmission(graded);
        res.status(200).json({ status: "submitted", result: graded });
        return;
      }

      res.status(400).json({ error: `Unsupported assessment action: ${action}` });
      return;
    }

    case "calculator": {
      if (action === "calculate" || action === "input_change") {
        const { formula, inputs } = payload;
        if (typeof formula === "string" && typeof inputs === "object" && inputs !== null) {
          try {
            let safeFormula = formula;
            for (const [key, val] of Object.entries(inputs)) {
              const numVal = Number(val);
              if (!Number.isNaN(numVal)) {
                safeFormula = safeFormula.replace(new RegExp(`\\b${key}\\b`, "g"), `(${numVal})`);
              }
            }
            // Whitelist valid arithmetic and math functions only
            if (/^[\d\s+\-*/().%^eE]+$/.test(safeFormula)) {
              // Safe evaluation restricted strictly to pure mathematical symbols
              const computedResult = new Function(`return (${safeFormula})`)();
              if (typeof computedResult === "number" && !Number.isNaN(computedResult) && Number.isFinite(computedResult)) {
                res.status(200).json({ status: "success", result: computedResult, action });
                return;
              }
            }
            res.status(400).json({ error: "Invalid arithmetic expression." });
            return;
          } catch {
            res.status(400).json({ error: "Calculation could not be evaluated safely." });
            return;
          }
        }
      }
      res.status(200).json({ status: "handled", action });
      return;
    }

    case "table": {
      if (action === "sort") {
        const { column, direction = "asc", rows, columns } = payload;
        if (Array.isArray(rows) && Array.isArray(columns) && typeof column === "string") {
          const colIdx = columns.indexOf(column);
          if (colIdx >= 0) {
            const sortedRows = [...rows].sort((a: any[], b: any[]) => {
              const valA = a[colIdx];
              const valB = b[colIdx];
              if (valA === valB) return 0;
              const dir = direction === "desc" ? -1 : 1;
              if (typeof valA === "number" && typeof valB === "number") {
                return (valA - valB) * dir;
              }
              return String(valA).localeCompare(String(valB)) * dir;
            });
            res.status(200).json({ status: "sorted", column, direction, sortedRows });
            return;
          }
        }
      }

      if (action === "filter") {
        const { query, rows } = payload;
        if (Array.isArray(rows) && typeof query === "string") {
          const q = query.toLowerCase().trim();
          const filteredRows = rows.filter((r: any[]) =>
            r.some((cell) => String(cell).toLowerCase().includes(q))
          );
          res.status(200).json({ status: "filtered", query, filteredRows });
          return;
        }
      }

      res.status(200).json({ status: "handled", action });
      return;
    }

    case "chart": {
      if (action === "filter_series") {
        const { activeSeries } = payload;
        res.status(200).json({ status: "series_filtered", activeSeries });
        return;
      }
      res.status(200).json({ status: "handled", action });
      return;
    }

    case "form": {
      const { values } = payload;
      res.status(200).json({
        status: "submitted",
        timestamp: new Date().toISOString(),
        userId,
        submittedFields: values || payload,
      });
      return;
    }

    case "poll": {
      if (action === "vote") {
        const optionId = String(payload.optionId || "");
        if (optionId) {
          const currentVotes = pollVotes.get(blockId) || {};
          currentVotes[optionId] = (currentVotes[optionId] || 0) + 1;
          pollVotes.set(blockId, currentVotes);
          res.status(200).json({ status: "recorded", votes: currentVotes });
          return;
        }
      }
      res.status(200).json({ status: "recorded" });
      return;
    }

    case "artifact": {
      res.status(200).json({
        status: "action_completed",
        action,
        blockId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    default: {
      res.status(200).json({ status: "acknowledged", blockId, blockType, action });
      return;
    }
  }
});

export default router;
