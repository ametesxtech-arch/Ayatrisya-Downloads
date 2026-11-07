// Web Search and Internet Retrieval Engine for Ayatrisya AI
// Parent Company: Ametesx

export type SearchResult = {
  title: string;
  snippet: string;
  link: string;
};

export async function searchInternet(query: string, maxResults = 5): Promise<SearchResult[]> {
  const cleanQuery = query.trim().slice(0, 150);
  if (!cleanQuery) return [];

  // DuckDuckGo HTML search for public internet results
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];

    // Match search result snippets and titles from HTML
    const linkMatches = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const titleMatches = [...html.matchAll(/<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];

    for (let i = 0; i < Math.min(linkMatches.length, maxResults); i++) {
      const rawSnippet = linkMatches[i][2] ?? "";
      const rawUrl = linkMatches[i][1] ?? "";
      const rawTitle = titleMatches[i]?.[2] ?? cleanQuery;

      const snippet = rawSnippet.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const title = rawTitle.replace(/<[^>]+>/g, "").trim();

      if (snippet.length > 10) {
        // Decode DDG redirect URL if present
        let link = rawUrl;
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          try { link = decodeURIComponent(uddgMatch[1]); } catch {}
        }
        results.push({ title: title || `Result ${i + 1}`, snippet, link });
      }
    }

    return results;
  } catch {
    return [];
  }
}

export function shouldSearchInternet(query: string): boolean {
  const lower = query.toLowerCase().trim();
  if (!lower) return false;

  // Explicit web search commands
  if (/\b(search(ing|ed)?|google|browse|lookup|look\s*up|find)\s+(the\s+)?(web|internet|online)\b/i.test(lower)) return true;
  if (/\b(search\s+(for|in\s+web|online|internet|google)|google\s+for)\b/i.test(lower)) return true;

  // Real-time, news, dynamic info
  if (/\b(latest\s+(news|update|release|information|event|price|development)|breaking\s+news|today('?s)?\s+(news|headline|weather|stock|score))\b/i.test(lower)) return true;
  if (/\b(current\s+(price|status|weather|stock|events?)|who\s+won|stock\s+price\s+of|weather\s+in)\b/i.test(lower)) return true;
  if (/\b(what('?s)?\s+happening\s+with|what\s+happened\s+to|what('?s)?\s+the\s+latest)\b/i.test(lower)) return true;

  const searchTriggers = [
    "search the web",
    "search internet",
    "search the internet",
    "search for",
    "search in web",
    "google for",
    "latest news",
    "recent news",
    "what is happening",
    "current price",
    "today's",
    "who won",
    "weather today",
    "latest release",
    "current date",
    "what happened to",
    "ametesx",
  ];
  return searchTriggers.some((t) => lower.includes(t));
}

/**
 * Formats clean, markdown-compliant source references to append at the end of responses.
 */
export function formatSourcesSection(sources: SearchResult[]): string {
  if (!sources.length) return "";
  const lines = sources.map((s, i) => {
    let hostname = "";
    try {
      hostname = new URL(s.link).hostname.replace(/^www\./, "");
    } catch {
      hostname = s.link;
    }
    const cleanSnippet = s.snippet.slice(0, 150).trim();
    return `${i + 1}. [**${s.title}**](${s.link}) - *${hostname}*${cleanSnippet ? ` · "${cleanSnippet}"` : ""}`;
  });

  return `\n\n---\n### 🌐 Sources & References\n${lines.join("\n")}`;
}
