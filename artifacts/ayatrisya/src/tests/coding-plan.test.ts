import { describe, expect, it } from "vitest";
import { formatCodingPlan, parseCodingPlan } from "../ai/coding-plan";

const response = {
  title: "A small platform game",
  goal: "Build a playable browser game.",
  architecture: "React game screen with local keyboard controls.",
  phases: [
    { title: "Core loop", tasks: ["Create the player and movement loop."] },
    { title: "Polish", tasks: ["Add restart and score display."] },
  ],
  acceptanceChecks: ["The player can move with arrow keys."],
  risks: ["Avoid trapping keyboard focus."],
};

describe("Ayatrisya coding planner output", () => {
  it("validates plans and formats a saved Markdown task", () => {
    const plan = parseCodingPlan(JSON.stringify(response));
    const markdown = formatCodingPlan(plan);
    expect(markdown).toContain("# A small platform game");
    expect(markdown).toContain("## Phase 1: Core loop");
    expect(markdown).toContain("- [ ] The player can move with arrow keys.");
  });

  it("rejects malformed or unbounded plans", () => {
    expect(() => parseCodingPlan("not json")).toThrow(/valid plan/);
    expect(() => parseCodingPlan(JSON.stringify({ ...response, extra: "not allowed" }))).toThrow();
    expect(() => parseCodingPlan(JSON.stringify({ ...response, phases: [] }))).toThrow();
  });
});
