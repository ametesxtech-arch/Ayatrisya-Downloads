import { z } from "zod";

const replySchema = z.object({
  summary: z.string().min(1).max(3000),
  edits: z.array(z.object({
    path: z.string().min(1).max(2048),
    content: z.string().max(80000),
    reason: z.string().max(500),
  }).strict()).max(6),
  newFiles: z.array(z.object({
    path: z.string().min(1).max(120),
    content: z.string().max(80000),
    reason: z.string().max(500),
  }).strict()).max(8).default([]),
  commands: z.array(z.object({
    command: z.string().min(1).max(200),
    reason: z.string().max(500),
  }).strict()).max(4),
}).strict();

export type CodingAgentProposal = {
  summary: string;
  edits: Array<{ path: string; content: string; reason: string; applied: boolean }>;
  newFiles: Array<{ path: string; content: string; reason: string; created: boolean }>;
  commands: Array<{ command: string; reason: string; runnable: boolean }>;
};

const allowedExtensions = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".h", ".hpp", ".html", ".java", ".js", ".jsx",
  ".json", ".kt", ".md", ".mjs", ".py", ".rb", ".rs", ".scss", ".sql", ".svelte", ".swift",
  ".ts", ".tsx", ".vue", ".xml", ".yaml", ".yml",
]);

const excludedSegments = new Set([
  ".git", ".ssh", ".aws", ".config", "node_modules", "vendor", "dist", "build", "coverage",
]);

export function isEligibleCodingFile(relativePath: string): boolean {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  const filename = parts.at(-1)?.toLowerCase() ?? "";
  if (
    !filename ||
    relativePath.startsWith("/") ||
    /^[a-z]:/i.test(relativePath) ||
    parts.some((part) => !part || part === "." || part === ".." || excludedSegments.has(part.toLowerCase()))
  ) return false;
  if (
    filename === ".env" ||
    filename.startsWith(".env.") ||
    /(^|[._-])(secret|secrets|credential|credentials|private-key)([._-]|$)/i.test(filename) ||
    /\.(pem|key|p12|pfx|jks|keystore|crt|cer)$/i.test(filename)
  ) return false;
  const dot = filename.lastIndexOf(".");
  return dot > 0 && allowedExtensions.has(filename.slice(dot));
}

export function isSafeNewFileName(fileName: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(fileName) && isEligibleCodingFile(fileName);
}

export function hasLikelySecret(content: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) ||
    /\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,})\b/.test(content) ||
    /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|token|password)\b\s*[:=]\s*["'][^"'\r\n]{12,}["']/i.test(content);
}

export function isAllowedAgentCommand(command: string): boolean {
  return /^(?:pnpm|npm|yarn|bun) (?:test|lint|build|typecheck|run (?:test|lint|build|typecheck))$/.test(command);
}

export function parseCodingAgentProposal(raw: string, selectedPaths: string[], existingNames: string[] = []): CodingAgentProposal {
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    throw new Error("The model did not return valid JSON. Retry with a shorter request.");
  }
  const parsed = replySchema.parse(value);
  const allowedPaths = new Set(selectedPaths);
  const existing = new Set(existingNames.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  const seenNew = new Set<string>();
  for (const edit of parsed.edits) {
    if (!allowedPaths.has(edit.path)) throw new Error("The model proposed editing a file you did not select. No changes were applied.");
    if (seen.has(edit.path)) throw new Error("The model proposed the same file more than once. No changes were applied.");
    if (!isEligibleCodingFile(edit.path)) throw new Error("The model proposed an unsupported or sensitive file. No changes were applied.");
    if (hasLikelySecret(edit.content)) throw new Error(`The proposed content for ${edit.path} appears to contain a secret. Review it manually; nothing was applied.`);
    seen.add(edit.path);
  }
  for (const file of parsed.newFiles) {
    const key = file.path.toLowerCase();
    if (!isSafeNewFileName(file.path)) throw new Error("The model proposed an unsafe or unsupported new file. Nothing was created.");
    if (existing.has(key) || seenNew.has(key)) throw new Error("The model proposed a new file name that already exists or is repeated. Nothing was created.");
    if (hasLikelySecret(file.content)) throw new Error(`The proposed content for ${file.path} appears to contain a secret. Review it manually; nothing was created.`);
    seenNew.add(key);
  }
  return {
    summary: parsed.summary,
    edits: parsed.edits.map((edit) => ({ ...edit, applied: false })),
    newFiles: parsed.newFiles.map((file) => ({ ...file, created: false })),
    commands: parsed.commands.map((item) => ({
      ...item,
      runnable: isAllowedAgentCommand(item.command),
    })),
  };
}
