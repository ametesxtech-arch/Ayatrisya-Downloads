/**
 * Security validation for untrusted external inputs, prompt injection detection,
 * file uploads, path traversal mitigation, and safe extraction boundaries.
 */

// Heuristic patterns commonly used in prompt injections to override system instructions or exfiltrate secrets
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|system)\s+prompts?/i,
  /you\s+are\s+now\s+in\s+DAN\s+mode/i,
  /system\s+override\s*[:=]/i,
  /print\s+(all\s+)?(environment|system|secret|token|api_key)\s+variables?/i,
  /reveal\s+your\s+(initial|system)\s+instructions?/i,
  /assistant\s*<\s*\|\s*im_start\s*\|/i,
  /<\s*\|\s*im_end\s*\|/i,
  /\{\{\s*config\.__class__/i, // Template injection
  /\[\s*system\s*\]\s*:\s*/i,
];

export interface ContentSanitizationResult {
  isSafe: boolean;
  sanitized: string;
  flaggedPatterns: string[];
  riskLevel: "low" | "medium" | "high";
}

/**
 * Scans untrusted textual content (e.g., from web search, external docs, fetched GitHub repos)
 * for potential prompt injection or system override attempts.
 */
export function inspectContentSafety(content: string): ContentSanitizationResult {
  if (!content || typeof content !== "string") {
    return { isSafe: true, sanitized: "", flaggedPatterns: [], riskLevel: "low" };
  }

  const flagged: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      flagged.push(pattern.source);
    }
  }

  // Sanitize control characters and null bytes
  const sanitized = content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "");

  const riskLevel: "low" | "medium" | "high" =
    flagged.length >= 2 ? "high" : flagged.length === 1 ? "medium" : "low";

  return {
    isSafe: flagged.length === 0,
    sanitized,
    flaggedPatterns: flagged,
    riskLevel,
  };
}

/**
 * Validates file upload metadata and limits.
 */
export function validateUploadMetadata(file: {
  name: string;
  sizeBytes: number;
  mimeType: string;
  maxSizeBytes?: number;
}): { valid: boolean; error?: string } {
  const maxBytes = file.maxSizeBytes ?? 25 * 1024 * 1024; // 25 MB default

  if (!file.name || typeof file.name !== "string" || file.name.trim().length === 0) {
    return { valid: false, error: "File name must be specified." };
  }

  if (file.name.length > 255) {
    return { valid: false, error: "File name is too long (maximum 255 characters)." };
  }

  // Prevent path traversal in filenames
  if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
    return { valid: false, error: "File name contains invalid path traversal characters." };
  }

  if (file.sizeBytes <= 0) {
    return { valid: false, error: "File cannot be empty." };
  }

  if (file.sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds the limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    };
  }

  // Reject executable file extensions
  const dangerousExtensions = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.vbs$/i,
    /\.ps1$/i,
    /\.sh$/i,
    /\.com$/i,
    /\.scr$/i,
    /\.pif$/i,
    /\.msi$/i,
  ];

  if (dangerousExtensions.some((ext) => ext.test(file.name))) {
    return {
      valid: false,
      error: "Executable or shell script file uploads are not permitted in Cloud storage.",
    };
  }

  return { valid: true };
}

/**
 * Validates that an archive extraction entry path does not escape the target directory.
 */
export function validateArchivePath(entryPath: string, maxDepth = 10): boolean {
  if (!entryPath || typeof entryPath !== "string") return false;
  const normalized = entryPath.replace(/\\/g, "/");

  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    return false; // Absolute paths forbidden
  }

  const parts = normalized.split("/");
  let depth = 0;

  for (const part of parts) {
    if (part === "..") {
      depth--;
      if (depth < 0) return false; // Escaped root
    } else if (part !== "." && part.length > 0) {
      depth++;
    }
  }

  return depth <= maxDepth;
}
