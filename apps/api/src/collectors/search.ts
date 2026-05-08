import type { Env } from "../env.js";
import { sleep } from "../lib/sleep.js";
import type { SearchHit } from "./types.js";

interface BraveResult {
  url?: string;
  title?: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
}

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

const SOURCE_DOMAINS: Record<string, string> = {
  "trustpilot.com": "trustpilot",
  "trustpilot.pl": "trustpilot",
  "opineo.pl": "opineo",
};

function detectSource(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const [d, s] of Object.entries(SOURCE_DOMAINS)) {
      if (host === d || host.endsWith("." + d)) return s;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

async function braveQuery(env: Env, query: string, count = 5): Promise<SearchHit[]> {
  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!res.ok) {
    console.warn(`[search] brave query failed (${res.status}) for "${query}"`);
    return [];
  }

  const data = (await res.json()) as BraveResponse;
  const results = data.web?.results ?? [];
  const hits: SearchHit[] = [];
  for (const r of results) {
    if (!r.url) continue;
    const src = detectSource(r.url);
    if (!src) continue;
    hits.push({
      url: r.url,
      source: src,
      title: r.title ?? "",
      snippet: r.description,
    });
  }
  return hits;
}

/**
 * Discover review-page URLs for a business across Trustpilot and Opineo.
 * Sequential queries with ~1s pacing to respect Brave free-tier limits.
 */
export async function searchReviewSources(
  env: Env,
  businessName: string,
  extraQueries: string[] = [],
): Promise<SearchHit[]> {
  const queries = [
    `${businessName} opinie site:trustpilot.com`,
    `${businessName} opinie site:opineo.pl`,
    // EN fallback always included — Trustpilot reviews are often indexed
    // under the .com domain regardless of the user's locale.
    `${businessName} reviews site:trustpilot.com`,
    ...extraQueries,
  ];

  const all: SearchHit[] = [];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(1_100); // ~1 req/s
    try {
      const hits = await braveQuery(env, queries[i]!, 5);
      all.push(...hits);
    } catch (e) {
      console.warn(`[search] query failed: ${queries[i]}:`, (e as Error).message);
    }
  }

  // dedup by URL, keep first occurrence
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of all) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push(h);
  }
  return out;
}
