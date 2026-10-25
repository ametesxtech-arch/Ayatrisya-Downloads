// Web Search and Internet Retrieval Engine for Ayatrisya AI
// Parent Company: Ametesx

export type SearchResult = {
  title: string;
  snippet: string;
  link: string;
};

export async function searchInternet(query: string, maxResults = 4): Promise<SearchResult[]> {
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
      signal: AbortSignal.timeout(5000),
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
  const lower = query.toLowerCase();
  const searchTriggers = [
    "search the web",
    "search internet",
    "search the internet",
    "search for",
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
