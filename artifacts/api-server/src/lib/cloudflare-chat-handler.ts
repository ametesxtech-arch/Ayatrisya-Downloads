import type { Request, Response } from "express";
import { isCloudflareConfigured } from "./cloudflare-image";
import { streamCloudflareChat, type CloudflareChatMessage } from "./cloudflare-chat";

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
  const toneInstruction =
    mode === "Savage"
      ? "Savage Mode: Be razor-sharp, brilliantly sarcastic, roast-level witty, but deliver excellent solutions."
      : mode === "Joke"
        ? "Joke Mode: Be humorous, playful, witty, and high-energy."
        : "Normal Mode: Be articulate, deeply helpful, clear, and direct.";

  const systemInstruction = `You are Ayatrisya AI, a powerful, lightning-fast intelligent reasoning, coding, and creative assistant built by Ametesx.
Tone: ${toneInstruction}

Guidelines:
1. Provide direct answers immediately without filler boilerplate ("Certainly!", "Sure!").
2. When asked to create games, scripts, or apps in Python, JavaScript, HTML, etc., write complete, working, runnable code.
3. Always wrap code in appropriate markdown fences (e.g. \`\`\`python, \`\`\`html, \`\`\`javascript).
4. For math and complexity, format with LaTeX dollar signs: $O(n)$, $O(1)$.`;

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

      if (isNdjson) {
        res.write(`${JSON.stringify({ done: true })}\n`);
      } else {
        res.write("data: [DONE]\n\n");
      }
      res.end();
      return true;
    } else {
      const data = (await cfRes.json()) as any;
      const text =
        data?.result?.response ||
        data?.result?.choices?.[0]?.message?.content ||
        "Ayatrisya AI generated response.";

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

