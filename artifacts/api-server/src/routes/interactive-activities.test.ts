import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import app from "../app";
import { classifyConversationIntent } from "../lib/orchestrator/classifier";
import { buildOrchestratorInstructions } from "../lib/orchestrator/prompt-builder";
import { normalizeUniversalResponse, buildActivityFromUniversal, extractQuestionsFromMarkdown } from "../lib/response-protocol/normalizer";

describe("Ayatrisya Interactive Activities & Assessment Engine Upgrade", () => {
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

  // 1. "Make a quiz test" generates valid quiz structure
  it("Criterion 1: 'Make a quiz test' classifies as assessment_request and normalizes into valid quiz structure", () => {
    const classification = classifyConversationIntent("Make a quiz test on Indian history");
    expect(classification.intent).toBe("assessment_request");

    const sampleModelOutput = `Here is your quiz on Indian history:
\`\`\`interactive
{
  "version": "1.0",
  "type": "assessment",
  "title": "Indian History Quiz",
  "mode": "practice",
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "Who was the founder of the Maurya Empire?",
      "options": [
        { "id": "a", "label": "Ashoka" },
        { "id": "b", "label": "Chandragupta Maurya" },
        { "id": "c", "label": "Bindusara" },
        { "id": "d", "label": "Harsha" }
      ],
      "correctAnswer": "b",
      "explanation": "Chandragupta Maurya founded the Maurya Empire in 322 BCE."
    }
  ]
}
\`\`\``;

    const normalized = normalizeUniversalResponse({
      rawText: sampleModelOutput,
      messageId: "msg_1",
      conversationId: "conv_1",
      intent: classification.intent,
    });

    expect(normalized.intent).toBe("assessment_request");
    const assessmentBlock = normalized.blocks.find((b) => b.type === "assessment");
    expect(assessmentBlock).toBeDefined();
    if (assessmentBlock && assessmentBlock.type === "assessment") {
      expect(assessmentBlock.title).toBe("Indian History Quiz");
      expect(assessmentBlock.questions.length).toBe(1);
      expect(assessmentBlock.questions[0].question).toContain("founder of the Maurya Empire");
      expect(assessmentBlock.questions[0].options?.[1]?.label).toContain("Chandragupta");
    }
  });

  // 2. "Make it interactive" produces interactive activity, not plain text
  it("Criterion 2: Follow-up 'Make it interactive' detects context from history and enforces interactive structured activity", () => {
    const history = [
      { role: "user" as const, content: "Make a quiz on OSAT biology" },
      { role: "assistant" as const, content: "1. What is mitosis?\nA) Cell division\nB) Energy generation\nC) Photosynthesis\nD) Respiration" },
    ];

    const classification = classifyConversationIntent("Make it interactive", history);
    expect(classification.intent).toBe("assessment_request");
    expect(classification.wantsInteractive).toBe(true);

    const systemPrompt = buildOrchestratorInstructions(classification);
    expect(systemPrompt).toContain("NEVER simulate interactivity through ordinary chat text");
    expect(systemPrompt).toContain("Let's do it interactively!");
    expect(systemPrompt).toContain("```interactive JSON block");

    // Even if model produced plain text with questions, the server auto-promotes it to an interactive activity
    const plainTextQuiz = `Sure! Here is the quiz:
1. What is the powerhouse of the cell?
A) Nucleus
B) Mitochondria
C) Ribosome
D) Endoplasmic Reticulum
Answer: B
Explanation: Mitochondria produce ATP through cellular respiration.

2. Which organelle contains chlorophyll?
A) Chloroplast
B) Vacuole
C) Golgi apparatus
D) Lysosome
Answer: A
Explanation: Chloroplasts contain chlorophyll for photosynthesis.`;

    const normalized = normalizeUniversalResponse({
      rawText: plainTextQuiz,
      messageId: "msg_followup",
      conversationId: "conv_1",
      intent: classification.intent,
    });

    const activity = buildActivityFromUniversal(normalized);
    expect(activity).toBeDefined();
    expect(activity.type).toBe("interactive_quiz");
    expect(activity.questions.length).toBe(2);
    expect(activity.questions[0].options.length).toBe(4);
  });

  // 3. Answer submission evaluated correctly on the server
  it("Criterion 3: Single answer submission evaluated correctly on the server via /api/activities/:id/evaluate", async () => {
    // Register assessment with numerical and single choice questions
    const regRes = await fetch(`${baseUrl}/api/activities/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "activity_eval_test",
        title: "Science & Math Evaluation",
        mode: "practice",
        questions: [
          {
            id: "q_mcq",
            type: "single_choice",
            question: "What is the speed of light in vacuum?",
            options: [
              { id: "a", label: "3 x 10^8 m/s" },
              { id: "b", label: "3 x 10^6 m/s" },
            ],
            correctAnswer: "a",
            explanation: "Light travels at approximately 299,792,458 m/s in vacuum.",
          },
          {
            id: "q_num",
            type: "numerical",
            question: "Calculate the value of pi to two decimal places.",
            correctAnswer: 3.14,
            tolerance: 0.01,
            explanation: "Pi is approximately 3.14159.",
          },
        ],
      }),
    });

    expect(regRes.status).toBe(201);

    // Test correct MCQ evaluation
    const evalMcqRes = await fetch(`${baseUrl}/api/activities/activity_eval_test/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "q_mcq", answer: "a" }),
    });
    expect(evalMcqRes.status).toBe(200);
    const mcqResult: any = await evalMcqRes.json();
    expect(mcqResult.isCorrect).toBe(true);
    expect(mcqResult.correctAnswer).toBe("a");
    expect(mcqResult.explanation).toContain("299,792,458");

    // Test numerical tolerance evaluation (3.145 is within 3.14 ± 0.01)
    const evalNumRes = await fetch(`${baseUrl}/api/activities/activity_eval_test/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "q_num", answer: 3.145 }),
    });
    expect(evalNumRes.status).toBe(200);
    const numResult: any = await evalNumRes.json();
    expect(numResult.isCorrect).toBe(true);
    expect(numResult.correctAnswer).toBe(3.14);
  });

  // 4. Correct answers not leaked before submission
  it("Criterion 4: Correct answers and explanations are NEVER exposed in the client payload prior to answer submission", async () => {
    const getRes = await fetch(`${baseUrl}/api/activities/activity_eval_test`);
    expect(getRes.status).toBe(200);
    const body: any = await getRes.json();

    expect(body.activity).toBeDefined();
    for (const q of body.activity.questions) {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  // 5. Progress updates correctly
  it("Criterion 5: Progress updates and advances correctly across questions", async () => {
    const progressRes = await fetch(`${baseUrl}/api/activities/activity_eval_test/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "learner_42",
      },
      body: JSON.stringify({
        currentQuestionIndex: 1,
        answers: { q_mcq: "a" },
        markedForReview: { q_num: true },
        timeRemainingSeconds: 1600,
        totalTimeSpentSeconds: 200,
      }),
    });

    expect(progressRes.status).toBe(200);
    const progData: any = await progressRes.json();
    expect(progData.status).toBe("saved");
    expect(progData.currentQuestionIndex).toBe(1);

    // Verify persisted state for learner_42
    const fetchRes = await fetch(`${baseUrl}/api/activities/activity_eval_test`, {
      headers: { "x-user-id": "learner_42" },
    });
    const fetchBody: any = await fetchRes.json();
    expect(fetchBody.progress.currentQuestionIndex).toBe(1);
    expect(fetchBody.progress.answers).toEqual({ q_mcq: "a" });
    expect(fetchBody.progress.markedForReview).toEqual({ q_num: true });
  });

  // 6. Final scores calculated server-side
  it("Criterion 6: Final score and passing status calculated server-side upon activity completion", async () => {
    const submitRes = await fetch(`${baseUrl}/api/activities/activity_eval_test/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "learner_42",
      },
      body: JSON.stringify({
        userAnswers: {
          q_mcq: "a", // correct
          q_num: 5.0, // incorrect (expected 3.14)
        },
        timeSpentSeconds: 320,
      }),
    });

    expect(submitRes.status).toBe(200);
    const graded: any = await submitRes.json();
    expect(graded.totalQuestions).toBe(2);
    expect(graded.correctCount).toBe(1);
    expect(graded.incorrectCount).toBe(1);
    expect(graded.scorePercent).toBe(50);
    expect(graded.isPassed).toBe(false); // passing threshold was 70%

    // Now post-completion, the explanations are released to the user
    const mcqGraded = graded.questionResults.find((r: any) => r.questionId === "q_mcq");
    expect(mcqGraded.isCorrect).toBe(true);
    expect(mcqGraded.explanation).toBeDefined();

    const numGraded = graded.questionResults.find((r: any) => r.questionId === "q_num");
    expect(numGraded.isCorrect).toBe(false);
    expect(numGraded.correctAnswer).toBe(3.14);
  });

  // 7. Activities remain associated with the correct user
  it("Criterion 7: Activities and progress remain strictly isolated to the authenticated user", async () => {
    // User A should have progress and submission
    const resA = await fetch(`${baseUrl}/api/activities/activity_eval_test/results`, {
      headers: { "x-user-id": "learner_42" },
    });
    expect(resA.status).toBe(200);

    // User B should NOT have User A's submission
    const resB = await fetch(`${baseUrl}/api/activities/activity_eval_test/results`, {
      headers: { "x-user-id": "different_user" },
    });
    expect(resB.status).toBe(404);
  });

  // 8. Legacy Markdown and text responses still work normally
  it("Criterion 8: Standard text and legacy Markdown responses continue to parse cleanly into markdown blocks", () => {
    const legacyText = "Quantum computing relies on quantum superposition and entanglement to perform calculations.";
    const response = normalizeUniversalResponse({
      rawText: legacyText,
      messageId: "msg_legacy",
      conversationId: "conv_legacy",
    });

    expect(response.blocks.length).toBe(1);
    expect(response.blocks[0].type).toBe("markdown");
    if (response.blocks[0].type === "markdown") {
      expect(response.blocks[0].content).toContain("superposition");
    }
  });

  // 9. Streaming activities render correctly (clean structured blocks)
  it("Criterion 9: Structured interactive blocks in streaming output are cleanly extracted without corrupting markdown", () => {
    const streamedText = `Certainly! I've prepared your practice session below.

\`\`\`interactive
{
  "version": "1.0",
  "type": "assessment",
  "title": "Algebraic Equations",
  "mode": "practice",
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "Solve for x: 2x + 4 = 10",
      "options": [
        { "id": "a", "label": "x = 2" },
        { "id": "b", "label": "x = 3" },
        { "id": "c", "label": "x = 4" }
      ],
      "correctAnswer": "b",
      "explanation": "2x = 6, so x = 3."
    }
  ]
}
\`\`\`

Feel free to ask for step-by-step hints if needed.`;

    const normalized = normalizeUniversalResponse({
      rawText: streamedText,
      messageId: "msg_stream",
      conversationId: "conv_stream",
    });

    expect(normalized.blocks.length).toBe(3);
    expect(normalized.blocks[0].type).toBe("markdown");
    expect(normalized.blocks[1].type).toBe("assessment");
    expect(normalized.blocks[2].type).toBe("markdown");

    const activity = buildActivityFromUniversal(normalized);
    expect(activity).toBeDefined();
    expect(activity.type).toBe("interactive_quiz");
    expect(activity.questions.length).toBe(1);
  });

  // 10. Invalid or manipulated submissions rejected
  it("Criterion 10: Invalid, malformed, or manipulated submissions are rejected with 400 Bad Request", async () => {
    // Missing required fields
    const badSubmit = await fetch(`${baseUrl}/api/activities/activity_eval_test/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(badSubmit.status).toBe(400);

    // Negative time spent
    const negativeTime = await fetch(`${baseUrl}/api/activities/activity_eval_test/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAnswers: { q_mcq: "a" },
        timeSpentSeconds: -50,
      }),
    });
    expect(negativeTime.status).toBe(400);

    // Evaluating non-existent question
    const fakeQuestion = await fetch(`${baseUrl}/api/activities/activity_eval_test/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: "non_existent_question_id",
        answer: "a",
      }),
    });
    expect(fakeQuestion.status).toBe(404);
  });
});
