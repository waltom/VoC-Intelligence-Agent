import type { BusinessInput } from "@voc/shared";
import type { Env } from "../env.js";
import { parsePostedAt, postedAtToEpochMs } from "../lib/dates.js";
import { detectLanguage } from "../lib/language.js";
import { fetchHtml } from "./fetcher.js";
import { fetchItunesReviews } from "./itunes.js";
import { normalizePastedReviews } from "./manual.js";
import { parseOpineo } from "./parsers/opineo.js";
import { parseTrustpilot } from "./parsers/trustpilot.js";
import { searchReviewSources } from "./search.js";
import type { CollectedReview, SearchHit } from "./types.js";

const PER_SOURCE_LIMIT = 50;
const FETCH_BUDGET = 6;

export interface CollectOptions {
  /** Extra search queries proposed by the planner / reflector. */
  planQueries?: string[];
  /** Restrict which sources to fetch from (e.g. plan.sources). */
  allowedSources?: readonly string[];
}

export async function collectReviews(
  env: Env,
  input: BusinessInput,
  opts: CollectOptions = {},
): Promise<CollectedReview[]> {
  if (input.sourceMode === "manual_paste") {
    return finalize(normalizePastedReviews(input.pastedReviews ?? []));
  }

  const allowed = new Set(opts.allowedSources ?? ["trustpilot", "opineo", "itunes"]);

  let collected: CollectedReview[] = [];

  if (allowed.has("trustpilot") || allowed.has("opineo")) {
    let hits: SearchHit[] = [];
    try {
      hits = await searchReviewSources(env, input.businessName, opts.planQueries ?? []);
    } catch (e) {
      console.warn("[collect] search failed:", (e as Error).message);
    }

    const filtered = hits.filter((h) => allowed.has(h.source)).slice(0, FETCH_BUDGET);
    const groups = groupBy(filtered, (h) => h.source);

    for (const [source, list] of Object.entries(groups)) {
      for (const item of list) {
        const res = await fetchHtml(env, item.url);
        if (!res.ok || !res.html) {
          console.warn(`[collect] fetch failed: ${item.url} (${res.status} ${res.error ?? ""})`);
          continue;
        }
        try {
          const parsed = await parseBySource(source, res.html);
          for (const r of parsed) {
            collected.push({ ...r, source, sourceUrl: item.url });
          }
        } catch (e) {
          console.warn(`[collect] parse failed: ${item.url}:`, (e as Error).message);
        }
      }
    }
  }

  // Optional iTunes RSS — uses appStoreId if provided in BusinessInput.
  const appStoreId = (input as BusinessInput & { appStoreId?: string; appStoreCountry?: string })
    .appStoreId;
  const appStoreCountry =
    (input as BusinessInput & { appStoreCountry?: string }).appStoreCountry ?? "pl";
  if (appStoreId && allowed.has("itunes")) {
    try {
      const itunes = await fetchItunesReviews(appStoreId, appStoreCountry);
      collected.push(...itunes);
    } catch (e) {
      console.warn("[collect] itunes failed:", (e as Error).message);
    }
  }

  return finalize(collected);
}

async function parseBySource(source: string, html: string): Promise<CollectedReview[]> {
  switch (source) {
    case "trustpilot":
      return parseTrustpilot(html);
    case "opineo":
      return parseOpineo(html);
    default:
      return [];
  }
}

function finalize(reviews: CollectedReview[]): CollectedReview[] {
  const enriched = reviews.map((r) => ({
    ...r,
    language: r.language ?? detectLanguage(r.content),
    postedAt: parsePostedAt(r.postedAt) ?? r.postedAt,
  }));

  const bySource = groupBy(enriched, (r) => r.source);
  const out: CollectedReview[] = [];
  for (const list of Object.values(bySource)) {
    list.sort((a, b) => (postedAtToEpochMs(b.postedAt) ?? 0) - (postedAtToEpochMs(a.postedAt) ?? 0));
    out.push(...list.slice(0, PER_SOURCE_LIMIT));
  }
  return out;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
