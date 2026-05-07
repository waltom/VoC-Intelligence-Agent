import type { Env } from "../env.js";
import { getCached, scrapeCacheKey, setCached, SCRAPE_CACHE_TTL_SECONDS } from "../lib/cache.js";
import { sleep } from "../lib/sleep.js";
import type { FetchResult } from "./types.js";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

interface FetchOpts {
  /** internal flag: skip cache and skip further redirects */
  followedRedirect?: boolean;
}

export async function fetchHtml(env: Env, url: string, opts: FetchOpts = {}): Promise<FetchResult> {
  const cacheKey = await scrapeCacheKey(url);

  if (!opts.followedRedirect) {
    const cached = await getCached(env, cacheKey);
    if (cached !== undefined) {
      return { ok: true, status: 200, html: cached, fromCache: true };
    }
  }

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(1_000 * Math.pow(3, attempt - 1));
    }

    let res: Response;
    try {
      res = await fetchWithTimeout(url, DEFAULT_HEADERS, TIMEOUT_MS);
    } catch (e) {
      lastError = `network: ${(e as Error).message}`;
      continue;
    }

    if (res.status === 429 || res.status === 503) {
      lastError = `status ${res.status}`;
      continue;
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (opts.followedRedirect) {
        return { ok: false, status: res.status, error: "redirect after redirect" };
      }
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, status: res.status, error: "redirect without Location" };
      const next = new URL(loc, url).toString();
      if (!sameDomain(next, url)) {
        return { ok: false, status: res.status, error: "cross-domain redirect refused" };
      }
      return fetchHtml(env, next, { followedRedirect: true });
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    await setCached(env, cacheKey, html, SCRAPE_CACHE_TTL_SECONDS).catch((e) => {
      console.warn("[fetcher] cache write failed:", (e as Error).message);
    });
    return { ok: true, status: res.status, html };
  }

  return { ok: false, status: 0, error: lastError || "unknown" };
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  ms: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers, redirect: "manual", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sameDomain(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}
