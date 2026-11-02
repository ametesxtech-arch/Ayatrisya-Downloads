const http = require("node:http");
const { URL } = require("node:url");
const { assertLoopbackAddress } = require("../security/policy.cjs");

class OllamaAdapter {
  constructor(options = {}) {
    this.endpoint = (options.endpoint || "http://127.0.0.1:11434").replace(/\/+$/, "");
    assertLoopbackAddress(this.endpoint);
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  async checkHealth(timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetchFn(`${this.endpoint}/api/tags`, {
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async listInstalledModels() {
    try {
      const res = await this.fetchFn(`${this.endpoint}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.models) ? data.models.map((m) => m.name) : [];
    } catch {
      return [];
    }
  }

  async chatCompletion({ model, messages, temperature = 0.7, maxTokens = 1024, signal }) {
    const startMs = Date.now();
    const payload = {
      model,
      messages: messages.map((m) => ({
        role: m.role || "user",
        content: m.content || "",
      })),
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    const res = await this.fetchFn(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama chat request failed with status ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const elapsed = Date.now() - startMs;
    const content = data?.message?.content || "";

    return {
      content,
      role: "assistant",
      model,
      latencyMs: elapsed,
      usage: {
        promptTokens: data?.prompt_eval_count || 0,
        completionTokens: data?.eval_count || 0,
        totalTokens: (data?.prompt_eval_count || 0) + (data?.eval_count || 0),
      },
      tokensPerSec: data?.eval_count && elapsed > 0 ? Number(((data.eval_count / elapsed) * 1000).toFixed(1)) : 0,
    };
  }
}

module.exports = {
  OllamaAdapter,
};
