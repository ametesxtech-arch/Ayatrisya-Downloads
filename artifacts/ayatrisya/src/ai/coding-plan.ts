import { z } from "zod";

const codingPlanSchema = z.object({
  title: z.string().trim().min(1).max(100),
  goal: z.string().trim().min(1).max(1000),
  architecture: z.string().trim().min(1).max(2000),
  phases: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    tasks: z.array(z.string().trim().min(1).max(400)).min(1).max(12),
  }).strict()).min(1).max(8),
  acceptanceChecks: z.array(z.string().trim().min(1).max(400)).min(1).max(16),
  risks: z.array(z.string().trim().min(1).max(400)).max(10),
}).strict();

export type CodingPlan = z.infer<typeof codingPlanSchema>;

export function parseCodingPlan(raw: string): CodingPlan {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    throw new Error("The Ayatrisya model did not return a valid plan. Try a shorter brief.");
  }
  return codingPlanSchema.parse(value);
}

export function formatCodingPlan(plan: CodingPlan): string {
  const phases = plan.phases.map((phase, index) =>
    `## Phase ${index + 1}: ${phase.title}\n${phase.tasks.map((task) => `- [ ] ${task}`).join("\n")}`,
  ).join("\n\n");
  const checks = plan.acceptanceChecks.map((check) => `- [ ] ${check}`).join("\n");
  const risks = plan.risks.length ? plan.risks.map((risk) => `- ${risk}`).join("\n") : "- No major risks identified.";
  return `# ${plan.title}\n\n## Goal\n${plan.goal}\n\n## Suggested architecture\n${plan.architecture}\n\n${phases}\n\n## Acceptance checks\n${checks}\n\n## Risks and safeguards\n${risks}`;
}
