/**
 * Streaming Markdown & Structured Block Recovery Engine
 * Prevents visual artifacts (e.g. literal asterisks, unclosed code fences,
 * unclosed math formulas, truncated tables) during real-time streaming.
 */

export interface StreamRepairResult {
  safeText: string;
  hasOpenCodeFence: boolean;
  hasOpenMathBlock: boolean;
  hasOpenInlineMath: boolean;
  hasDanglingFormatting: boolean;
}

export function repairStreamingMarkdown(raw: string): StreamRepairResult {
  if (!raw) {
    return {
      safeText: "",
      hasOpenCodeFence: false,
      hasOpenMathBlock: false,
      hasOpenInlineMath: false,
      hasDanglingFormatting: false,
    };
  }

  let text = raw;
  let hasOpenCodeFence = false;
  let hasOpenMathBlock = false;
  let hasOpenInlineMath = false;
  let hasDanglingFormatting = false;

  // 1. Detect open code fences (triple backticks)
  const fenceMatches = text.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    hasOpenCodeFence = true;
  }

  // If inside a code fence, we don't format math or bold inside it
  if (hasOpenCodeFence) {
    // Append a closing fence for safe rendering preview
    return {
      safeText: text + "\n```",
      hasOpenCodeFence: true,
      hasOpenMathBlock: false,
      hasOpenInlineMath: false,
      hasDanglingFormatting: false,
    };
  }

  // 2. Detect unclosed block math $$...$$
  const blockMathMatches = text.match(/\$\$/g);
  if (blockMathMatches && blockMathMatches.length % 2 !== 0) {
    hasOpenMathBlock = true;
    text = text + "$$";
  }

  // 3. Detect unclosed inline math $...$ (ignoring escaped \$)
  if (!hasOpenMathBlock) {
    const singleDollars = text.match(/(?<!\\)\$/g);
    if (singleDollars && singleDollars.length % 2 !== 0) {
      hasOpenInlineMath = true;
      text = text + "$";
    }
  }

  // 4. Handle dangling bold or italic at the very end of stream
  // e.g., ending with "**", "*", "___", "__", or "_"
  const danglingEndMatch = text.match(/(\*{1,3}|_{1,3})$/);
  if (danglingEndMatch) {
    hasDanglingFormatting = true;
    const marker = danglingEndMatch[1];
    // Close the trailing formatting marker
    text = text + marker;
  }

  // 5. Detect and balance unclosed markdown table rows
  const lines = text.split("\n");
  const lastLine = lines[lines.length - 1];
  if (lastLine.startsWith("|") && !lastLine.endsWith("|")) {
    text = text + " |";
  }

  return {
    safeText: text,
    hasOpenCodeFence,
    hasOpenMathBlock,
    hasOpenInlineMath,
    hasDanglingFormatting,
  };
}

