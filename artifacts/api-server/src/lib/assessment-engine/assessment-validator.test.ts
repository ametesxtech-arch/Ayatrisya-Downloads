import { describe, it, expect } from "vitest";
import { validateAndSanitizeQuestions } from "./assessment-validator";

describe("Assessment Engine Question Validator", () => {
  it("validates valid single_choice and multiple_choice questions", () => {
    const raw = [
      {
        id: "q1",
        type: "single_choice",
        question: "What is 2 + 2?",
        options: [
          { id: "a", label: "3" },
          { id: "b", label: "4" },
        ],
        correctAnswer: "b",
        explanation: "2 + 2 equals 4.",
      },
      {
        id: "q2",
        type: "multiple_choice",
        question: "Select all prime numbers.",
        options: [
          { id: "a", label: "2" },
          { id: "b", label: "3" },
          { id: "c", label: "4" },
        ],
        correctAnswer: ["a", "b"],
        explanation: "2 and 3 are prime numbers.",
      },
    ];

    const result = validateAndSanitizeQuestions(raw);
    expect(result.valid).toBe(true);
    expect(result.sanitizedQuestions.length).toBe(2);
    expect(result.sanitizedQuestions[0].id).toBe("q1");
    expect(result.sanitizedQuestions[0].correctAnswer).toBe("b");
    expect(result.sanitizedQuestions[1].correctAnswer).toEqual(["a", "b"]);
  });

  it("deduplicates identical questions and ensures unique IDs", () => {
    const raw = [
      {
        id: "q1",
        type: "single_choice",
        question: "What is the capital of France?",
        options: [
          { id: "a", label: "Paris" },
          { id: "b", label: "Lyon" },
        ],
        correctAnswer: "a",
      },
      {
        id: "q1", // Duplicate ID and duplicate text
        type: "single_choice",
        question: "what is the capital of france? ",
        options: [
          { id: "a", label: "Paris" },
          { id: "b", label: "Lyon" },
        ],
        correctAnswer: "a",
      },
    ];

    const result = validateAndSanitizeQuestions(raw);
    expect(result.valid).toBe(true);
    expect(result.sanitizedQuestions.length).toBe(1);
    expect(result.deduplicatedCount).toBe(1);
  });

  it("normalizes true_false and assertion_reason questions", () => {
    const raw = [
      {
        type: "true_false",
        question: "The Earth revolves around the Sun.",
        correctAnswer: "true",
      },
      {
        type: "assertion_reason",
        question: "Evaluate assertion and reason",
        assertion: "Metals conduct electricity.",
        reason: "They have free electrons.",
        options: [
          { id: "a", label: "Both true and correct explanation" },
          { id: "b", label: "Both true but incorrect explanation" },
        ],
        correctAnswer: "a",
      },
    ];

    const result = validateAndSanitizeQuestions(raw);
    expect(result.valid).toBe(true);
    expect(result.sanitizedQuestions[0].options?.length).toBe(2);
    expect(result.sanitizedQuestions[1].assertion).toBe("Metals conduct electricity.");
    expect(result.sanitizedQuestions[1].reason).toBe("They have free electrons.");
  });
});

