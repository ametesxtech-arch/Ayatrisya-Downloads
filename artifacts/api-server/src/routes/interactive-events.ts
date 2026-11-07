import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";

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

const InteractiveEventSchema = z.object({
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
const pollVotes = new Map<string, Record<string, number>>(); // blockId -> optionId -> count

router.post("/interactive/event", (req: Request, res: Response): void => {
  const parsed = InteractiveEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid interactive event payload.", details: parsed.error.issues });
    return;
  }

  const { blockId, blockType, action, payload } = parsed.data;
  const userId = getUserId(req);

  switch (blockType) {
    case "calculator": {
      // Safe, sandboxed arithmetic calculation
      if (action === "calculate") {
        const { formula, inputs } = payload;
        if (typeof formula === "string" && typeof inputs === "object" && inputs !== null) {
          try {
            // Replace named input variables with numeric values safely
            let safeFormula = formula;
            for (const [key, val] of Object.entries(inputs)) {
              const numVal = Number(val);
              if (!Number.isNaN(numVal)) {
                safeFormula = safeFormula.replace(new RegExp(`\\b${key}\\b`, "g"), String(numVal));
              }
            }
            // Whitelist valid arithmetic characters only
            if (/^[\d\s+\-*/().%^eE]+$/.test(safeFormula)) {
              // Safe evaluation of pure arithmetic
              const computedResult = new Function(`return (${safeFormula})`)();
              res.status(200).json({ status: "success", result: computedResult });
              return;
            } else {
              res.status(400).json({ error: "Invalid or unsafe arithmetic formula." });
              return;
            }
          } catch (e) {
            res.status(400).json({ error: "Calculation could not be evaluated safely." });
            return;
          }
        }
      }
      res.status(200).json({ status: "handled", action });
      break;
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
      break;
    }

    case "form": {
      // Handle validated form submissions
      res.status(200).json({
        status: "submitted",
        timestamp: new Date().toISOString(),
        userId,
        submittedFields: payload,
      });
      break;
    }

    default: {
      res.status(200).json({ status: "acknowledged", blockId, blockType, action });
      break;
    }
  }
});

export default router;
