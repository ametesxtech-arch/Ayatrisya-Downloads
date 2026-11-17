export type ConversationIntent =
  | "general_conversation"
  | "correspondence_or_creative"
  | "summarization"
  | "assessment_request"
  | "code_generation"
  | "project_planning"
  | "security_audit"
  | "database_design"
  | "algorithm_design"
  | "technical_explanation"
  | "data_visualization"
  | "comparison_request"
  | "calculation_request"
  | "timetable_request"
  | "artifact_creation"
  | "research_query";

export interface IntentClassificationResult {
  intent: ConversationIntent;
  confidence: number;
  tags: string[];
  suggestedBlockType?: string;
  wantsPracticeMode?: boolean;
  wantsExamMode?: boolean;
  wantsOneQuestionAtATime?: boolean;
  wantsInteractive?: boolean;
  targetQuestionCount?: number;
  examType?: string; // CBSE, NEET, JEE, etc.
}

/**
 * Deterministic and semantic intent classifier for Conversational Experience 2.0.
 * Accurately detects when users request assessments, visualizations, comparisons, or calculations.
 */
export function classifyConversationIntent(
  userPrompt: string,
  history?: Array<{ role: string; content: string }>,
): IntentClassificationResult {
  const p = (userPrompt || "").trim().toLowerCase();
  const tags: string[] = [];

  // Check conversational history to contextualize follow-up requests (e.g. "make it interactive")
  const priorContent = (history || [])
    .slice(-4)
    .map((m) => m.content)
    .join("\n");
  const priorHasQuizOrQuestions =
    /\b(quiz|mcq|question\s*\d|1\.\s+|options?|answer|assessment|test|problems?)\b/i.test(priorContent);

  // Direct interactive request patterns
  const isExplicitInteractiveRequest =
    /\b(make\s+it\s+interactive|turn\s+(this|it)\s+into\s+a\s+quiz|ask\s+me\s+one\s+question\s+at\s+a\s+time|test\s+my\s+knowledge|let\s+me\s+answer(\s+by\s+clicking)?|let\s+me\s+solve\s+it\s+myself|create\s+an\s+interactive\s+practice\s+session|interactive\s+practice|interactive\s+quiz|do\s+it\s+interactively|interactive\s+learning\s+activity)\b/i.test(
      p,
    ) || (priorHasQuizOrQuestions && /\b(interactive|interactively|one\s*by\s*one|one\s*at\s*a\s*time|quiz\s*me|test\s*me|let\s*me\s*try)\b/i.test(p));

  // 1. Assessment / MCQ / Exam Request Detection
  const isMcqRequest =
    isExplicitInteractiveRequest ||
    /\b(mcqs?|quiz(zes)?|questions?|test|exam|mock\s*test|practice\s*questions?|assessment|pyqs?|sample\s*paper|assertion\s*(and|&)\s*reasoning|match\s*the\s*following)\b/i.test(
      p,
    );

  const hasExamIndicators = /\b(cbse|neet|jee|board\s*exam|upsc|sat|gre|gmat|gate|class\s*1[0-2]|class\s*[6-9])\b/i.test(p);
  const wantsExamMode = /\b(exam\s*mode|examination\s*mode|strict\s*mode|timed\s*test|test\s*mode)\b/i.test(p);
  const wantsOneQuestionAtATime = /\b(one\s*question\s*at\s*a\s*time|one\s*by\s*one|step\s*by\s*step)\b/i.test(p);
  const wantsPracticeMode = wantsOneQuestionAtATime || isExplicitInteractiveRequest || /\b(practice\s*mode|learn\s*mode|immediate\s*feedback)\b/i.test(p);

  // Extract count if user specified (e.g., "give me 10 MCQs" or "15 CBSE Physics questions")
  const countMatch =
    p.match(/\b(\d+)\s+(?:[a-z0-9_-]+\s+){0,5}(mcqs?|questions?|problems?)\b/i) ||
    p.match(/\b(\d+)\s*(mcqs?|questions?|problems?)\b/i);
  const targetQuestionCount = countMatch ? parseInt(countMatch[1], 10) : undefined;

  let examType: string | undefined;
  if (/cbse/i.test(p)) examType = "CBSE";
  else if (/neet/i.test(p)) examType = "NEET";
  else if (/jee/i.test(p)) examType = "JEE";
  else if (/gate/i.test(p)) examType = "GATE";

  if (isMcqRequest) {
    if (hasExamIndicators) tags.push("standardized_exam");
    if (wantsExamMode) tags.push("examination_mode");
    if (wantsPracticeMode) tags.push("practice_mode");
    if (isExplicitInteractiveRequest) tags.push("interactive_quiz");
    if (wantsOneQuestionAtATime) tags.push("one_question_at_a_time");

    return {
      intent: "assessment_request",
      confidence: 0.95,
      tags,
      suggestedBlockType: "assessment",
      wantsPracticeMode: !wantsExamMode,
      wantsExamMode,
      wantsOneQuestionAtATime,
      wantsInteractive: true,
      targetQuestionCount,
      examType,
    };
  }

  // 1b. Correspondence (Letters, Emails, Memos) & Creative Writing (Stories, Poems, Speeches)
  if (
    /\b(letter(\s+(on|about|to|for|regarding))?|write\s+(a\s+)?letter|make\s+(a\s+)?letter|draft\s+(a\s+)?letter|compose\s+(a\s+)?letter|email|write\s+(an\s+)?email|draft\s+(an\s+)?email|memo|speech|poem|poetry|essay|story|dialogue)\b/i.test(p)
  ) {
    const isLetter = /\bletter\b/i.test(p);
    const isEmail = /\bemail\b/i.test(p);
    return {
      intent: "correspondence_or_creative",
      confidence: 0.94,
      tags: [isLetter ? "letter" : isEmail ? "email" : "creative_writing"],
    };
  }

  // 1c. Summarization / TL;DR Request
  if (/\b(summariz(e|ation)|summary|tldr|tl;dr|key\s*takeaways|recap|condense|abstract)\b/i.test(p)) {
    return {
      intent: "summarization",
      confidence: 0.92,
      tags: ["summary"],
    };
  }

  // 1d. Flashcard Request Detection
  if (/\b(flashcards?|study\s*cards?|make\s+flashcards)\b/i.test(p)) {
    return {
      intent: "technical_explanation",
      confidence: 0.92,
      tags: ["flashcards", "interactive"],
      suggestedBlockType: "flashcard",
      wantsInteractive: true,
    };
  }

  // 1c. Step by step explanation request
  if (/\b(explain\s+this\s+step\s+by\s+step|step\s*by\s*step\s*(guide|tutorial|breakdown)|walk\s+me\s+through\s+step\s+by\s+step)\b/i.test(p)) {
    return {
      intent: "project_planning",
      confidence: 0.9,
      tags: ["steps", "step_by_step", "interactive"],
      suggestedBlockType: "steps",
      wantsInteractive: true,
    };
  }

  // 2. Data Visualization / Chart Request
  if (/\b(chart|graph|plot|visualiz(e|ation)|bar\s*chart|line\s*chart|pie\s*chart|histogram)\b/i.test(p)) {
    return {
      intent: "data_visualization",
      confidence: 0.9,
      tags: ["visualization"],
      suggestedBlockType: "chart",
    };
  }

  // 3. Comparison Request
  if (/\b(compare|comparison|versus|vs\.?|difference\s*between|pros\s*and\s*cons)\b/i.test(p)) {
    return {
      intent: "comparison_request",
      confidence: 0.88,
      tags: ["comparison"],
      suggestedBlockType: "comparison",
    };
  }

  // 4. Calculation / Formula Request
  if (/\b(calculat(e|or|ion)|compute|solve\s*for|formula|percentage|interest|bmi)\b/i.test(p)) {
    return {
      intent: "calculation_request",
      confidence: 0.85,
      tags: ["calculation"],
      suggestedBlockType: "calculator",
    };
  }

  // 5. Timetable / Schedule Request
  if (/\b(timetable|study\s*plan|schedule|routine|daily\s*planner|curriculum)\b/i.test(p)) {
    return {
      intent: "timetable_request",
      confidence: 0.9,
      tags: ["timetable"],
      suggestedBlockType: "timetable",
    };
  }

  // 6. Presentation / Slide Deck (PPT, PPTX) Request
  if (/\b(presentation|slides?|slide\s*deck|pitch\s*deck|ppt|pptx|powerpoint)\b/i.test(p)) {
    return {
      intent: "artifact_creation",
      confidence: 0.95,
      tags: ["artifact", "presentation", "slides", "pptx", "smartart"],
      suggestedBlockType: "artifact",
    };
  }

  // 7. Structured Document / PDF / DOCX Request
  if (/\b(pdf|docx?|word\s*doc(ument)?|whitepaper|report|manual|handbook)\b/i.test(p)) {
    return {
      intent: "artifact_creation",
      confidence: 0.95,
      tags: ["artifact", "document", "pdf", "docx", "smartart"],
      suggestedBlockType: "artifact",
    };
  }

  // 8. Artifact / Website / Application Creation
  if (/\b(build|create|make|design)\s+(a\s+)?(website|web\s*page|landing\s*page|html|interactive\s*tool|canvas\s*project|app|dashboard)\b/i.test(p)) {
    return {
      intent: "artifact_creation",
      confidence: 0.9,
      tags: ["artifact"],
      suggestedBlockType: "artifact",
    };
  }

  // 9. Project Planning / Architecture Roadmap (Planner Agent)
  if (/\b(plan\s*(this|a)?\s*project|roadmap|architecture|system\s*design|milestones?|planner\s*agent|breakdown|wbs|spec(ification)?)\b/i.test(p)) {
    return {
      intent: "project_planning",
      confidence: 0.92,
      tags: ["planner", "architecture", "roadmap"],
      suggestedBlockType: "steps",
    };
  }

  // 10. Security Audit & Vulnerability Assessment
  if (/\b(security|vulnerabilit(y|ies)|owasp|xss|csrf|sqli|penetration|audit|threat|hardening|auth\s*bypass|sanitize)\b/i.test(p)) {
    return {
      intent: "security_audit",
      confidence: 0.9,
      tags: ["security", "audit", "hardening"],
      suggestedBlockType: "checklist",
    };
  }

  // 11. Database Modeling & SQL Architecture
  if (/\b(database|schema|sql|postgres|mysql|sqlite|migration|table\s*design|indexing|foreign\s*key|acid|normalization)\b/i.test(p)) {
    return {
      intent: "database_design",
      confidence: 0.88,
      tags: ["database", "sql", "schema"],
      suggestedBlockType: "table",
    };
  }

  // 12. Algorithmic Problem Solving & Complexity
  if (/\b(algorithm|time\s*complexity|space\s*complexity|big\s*o|dynamic\s*programming|binary\s*search|dijkstra|graph\s*traversal|sorting\s*algorithm)\b/i.test(p)) {
    return {
      intent: "algorithm_design",
      confidence: 0.88,
      tags: ["algorithm", "complexity", "data_structures"],
      suggestedBlockType: "code",
    };
  }

  // 13. Code Generation (Coder Agent)
  if (/\b(write\s+code|implement|function|algorithm|typescript|python|javascript|react|rust|golang|sql|bug|fix\s+code|coder\s*agent|refactor|unit\s*test)\b/i.test(p)) {
    return {
      intent: "code_generation",
      confidence: 0.88,
      tags: ["code", "coder_agent"],
      suggestedBlockType: "code",
    };
  }

  // 8. Research / Fact Query (Requiring Web Search)
  if (/\b(who\s*is|what\s*is|where\s*is|latest|recent|news|current|price|stock|weather|score|today)\b/i.test(p)) {
    return {
      intent: "research_query",
      confidence: 0.82,
      tags: ["web_search"],
    };
  }

  // 9. Technical / Deep Explanation
  if (/\b(explain|how\s*does|why\s*does|derive|proof|mechanism|architecture|concept)\b/i.test(p)) {
    return {
      intent: "technical_explanation",
      confidence: 0.8,
      tags: ["explanation"],
    };
  }

  return {
    intent: "general_conversation",
    confidence: 0.7,
    tags: ["conversation"],
  };
}
