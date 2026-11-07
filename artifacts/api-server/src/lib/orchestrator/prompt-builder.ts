import type { IntentClassificationResult } from "./classifier";

/**
 * Builds intent-specific instructions for the model to ensure high-fidelity structured output.
 */
export function buildOrchestratorInstructions(classification: IntentClassificationResult): string {
  const instructions: string[] = [];

  switch (classification.intent) {
    case "assessment_request":
      instructions.push(`
CRITICAL ASSESSMENT GENERATION INSTRUCTION:
The user has requested an assessment/quiz/exam. You MUST generate a fully-functional Interactive Assessment by embedding an \`\`\`interactive JSON block (version "1.0", type "assessment") in your reply.
Structure:
\`\`\`interactive
{
  "version": "1.0",
  "type": "assessment",
  "title": "${classification.examType ? `${classification.examType} Practice Assessment` : 'Interactive Assessment'}",
  "mode": "${classification.wantsExamMode ? 'examination' : 'practice'}",
  "timeLimitMinutes": ${classification.targetQuestionCount ? Math.max(5, classification.targetQuestionCount * 2) : 20},
  "passingScore": 70,
  ${classification.examType ? `"examType": "${classification.examType}",` : ''}
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "Clear problem statement",
      "options": [
        { "id": "a", "label": "Option A" },
        { "id": "b", "label": "Option B" },
        { "id": "c", "label": "Option C" },
        { "id": "d", "label": "Option D" }
      ],
      "correctAnswer": "a",
      "explanation": "Detailed step-by-step reasoning explaining why option A is correct and why other options are incorrect.",
      "topic": "Topic Name",
      "difficulty": "medium"
    }
  ]
}
\`\`\`
Rules:
1. Support diverse question types where applicable: single_choice, multiple_choice, assertion_reason (with 'assertion' and 'reason'), and match_following (with 'matchPairs').
2. Every question MUST have a verified correct answer, detailed explanation, topic, and difficulty.
3. If the user asked for PYQs, mark genuine previous year questions with "isPyq": true and specify the year/exam in "examTag" (e.g. "[CBSE 2023]"). Never invent fake PYQs.
4. Begin with a concise, encouraging editorial introduction before the assessment block.`);
      break;

    case "data_visualization":
      instructions.push(`
DATA VISUALIZATION INSTRUCTION:
Present the requested data clearly. In addition to a concise summary table or text, embed an \`\`\`interactive chart block with:
\`\`\`interactive
{
  "version": "1.0",
  "type": "chart",
  "chartType": "bar",
  "title": "Title",
  "data": [{"name": "Category A", "value": 100}, {"name": "Category B", "value": 150}],
  "xAxisKey": "name",
  "series": [{"key": "value", "label": "Total"}]
}
\`\`\``);
      break;

    case "comparison_request":
      instructions.push(`
STRUCTURED COMPARISON INSTRUCTION:
Provide a rigorous comparison. Embed an \`\`\`interactive comparison block with clear entities and criteria:
\`\`\`interactive
{
  "version": "1.0",
  "type": "comparison",
  "title": "Entity Comparison",
  "entities": ["A", "B"],
  "criteria": [
    { "criterion": "Performance", "values": { "A": "High", "B": "Medium" } },
    { "criterion": "Cost", "values": { "A": "Low", "B": "High" } }
  ]
}
\`\`\``);
      break;

    case "calculation_request":
      instructions.push(`
CALCULATION INSTRUCTION:
Provide the mathematical derivation and result clearly with LaTeX notation ($...$ and $$...$$).`);
      break;

    case "timetable_request":
      instructions.push(`
TIMETABLE INSTRUCTION:
Provide an actionable, realistic study schedule formatted using responsive Markdown tables with clear time slots, subjects, and study objectives.`);
      break;

    default:
      break;
  }

  return instructions.join("\n\n");
}
