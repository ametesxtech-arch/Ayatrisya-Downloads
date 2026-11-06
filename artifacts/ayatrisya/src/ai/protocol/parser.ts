/**
 * Ayatrisya Protocol Parser
 *
 * Transforms raw model responses (JSON protocol payloads, streaming fragments,
 * or mixed Markdown with interactive code fences) into a validated, ordered
 * UnifiedMessageResponse data structure.
 */

import { unifiedResponseSchema, responseBlockSchema } from "./schema";
import type { UnifiedMessageResponse, ResponseBlock, ProtocolCitationSource } from "./types";

/**
 * Sanitizes and validates a URL. Disallows dangerous schemes like javascript:,
 * data: (except safe images), or unverified protocols.
 */
export function sanitizeProtocolUrl(urlStr?: string | null): string | undefined {
  if (!urlStr || typeof urlStr !== "string") return undefined;
  const trimmed = urlStr.trim();
  if (!trimmed) return undefined;

  // Relative path or anchor is safe
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "https:" || protocol === "http:" || protocol === "mailto:") {
      return parsed.toString();
    }
    // Allow data:image/*
    if (protocol === "data:" && /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed)) {
      return trimmed;
    }
  } catch {
    // Malformed URL
  }
  return undefined;
}

/**
 * Extracts domain name from a URL string safely.
 */
export function extractDomainFromUrl(urlStr?: string): string | undefined {
  if (!urlStr) return undefined;
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Parses raw model output into a valid UnifiedMessageResponse.
 *
 * Supports:
 * 1. Native JSON UnifiedMessageResponse payloads (matching schema).
 * 2. Mixed Markdown containing fenced code blocks (```interactive, ```json, ```mermaid, etc.).
 * 3. Citation anchors and reference lists ([1] http://... or Source: ...).
 * 4. Graceful recovery when JSON is truncated or partially streamed.
 */
export function parseModelResponseToProtocol(
  rawInput: string,
  optionsOrMessageId: string | {
    messageId?: string;
    model?: string;
    mode?: string;
    isStreaming?: boolean;
  } = {}
): UnifiedMessageResponse {
  const options = typeof optionsOrMessageId === "string" ? { messageId: optionsOrMessageId } : optionsOrMessageId;
  const messageId = options.messageId || crypto.randomUUID();
  const trimmed = (rawInput || "").trim();

  if (!trimmed) {
    return {
      version: "2.0",
      messageId,
      blocks: [],
      metadata: {
        model: options.model,
        mode: options.mode,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 1. Direct JSON Check: Is this a serialized UnifiedMessageResponse or interactive block?
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsedJson = JSON.parse(trimmed);

      // A: Full UnifiedMessageResponse
      if (parsedJson && typeof parsedJson === "object" && "blocks" in parsedJson && Array.isArray(parsedJson.blocks)) {
        const validated = unifiedResponseSchema.safeParse({
          ...parsedJson,
          messageId: parsedJson.messageId || messageId,
        });
        if (validated.success) {
          return validated.data as UnifiedMessageResponse;
        }
      }

      // B: Single Interactive Block JSON object (e.g., { type: "quiz", ... })
      if (parsedJson && typeof parsedJson === "object" && typeof parsedJson.type === "string") {
        const validatedBlock = responseBlockSchema.safeParse({
          ...parsedJson,
          id: parsedJson.id || crypto.randomUUID(),
        });
        if (validatedBlock.success) {
          return {
            version: "2.0",
            messageId,
            blocks: [validatedBlock.data as ResponseBlock],
            metadata: {
              model: options.model,
              mode: options.mode,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    } catch {
      // Malformed JSON: fall through to mixed-content parser
    }
  }

  // 2. Mixed Content Parser: Scan text for fenced blocks while preserving exact order
  const blocks: ResponseBlock[] = [];

  // Fenced block delimiter pattern: ```(language)\n(code)\n```
  // Captures: ```tag ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(trimmed)) !== null) {
    const textBefore = trimmed.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      parseTextAndCitations(textBefore, blocks);
    }

    const tag = (match[1] || "").trim().toLowerCase();
    const code = match[2] || "";
    const isUnclosed = !match[0].endsWith("```");

    // Route based on tag
    if (tag === "interactive" || tag === "interactive-block" || tag === "ayatrisya-interactive") {
      try {
        const blockJson = JSON.parse(code.trim());
        const validated = responseBlockSchema.safeParse({
          ...blockJson,
          id: blockJson.id || crypto.randomUUID(),
        });
        if (validated.success) {
          blocks.push(validated.data as ResponseBlock);
        } else {
          // Graceful fallback: render as code block rather than crashing
          blocks.push({
            type: "code",
            id: crypto.randomUUID(),
            language: "json",
            code: code.trim(),
            title: "Interactive Specification",
          });
        }
      } catch {
        if (options.isStreaming && isUnclosed) {
          blocks.push({
            type: "progress",
            id: crypto.randomUUID(),
            label: "Rendering interactive component…",
          });
        } else {
          blocks.push({
            type: "code",
            id: crypto.randomUUID(),
            language: "json",
            code: code.trim(),
          });
        }
      }
    } else if (tag === "mermaid" || tag === "flowchart") {
      blocks.push({
        type: "diagram",
        id: crypto.randomUUID(),
        diagramType: tag === "flowchart" ? "flowchart" : "mermaid",
        code: code.trim(),
        title: tag === "flowchart" ? "Flowchart" : "Mermaid Diagram",
      });
    } else if (tag === "math" || tag === "latex") {
      blocks.push({
        type: "math",
        id: crypto.randomUUID(),
        expression: code.trim(),
        displayMode: true,
      });
    } else if (tag === "json" && /"type"\s*:\s*"(quiz|chart|table|form|diagram|citation|math)"/.test(code)) {
      // JSON block specifying an interactive block
      try {
        const parsed = JSON.parse(code.trim());
        const validated = responseBlockSchema.safeParse({
          ...parsed,
          id: parsed.id || crypto.randomUUID(),
        });
        if (validated.success) {
          blocks.push(validated.data as ResponseBlock);
        } else {
          blocks.push({
            type: "code",
            id: crypto.randomUUID(),
            language: "json",
            code: code.trim(),
          });
        }
      } catch {
        blocks.push({
          type: "code",
          id: crypto.randomUUID(),
          language: "json",
          code: code.trim(),
        });
      }
    } else {
      // Standard code block
      blocks.push({
        type: "code",
        id: crypto.randomUUID(),
        language: tag || "text",
        code: code.replace(/\n$/, ""),
        allowRun: ["javascript", "js", "typescript", "ts", "html"].includes(tag),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text after last code block
  const trailingText = trimmed.slice(lastIndex);
  if (trailingText.trim()) {
    parseTextAndCitations(trailingText, blocks);
  }

  return {
    version: "2.0",
    messageId,
    blocks,
    metadata: {
      model: options.model,
      mode: options.mode,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Extracts citations and sources from markdown prose and appends blocks.
 */
function parseTextAndCitations(textChunk: string, outBlocks: ResponseBlock[]): void {
  // Check for Sources / References section or inline source citations
  // e.g. "Source: [Docs](https://...)" or "### Sources:\n1. [Title](https://...)"
  const sourcesSectionMatch = /(?:\n|^)(?:###?\s*)?(?:Sources?|References?|Citations?|Bibliography)[\s:]*([\s\S]+)$/i.exec(textChunk);

  if (sourcesSectionMatch && sourcesSectionMatch.index !== undefined) {
    const prose = textChunk.slice(0, sourcesSectionMatch.index).trim();
    if (prose) {
      outBlocks.push({
        type: "markdown",
        id: crypto.randomUUID(),
        content: prose,
      });
    }

    const rawSources = sourcesSectionMatch[1].trim();
    const sources: ProtocolCitationSource[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?:^|\s)(https?:\/\/[^\s)]+)/gm;

    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = linkRegex.exec(rawSources)) !== null) {
      const title = (lineMatch[1] || lineMatch[2] || lineMatch[3] || "Reference Source").trim();
      const rawUrl = lineMatch[2] || lineMatch[3];
      const safeUrl = sanitizeProtocolUrl(rawUrl);
      const domain = extractDomainFromUrl(safeUrl);

      sources.push({
        id: crypto.randomUUID(),
        title,
        url: safeUrl,
        domain,
        verified: Boolean(safeUrl),
      });
    }

    if (sources.length > 0) {
      outBlocks.push({
        type: "citation",
        id: crypto.randomUUID(),
        sources,
      });
    } else {
      outBlocks.push({
        type: "markdown",
        id: crypto.randomUUID(),
        content: sourcesSectionMatch[0].trim(),
      });
    }
  } else {
    // Normal markdown prose block
    outBlocks.push({
      type: "markdown",
      id: crypto.randomUUID(),
      content: textChunk.trim(),
    });
  }
}
