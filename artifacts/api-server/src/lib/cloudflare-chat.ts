import { isCloudflareConfigured } from "./cloudflare-image";

const CLOUDFLARE_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export interface CloudflareChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Executes chat inference using Cloudflare Workers AI with streaming support.
 */
export async function streamCloudflareChat(
  messages: CloudflareChatMessage[],
  options: {
    stream: boolean;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }
): Promise<Response> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Workers AI credentials missing.");
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_CHAT_MODEL}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      stream: options.stream,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
    signal: options.signal ?? AbortSignal.timeout(60000),
  });

  return response;
}

