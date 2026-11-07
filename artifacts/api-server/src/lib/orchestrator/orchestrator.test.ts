import { describe, it, expect } from "vitest";
import { classifyConversationIntent } from "./classifier";
import { normalizeUniversalResponse } from "../response-protocol/normalizer";

describe("Conversational Orchestrator 2.0", () => {
  describe("Intent Classification", () => {
    it("classifies MCQ and examination requests with parameters", () => {
      const res = classifyConversationIntent("Create 15 CBSE Class 12 Physics MCQs in examination mode");
      expect(res.intent).toBe("assessment_request");
      expect(res.targetQuestionCount).toBe(15);
      expect(res.examType).toBe("CBSE");
      expect(res.wantsExamMode).toBe(true);
      expect(res.suggestedBlockType).toBe("assessment");
    });

    it("classifies practice test requests", () => {
      const res = classifyConversationIntent("Give me a practice quiz on plant biology with immediate explanations");
      expect(res.intent).toBe("assessment_request");
      expect(res.wantsPracticeMode).toBe(true);
      expect(res.wantsExamMode).toBe(false);
    });

    it("classifies comparison requests", () => {
      const res = classifyConversationIntent("Compare PostgreSQL and MongoDB performance, pros and cons");
      expect(res.intent).toBe("comparison_request");
      expect(res.suggestedBlockType).toBe("comparison");
    });

    it("classifies data visualization requests", () => {
      const res = classifyConversationIntent("Plot a bar chart of monthly revenue growth");
      expect(res.intent).toBe("data_visualization");
      expect(res.suggestedBlockType).toBe("chart");
    });

    it("classifies calculation requests", () => {
      const res = classifyConversationIntent("Calculate the compound interest for $5000 at 7% over 5 years");
      expect(res.intent).toBe("calculation_request");
    });

    it("classifies timetable requests", () => {
      const res = classifyConversationIntent("Make a 4-week daily study plan and timetable for board exams");
      expect(res.intent).toBe("timetable_request");
    });

    it("classifies general conversation naturally", () => {
      const res = classifyConversationIntent("Hello! Good evening, how are you doing?");
      expect(res.intent).toBe("general_conversation");
    });
  });

  describe("Universal Response Protocol 2.0 Normalizer", () => {
    it("normalizes embedded interactive assessment into structured blocks", () => {
      const rawText = `Here is your practice quiz:

\`\`\`interactive
{
  "version": "1.0",
  "type": "assessment",
  "title": "Quantum Mechanics Intro",
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "Who formulated the uncertainty principle?",
      "options": [
        { "id": "a", "label": "Werner Heisenberg" },
        { "id": "b", "label": "Albert Einstein" }
      ],
      "correctAnswer": "a",
      "explanation": "Heisenberg formulated the principle in 1927."
    }
  ]
}
\`\`\`

Let me know if you would like more practice questions!`;

      const response = normalizeUniversalResponse({
        rawText,
        messageId: "msg_123",
        conversationId: "conv_456",
        extractedCitations: [
          { sourceId: 1, title: "Quantum Physics", url: "https://physics.org/quantum" },
        ],
      });

      expect(response.version).toBe("2.0");
      expect(response.intent).toBe("assessment_request");
      expect(response.blocks.length).toBeGreaterThanOrEqual(2);

      const assessmentBlock = response.blocks.find((b) => b.type === "assessment");
      expect(assessmentBlock).toBeDefined();
      if (assessmentBlock && assessmentBlock.type === "assessment") {
        expect(assessmentBlock.title).toBe("Quantum Mechanics Intro");
        expect(assessmentBlock.questions.length).toBe(1);
        expect(assessmentBlock.questions[0].correctAnswer).toBe("a");
      }

      expect(response.citations.length).toBe(1);
      expect(response.citations[0].url).toBe("https://physics.org/quantum");
    });

    it("normalizes code blocks and markdown blocks seamlessly", () => {
      const rawText = `Here is the solution in TypeScript:

\`\`\`typescript
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

You can import and run this function in your project.`;

      const response = normalizeUniversalResponse({
        rawText,
        messageId: "msg_789",
        conversationId: "conv_101",
      });

      expect(response.version).toBe("2.0");
      const codeBlock = response.blocks.find((b) => b.type === "code");
      expect(codeBlock).toBeDefined();
      if (codeBlock && codeBlock.type === "code") {
        expect(codeBlock.language).toBe("typescript");
        expect(codeBlock.code).toContain("return a + b;");
        expect(codeBlock.executable).toBe(true);
      }
    });
  });
});
