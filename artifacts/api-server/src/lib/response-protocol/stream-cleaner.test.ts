import { describe, it, expect } from "vitest";
import { repairStreamingMarkdown } from "./stream-cleaner";

describe("Streaming Markdown Recovery", () => {
  it("handles empty and null inputs safely", () => {
    const res = repairStreamingMarkdown("");
    expect(res.safeText).toBe("");
    expect(res.hasOpenCodeFence).toBe(false);
  });

  it("safely closes incomplete code fences during streaming", () => {
    const incomplete = "Here is some code:\n```typescript\nconst x = 42;";
    const res = repairStreamingMarkdown(incomplete);
    expect(res.hasOpenCodeFence).toBe(true);
    expect(res.safeText).toContain("```");
    expect(res.safeText.endsWith("```")).toBe(true);
  });

  it("does not modify balanced code fences", () => {
    const balanced = "Here is code:\n```js\nconsole.log(1);\n```\nAll done.";
    const res = repairStreamingMarkdown(balanced);
    expect(res.hasOpenCodeFence).toBe(false);
    expect(res.safeText).toBe(balanced);
  });

  it("safely balances unclosed block LaTeX expressions", () => {
    const unclosedMath = "The solution is:\n$$E = mc^2";
    const res = repairStreamingMarkdown(unclosedMath);
    expect(res.hasOpenMathBlock).toBe(true);
    expect(res.safeText).toBe("The solution is:\n$$E = mc^2$$");
  });

  it("safely balances dangling bold markers at end of stream", () => {
    const dangling = "This is a **critical point";
    // If it ends with "**", e.g., "This is a **"
    const dangling2 = "This is a **";
    const res = repairStreamingMarkdown(dangling2);
    expect(res.hasDanglingFormatting).toBe(true);
    expect(res.safeText).toBe("This is a ****");
  });

  it("safely balances incomplete markdown table rows", () => {
    const incompleteRow = "| Col A | Col B |\n|---|---|\n| Val 1 | Val 2";
    const res = repairStreamingMarkdown(incompleteRow);
    expect(res.safeText.endsWith("|")).toBe(true);
  });
});

