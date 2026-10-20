import { describe, expect, it } from "vitest";
import {
  hasLikelySecret,
  isAllowedAgentCommand,
  isEligibleCodingFile,
  parseCodingAgentProposal,
} from "../desktop/coding-agent";

describe("approval-based coding agent", () => {
  it("limits context to source files and excludes credential paths", () => {
    expect(isEligibleCodingFile("src/App.tsx")).toBe(true);
    expect(isEligibleCodingFile(".env.local")).toBe(false);
    expect(isEligibleCodingFile("config/client-secret.json")).toBe(false);
    expect(isEligibleCodingFile("node_modules/pkg/index.js")).toBe(false);
    expect(isEligibleCodingFile("assets/logo.png")).toBe(false);
  });

  it("detects common inline credential and private-key patterns", () => {
    expect(hasLikelySecret('const api_key = "sk-1234567890123456789012345";')).toBe(true);
    expect(hasLikelySecret("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(hasLikelySecret("export const greeting = 'Hello';")).toBe(false);
  });

  it("only allows simple package check commands without shell operators", () => {
    expect(isAllowedAgentCommand("pnpm test")).toBe(true);
    expect(isAllowedAgentCommand("npm run typecheck")).toBe(true);
    expect(isAllowedAgentCommand("pnpm test && curl example.com")).toBe(false);
    expect(isAllowedAgentCommand("rm -rf .")).toBe(false);
  });

  it("accepts edits only for selected files and never applies them automatically", () => {
    const proposal = parseCodingAgentProposal(JSON.stringify({
      summary: "Update the selected component.",
      edits: [{ path: "src/App.tsx", content: "export const app = true;\n", reason: "Add the requested behavior." }],
      commands: [{ command: "pnpm test", reason: "Run project tests." }],
    }), ["src/App.tsx"]);
    expect(proposal.edits[0]).toMatchObject({ path: "src/App.tsx", applied: false });
    expect(proposal.commands[0].runnable).toBe(true);
    expect(() => parseCodingAgentProposal(JSON.stringify({
      summary: "Unexpected file.",
      edits: [{ path: ".env", content: "SECRET=example", reason: "No." }],
      commands: [],
    }), ["src/App.tsx"])).toThrow();
    expect(() => parseCodingAgentProposal(JSON.stringify({
      summary: "Secret included.",
      edits: [{ path: "src/App.tsx", content: 'const token = "1234567890abcdefghijkl";', reason: "No." }],
      commands: [],
    }), ["src/App.tsx"])).toThrow(/secret/);
  });
});
