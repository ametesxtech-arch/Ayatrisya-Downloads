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

    case "artifact_creation":
      if (classification.tags.includes("presentation") || classification.tags.includes("slides") || classification.tags.includes("pptx")) {
        instructions.push(`
CRITICAL PRESENTATION & SLIDE DECK (PPT/PPTX) GENERATION INSTRUCTION:
The user has requested a presentation / slide deck / PPT. You MUST generate an in-chat interactive presentation artifact by embedding a \`\`\`presentation block containing structured JSON.

Every slide must include:
1. "title": Catchy, impactful slide headline
2. "subtitle": Contextual tag or category
3. "content": Full, deep, human-like editorial explanation (2-3 articulate sentences of thoughtful prose, NOT brief 3-word fragments)
4. "bullets": 2 to 4 bullet points highlighting nuanced arguments, metrics, or insights
5. "smartArt": A structured SmartArt visual object:
   - "type": "steps" | "cycle" | "pyramid" | "matrix" | "kpi" | "callout" | "comparison"
   - "items": Array of { "label": string, "description"?: string, "value"?: string, "badge"?: string }
6. "image": Curated high-resolution image URL from Unsplash with a relevant topic keyword (e.g. "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1000&q=80" for space/tech, "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1000&q=80" for nature/science, "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80" for business/city) along with "caption": string and "source": "Unsplash".
7. "speakerNotes": Natural, spoken presenter narration.

Structure:
\`\`\`presentation
{
  "title": "Deck Title",
  "theme": "dark-cinematic",
  "slides": [
    {
      "title": "Executive Vision & Market Thesis",
      "subtitle": "Market Context",
      "content": "The convergence of edge AI with low-latency communication unlocks unprecedented capabilities for automated workflows and institutional intelligence.",
      "bullets": [
        "Rapid expansion of edge computing footprint across Tier-1 enterprise clusters",
        "Deterministic latency profile reduced from 250ms to sub-35ms across verified backbones",
        "Democratized access to local intelligence without cloud dependency"
      ],
      "smartArt": {
        "type": "kpi",
        "items": [
          { "label": "Performance Lift", "value": "+320%", "badge": "Verified Benchmark" },
          { "label": "Latency Drop", "value": "-86%", "badge": "p99 Tail" },
          { "label": "Enterprise Adoption", "value": "1,450+", "badge": "Global" }
        ]
      },
      "image": {
        "url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1000&q=80",
        "caption": "Next-generation distributed intelligence topology",
        "source": "Unsplash"
      },
      "speakerNotes": "Thank you for joining today. In this deck, we look at the structural shift toward decentralized AI systems..."
    }
  ]
}
\`\`\`
This enables the user to view interactive widescreen slides right in the chat, navigate them, and immediately download genuine .PPTX or .PDF files!`);
      } else if (classification.tags.includes("document") || classification.tags.includes("pdf") || classification.tags.includes("docx")) {
        instructions.push(`
CRITICAL STRUCTURED DOCUMENT (PDF / DOCX) GENERATION INSTRUCTION:
The user has requested a PDF / Word document / DOCX / comprehensive report. You MUST generate an in-chat interactive document artifact by embedding a \`\`\`document block.

Requirements:
1. Full, human-like editorial prose: write complete, deep, articulate paragraphs with executive summaries, background context, in-depth analysis, and actionable conclusions. Avoid lazy placeholders.
2. SmartArt & Visual Callouts: Use rich markdown callouts (> [!NOTE], > [!IMPORTANT], > [!TIP]) to highlight key principles, and format structured KPI metrics or process steps.
3. Curated imagery: embed relevant high-resolution photos with captions and source badges:
   ![Visualizing Global Infrastructure](https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1000&q=80)
   *Figure 1: Global satellite communication network (Source: Unsplash / Curated Science)*
4. The in-chat card will provide immediate one-click .PDF and .DOCX download actions!`);
      } else {
        instructions.push(`
ARTIFACT CREATION INSTRUCTION:
Provide clean, production-grade artifact code (HTML, React, or structured document) encapsulated within appropriate markdown blocks.`);
      }
      break;

    case "project_planning":
      instructions.push(`
CRITICAL PLANNER AGENT INSTRUCTION:
You are acting as Ayatrisya Lead Systems Planner Agent. Deliver a rigorous, production-grade architectural and implementation blueprint.
Format your response with:
1. Executive Goal & Architectural Topology: High-level overview, components, data flow, and separation of concerns.
2. Multi-Phase Implementation Roadmap: Break the project into concrete chronological phases (Phase 1: Foundation -> Phase 2: Core Engine -> Phase 3: Integration -> Phase 4: Production Hardening).
3. Risk & Mitigation Matrix: Explicit failure modes, concurrency issues, bottlenecks, and their exact engineering countermeasures.
4. Acceptance Criteria & Testable Verification Gates: Measurable indicators that prove each milestone is successfully completed.
5. Interactive Plan Block: Embed a structured \`\`\`interactive steps or checklist block when helpful for the user to track milestone progress.`);
      break;

    case "code_generation":
      instructions.push(`
CRITICAL CODER AGENT INSTRUCTION:
You are acting as Ayatrisya Senior Staff Coder Agent. Produce production-grade, battle-tested code following strict professional engineering standards:
1. Complete, zero-placeholder implementation: Never emit "// TODO: implement later" or ellipsis. Write the real, working code.
2. Strict Type Safety: Use explicit types, interfaces, and generic bounds without abusive 'any' casts.
3. Defensive Error Handling: Guard against null/undefined, handle edge cases, validate inputs, and handle async rejections cleanly.
4. Test-Driven Verification: Always include comprehensive unit tests (using Vitest, Jest, or Pytest) covering happy paths, edge cases, and failure modes.
5. Performance & Security Hygiene: Use optimal algorithmic complexity, prevent memory leaks, sanitize inputs against injection, and avoid exposing secrets.`);
      break;

    case "security_audit":
      instructions.push(`
SECURITY & HARDENING SPECIALIST INSTRUCTION:
Perform a deep security and vulnerability analysis:
1. Threat Vector Identification: Identify risks against OWASP Top 10 (Injection, Broken Auth, SSRF, IDOR, XSS, CSRF).
2. Root Cause & Exploit Scenario: Explain exactly how an adversary could trigger the issue.
3. Concrete Hardening Patch: Provide copy-pasteable, defense-in-depth code patches with parameterization, contextual escaping, or cryptographic validation.`);
      break;

    case "database_design":
      instructions.push(`
DATABASE ARCHITECT SPECIALIST INSTRUCTION:
Deliver an optimized, transactionally safe database design:
1. Entity-Relationship & Schema Definition: Clean DDL statements with primary keys, foreign keys with ON DELETE actions, and NOT NULL constraints.
2. Indexing Strategy: Explain B-Tree, GIN, or composite indexes tailored to specific query filter patterns.
3. Concurrency & ACID Safety: Include isolation levels, transactions, and upsert (ON CONFLICT) semantics.`);
      break;

    case "algorithm_design":
      instructions.push(`
ALGORITHMIC COMPLEXITY SPECIALIST INSTRUCTION:
Provide an optimal algorithmic solution:
1. Mathematical Complexity Analysis: Derive exact Big-O Time Complexity and Space Complexity using KaTeX ($O(N \\log N)$, $O(1)$) with rigorous justification.
2. Optimal Data Structure Selection: Explain why the chosen data structure (Hash Map, Min-Heap, Trie, etc.) outperforms naive alternatives.
3. Implementation & Invariant Verification: Write the complete algorithm and walk through invariant maintenance across edge cases (empty lists, duplicates, single elements).`);
      break;

    default:
      break;
  }

  return instructions.join("\n\n");
}

