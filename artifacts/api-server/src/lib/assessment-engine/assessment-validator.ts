import type { StoredQuestion } from "./assessment-types";

export interface QuestionValidationResult {
  valid: boolean;
  sanitizedQuestions: StoredQuestion[];
  errors: string[];
  deduplicatedCount: number;
}

/**
 * Validates, deduplicates, and sanitizes questions for the Ayatrisya Assessment Engine.
 */
export function validateAndSanitizeQuestions(
  rawQuestions: unknown[]
): QuestionValidationResult {
  const errors: string[] = [];
  const sanitizedQuestions: StoredQuestion[] = [];
  const seenIds = new Set<string>();
  const seenQuestionTexts = new Set<string>();
  let deduplicatedCount = 0;

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return {
      valid: false,
      sanitizedQuestions: [],
      errors: ["Assessment must contain at least one question."],
      deduplicatedCount: 0,
    };
  }

  for (let idx = 0; idx < rawQuestions.length; idx++) {
    const raw = rawQuestions[idx] as any;
    if (!raw || typeof raw !== "object") {
      errors.push(`Question at index ${idx} is not a valid object.`);
      continue;
    }

    const questionText = String(raw.question || raw.text || "").trim();
    if (!questionText) {
      errors.push(`Question at index ${idx} is missing question text.`);
      continue;
    }

    // Check duplicate question text (case & whitespace normalized)
    const normalizedText = questionText.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenQuestionTexts.has(normalizedText)) {
      deduplicatedCount++;
      continue;
    }
    seenQuestionTexts.add(normalizedText);

    // Ensure unique ID
    let qId = String(raw.id || `q_${idx + 1}`).trim();
    if (seenIds.has(qId)) {
      qId = `${qId}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seenIds.add(qId);

    // Validate type
    const validTypes = [
      "single_choice",
      "multiple_choice",
      "true_false",
      "assertion_reason",
      "match_following",
      "case_based",
      "image_based",
    ];
    let qType = raw.type;
    if (!validTypes.includes(qType)) {
      if (raw.multiSelect || Array.isArray(raw.correctAnswer)) {
        qType = "multiple_choice";
      } else if (raw.matchPairs) {
        qType = "match_following";
      } else {
        qType = "single_choice";
      }
    }

    // Validate options for choice types
    let options: Array<{ id: string; label: string; hint?: string }> | undefined = undefined;
    if (["single_choice", "multiple_choice", "true_false", "assertion_reason"].includes(qType)) {
      const rawOpts = Array.isArray(raw.options) ? raw.options : [];
      if (rawOpts.length >= 2) {
        const optionIdSet = new Set<string>();
        options = rawOpts.map((opt: any, optIdx: number) => {
          let optId = String(opt.id || String.fromCharCode(97 + optIdx)).trim().toLowerCase();
          if (optionIdSet.has(optId)) {
            optId = `${optId}_${optIdx}`;
          }
          optionIdSet.add(optId);
          return {
            id: optId,
            label: String(opt.label || opt.text || `Option ${optId}`).trim(),
            hint: opt.hint ? String(opt.hint).trim() : undefined,
          };
        });
      } else if (qType === "true_false") {
        options = [
          { id: "true", label: "True" },
          { id: "false", label: "False" },
        ];
      }
    }

    // Validate correctAnswer
    let correctAnswer = raw.correctAnswer;
    if (correctAnswer === undefined || correctAnswer === null || correctAnswer === "") {
      if (options && options.length > 0) {
        correctAnswer = options[0].id;
      } else {
        correctAnswer = "unspecified";
      }
    }

    // For single_choice, ensure correctAnswer matches an existing option ID
    if (qType === "single_choice" && options && options.length > 0) {
      const matchOpt = options.find(
        (o) => o.id.toLowerCase() === String(correctAnswer).toLowerCase() || o.label.toLowerCase() === String(correctAnswer).toLowerCase()
      );
      if (matchOpt) {
        correctAnswer = matchOpt.id;
      }
    }

    // Explanation
    const explanation = String(raw.explanation || "Detailed solution and conceptual explanation.").trim();

    // Topic & Difficulty
    const topic = String(raw.topic || "General").trim();
    const validDifficulties = ["easy", "medium", "hard"];
    const difficulty = validDifficulties.includes(raw.difficulty) ? raw.difficulty : "medium";

    sanitizedQuestions.push({
      id: qId,
      type: qType,
      question: questionText,
      assertion: raw.assertion ? String(raw.assertion).trim() : undefined,
      reason: raw.reason ? String(raw.reason).trim() : undefined,
      passage: raw.passage ? String(raw.passage).trim() : undefined,
      imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : undefined,
      options,
      matchPairs: Array.isArray(raw.matchPairs) ? raw.matchPairs : undefined,
      correctAnswer,
      explanation,
      hint: raw.hint ? String(raw.hint).trim() : undefined,
      topic,
      difficulty,
      isPyq: Boolean(raw.isPyq || (raw.examTag && /CBSE|JEE|NEET/i.test(raw.examTag))),
      examTag: raw.examTag ? String(raw.examTag).trim() : undefined,
      marks: typeof raw.marks === "number" && raw.marks > 0 ? raw.marks : 1,
    });
  }

  return {
    valid: sanitizedQuestions.length > 0,
    sanitizedQuestions,
    errors,
    deduplicatedCount,
  };
}

