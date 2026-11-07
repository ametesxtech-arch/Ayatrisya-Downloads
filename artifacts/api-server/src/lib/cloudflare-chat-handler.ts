import type { Request, Response } from "express";
import { isCloudflareConfigured } from "./cloudflare-image";
import { streamCloudflareChat, type CloudflareChatMessage } from "./cloudflare-chat";
import { searchInternet, shouldSearchInternet, formatSourcesSection, type SearchResult } from "./web-search";

export async function handleCloudflareChatFallback(
  req: Request,
  res: Response,
  chatData: {
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
    model: "v1-fast" | "v2-best";
    mode: "Normal" | "Savage" | "Joke";
    stream: boolean;
  }
): Promise<boolean> {
  if (!isCloudflareConfigured()) return false;

  const { messages: history, mode, stream } = chatData;
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  let webSearchContext = "";
  let gatheredSources: SearchResult[] = [];

  if (shouldSearchInternet(lastUserMsg)) {
    try {
      const searchResults = await searchInternet(lastUserMsg, 5);
      if (searchResults.length > 0) {
        gatheredSources = searchResults;
        webSearchContext = "\n\nLive Internet Search Results:\n" +
          searchResults.map((r, i) => `[${i + 1}] "${r.title}": ${r.snippet} (Source: ${r.link})`).join("\n") +
          "\n\nCRITICAL INSTRUCTION FOR SOURCES CITATION:\n" +
          "Use the live web search results above to provide accurate, up-to-date facts. At the very end of your response, you MUST ALWAYS provide a dedicated '### 🌐 Sources & References' section with numbered markdown links to all consulted sources.";
      }
    } catch {}
  }

  const toneInstruction =
    mode === "Savage"
      ? "Savage Mode: Be razor-sharp, brilliantly sarcastic, roast-level witty, but deliver excellent solutions."
      : mode === "Joke"
        ? "Joke Mode: Be humorous, playful, witty, and high-energy."
        : "Normal Mode: Be articulate, deeply helpful, clear, and direct.";

  const systemInstruction = `You are Ayatrisya AI, a powerful, lightning-fast intelligent reasoning, coding, and creative assistant built by Ametesx.
Tone: ${toneInstruction}${webSearchContext}

Guidelines:
1. Provide direct answers immediately without filler boilerplate ("Certainly!", "Sure!").
2. When asked to create games, scripts, or apps in Python, JavaScript, HTML, etc., write complete, working, runnable code.
3. Always wrap code in appropriate markdown fences (e.g. \`\`\`python, \`\`\`html, \`\`\`javascript).
4. For math and complexity, format with LaTeX dollar signs: $O(n)$, $O(1)$.
5. Never output fabricated external markdown image links (such as unsplash, wikimedia, or random web URLs). Image creation is handled directly by the native Ayatrisya Vision Engine.`;

  const cfMessages: CloudflareChatMessage[] = [
    { role: "system", content: systemInstruction },
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content || " ",
    })),
  ];

  try {
    const cfRes = await streamCloudflareChat(cfMessages, {
      stream,
      temperature: mode === "Savage" ? 0.9 : 0.7,
      maxTokens: 4096,
    });

    if (!cfRes.ok) return false;

    const acceptHeader = req.get("accept") ?? "";
    const isNdjson = acceptHeader.includes("ndjson");

    if (stream && cfRes.body) {
      const contentType = isNdjson ? "application/x-ndjson" : "text/event-stream";
      res.status(200);
      res.set({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "x-model-source": "ayatrisya-cloudflare-ai",
        "x-fallback-model": "@cf/meta/llama-3.1-8b-instruct",
      });

      const reader = cfRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullStreamOutput = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data:")) {
            try {
              const parsed = JSON.parse(trimmed.slice(5).trim());
              const token = parsed.response || parsed.choices?.[0]?.delta?.content || "";
              if (token) {
                fullStreamOutput += token;
                if (isNdjson) {
                  res.write(`${JSON.stringify({ token })}\n`);
                } else {
                  res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
              }
            } catch {}
          }
        }
      }

      // Ensure sources are cited at the end if web search was performed
      if (gatheredSources.length > 0) {
        const hasSourcesSection = /###\s*(🌐\s*)?(sources|references)/i.test(fullStreamOutput) ||
          gatheredSources.some((s) => fullStreamOutput.includes(s.link));
        if (!hasSourcesSection) {
          const sourcesBlock = formatSourcesSection(gatheredSources);
          if (isNdjson) {
            res.write(`${JSON.stringify({ token: sourcesBlock })}\n`);
          } else {
            res.write(`data: ${JSON.stringify({ token: sourcesBlock })}\n\n`);
          }
        }
      }

      if (isNdjson) {
        res.write(`${JSON.stringify({ done: true })}\n`);
      } else {
        res.write("data: [DONE]\n\n");
      }
      res.end();
      return true;
    } else {
      const data = (await cfRes.json()) as any;
      let text =
        data?.result?.response ||
        data?.result?.choices?.[0]?.message?.content ||
        "Ayatrisya AI generated response.";

      // Ensure sources are cited at the end if web search was performed
      if (gatheredSources.length > 0) {
        const hasSourcesSection = /###\s*(🌐\s*)?(sources|references)/i.test(text) ||
          gatheredSources.some((s) => text.includes(s.link));
        if (!hasSourcesSection) {
          text += formatSourcesSection(gatheredSources);
        }
      }

      res.status(200).set({
        "Cache-Control": "no-store",
        "x-model-source": "ayatrisya-cloudflare-ai",
        "x-fallback-model": "@cf/meta/llama-3.1-8b-instruct",
      }).json({
        text,
        provider: "cloudflare-workers-ai",
        fallbackModel: "@cf/meta/llama-3.1-8b-instruct",
      });
      return true;
    }
  } catch {
    return false;
  }
}

