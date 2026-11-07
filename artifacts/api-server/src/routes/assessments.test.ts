import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import app from "../app";

describe("Assessment & Examination Engine API", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(app);
    server.listen(0);
    await once(server, "listening");
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, "close");
  });

  const testAssessmentPayload = {
    title: "CBSE Class 12 Physics & Math Challenge",
    description: "Assessment on Electromagnetism and Calculus",
    mode: "examination",
    timeLimitMinutes: 45,
    passingScore: 75,
    examType: "CBSE",
    questions: [
      {
        id: "q1",
        type: "single_choice",
        question: "What is the SI unit of magnetic flux?",
        options: [
          { id: "a", label: "Tesla" },
          { id: "b", label: "Weber" },
          { id: "c", label: "Henry" },
          { id: "d", label: "Farad" },
        ],
        correctAnswer: "b",
        explanation: "The SI unit of magnetic flux is the weber (Wb). Tesla is the unit of magnetic flux density.",
        topic: "Electromagnetism",
        difficulty: "easy",
        isPyq: true,
        examTag: "[CBSE 2023]",
        marks: 1,
      },
      {
        id: "q2",
        type: "assertion_reason",
        question: "Evaluate the Assertion and Reason regarding transformers.",
        assertion: "A transformer cannot work on direct current (DC).",
        reason: "DC does not produce a varying magnetic flux required for mutual induction.",
        options: [
          { id: "a", label: "Both A and R are true and R is the correct explanation of A" },
          { id: "b", label: "Both A and R are true but R is NOT the correct explanation of A" },
          { id: "c", label: "A is true but R is false" },
          { id: "d", label: "A is false but R is true" },
        ],
        correctAnswer: "a",
        explanation: "Transformers operate on Faraday's law of induction, which requires a time-varying magnetic flux. Direct current creates a steady magnetic field, resulting in zero induced EMF.",
        topic: "Electromagnetism",
        difficulty: "medium",
        isPyq: true,
        examTag: "[CBSE 2022]",
        marks: 1,
      },
      {
        id: "q3",
        type: "multiple_choice",
        question: "Which of the following functions are continuous at x = 0?",
        options: [
          { id: "a", label: "f(x) = sin(x)" },
          { id: "b", label: "f(x) = |x|" },
          { id: "c", label: "f(x) = 1/x" },
          { id: "d", label: "f(x) = cos(x)" },
        ],
        correctAnswer: ["a", "b", "d"],
        explanation: "sin(x), |x|, and cos(x) are defined and continuous everywhere, including at x=0. 1/x has an essential discontinuity at x=0.",
        topic: "Calculus",
        difficulty: "medium",
        marks: 2,
      },
      {
        id: "q4",
        type: "match_following",
        question: "Match the physical quantities in Column A with their formulas in Column B.",
        matchPairs: [
          { id: "p1", left: "Magnetic Force", right: "q(v x B)" },
          { id: "p2", left: "Electric Flux", right: "E . A" },
        ],
        correctAnswer: {
          p1: "q(v x B)",
          p2: "E . A",
        },
        explanation: "Lorentz magnetic force is F = q(v x B) and electric flux is Phi = E . A.",
        topic: "Electromagnetism",
        difficulty: "medium",
        marks: 2,
      },
    ],
  };

  it("POST /api/assessments/generate creates assessment and strips answers in exam mode", async () => {
    const res = await fetch(`${baseUrl}/api/assessments/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testAssessmentPayload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe("CBSE Class 12 Physics & Math Challenge");
    expect(body.mode).toBe("examination");
    expect(body.questions.length).toBe(4);

    // In examination mode, correct answers and explanations must NOT be sent to client
    for (const q of body.questions) {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      expect(q.question).toBeDefined();
    }
  });

  it("POST /api/assessments/:id/progress persists autosaved student answers", async () => {
    const createRes = await fetch(`${baseUrl}/api/assessments/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testAssessmentPayload),
    });
    const { id: assessmentId } = await createRes.json();

    const progressRes = await fetch(`${baseUrl}/api/assessments/${assessmentId}/progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "student_101",
      },
      body: JSON.stringify({
        currentQuestionIndex: 1,
        answers: { q1: "b" },
        markedForReview: { q2: true },
        timeRemainingSeconds: 2400,
        totalTimeSpentSeconds: 300,
      }),
    });

    expect(progressRes.status).toBe(200);
    const progressBody = await progressRes.json();
    expect(progressBody.status).toBe("saved");

    // Fetch and check progress
    const getRes = await fetch(`${baseUrl}/api/assessments/${assessmentId}`, {
      headers: { "x-user-id": "student_101" },
    });

    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.progress).toBeDefined();
    expect(getBody.progress.answers).toEqual({ q1: "b" });
    expect(getBody.progress.markedForReview).toEqual({ q2: true });
  });

  it("POST /api/assessments/:id/submit performs trusted grading and returns score breakdown with explanations", async () => {
    const createRes = await fetch(`${baseUrl}/api/assessments/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testAssessmentPayload),
    });
    const { id: assessmentId } = await createRes.json();

    // Submit answers: q1 correct, q2 correct, q3 partial (missed d), q4 correct
    const submitRes = await fetch(`${baseUrl}/api/assessments/${assessmentId}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "student_101",
      },
      body: JSON.stringify({
        userAnswers: {
          q1: "b",
          q2: "a",
          q3: ["a", "b"], // missed "d" -> incorrect
          q4: { p1: "q(v x B)", p2: "E . A" },
        },
        timeSpentSeconds: 1200,
      }),
    });

    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();
    expect(submitBody.totalQuestions).toBe(4);
    expect(submitBody.correctCount).toBe(3);
    expect(submitBody.incorrectCount).toBe(1);
    expect(submitBody.unattemptedCount).toBe(0);
    expect(submitBody.scorePercent).toBe(75);
    expect(submitBody.isPassed).toBe(true);

    // Topic breakdown
    expect(submitBody.topicBreakdown["Electromagnetism"]).toBeDefined();
    expect(submitBody.topicBreakdown["Electromagnetism"].total).toBe(3);
    expect(submitBody.topicBreakdown["Electromagnetism"].correct).toBe(3);
    expect(submitBody.topicBreakdown["Electromagnetism"].percent).toBe(100);

    expect(submitBody.topicBreakdown["Calculus"]).toBeDefined();
    expect(submitBody.topicBreakdown["Calculus"].total).toBe(1);
    expect(submitBody.topicBreakdown["Calculus"].correct).toBe(0);

    // After submission, explanations and correct answers are now revealed!
    const q1Res = submitBody.questionResults.find((r: any) => r.questionId === "q1");
    expect(q1Res.isCorrect).toBe(true);
    expect(q1Res.correctAnswer).toBe("b");
    expect(q1Res.explanation).toContain("weber");

    const q3Res = submitBody.questionResults.find((r: any) => r.questionId === "q3");
    expect(q3Res.isCorrect).toBe(false);
    expect(q3Res.correctAnswer).toEqual(["a", "b", "d"]);
    expect(q3Res.explanation).toContain("continuous");

    // Fetch previous results
    const resultsRes = await fetch(`${baseUrl}/api/assessments/${assessmentId}/results`, {
      headers: { "x-user-id": "student_101" },
    });

    expect(resultsRes.status).toBe(200);
    const resultsBody = await resultsRes.json();
    expect(resultsBody.scorePercent).toBe(75);
  });
});
