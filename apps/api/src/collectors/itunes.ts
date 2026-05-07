import type { CollectedReview } from "./types.js";

/**
 * iTunes RSS — genuinely free, no API key. Per-country, per-app feeds.
 * URL pattern:
 *   https://itunes.apple.com/{country}/rss/customerreviews/page={n}/id={appId}/sortby=mostrecent/json
 */

interface ItunesEntryLabel {
  label: string;
}
interface ItunesAttr {
  attributes: { label: string };
}
interface ItunesEntry {
  id?: ItunesEntryLabel;
  author?: { name?: ItunesEntryLabel };
  "im:rating"?: ItunesEntryLabel;
  "im:version"?: ItunesEntryLabel;
  title?: ItunesEntryLabel;
  content?: ItunesEntryLabel;
  updated?: ItunesEntryLabel;
  link?: ItunesAttr | ItunesAttr[];
}
interface ItunesFeed {
  feed?: {
    entry?: ItunesEntry | ItunesEntry[];
  };
}

const FALLBACK_COUNTRIES = ["pl", "us", "gb", "de"];

export async function fetchItunesReviews(
  appId: string,
  country = "pl",
  pages = 3,
): Promise<CollectedReview[]> {
  const tried = new Set<string>();
  const queue = [country, ...FALLBACK_COUNTRIES.filter((c) => c !== country)];

  for (const c of queue) {
    if (tried.has(c)) continue;
    tried.add(c);
    const reviews = await fetchForCountry(appId, c, pages);
    if (reviews.length > 0) return reviews;
  }
  return [];
}

async function fetchForCountry(
  appId: string,
  country: string,
  pages: number,
): Promise<CollectedReview[]> {
  const out: CollectedReview[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://itunes.apple.com/${encodeURIComponent(country)}/rss/customerreviews/page=${page}/id=${encodeURIComponent(appId)}/sortby=mostrecent/json`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (e) {
      console.warn(`[itunes] fetch failed (${country}/p${page}):`, (e as Error).message);
      break;
    }
    if (!res.ok) {
      console.warn(`[itunes] HTTP ${res.status} for ${country}/p${page}`);
      break;
    }
    let data: ItunesFeed;
    try {
      data = (await res.json()) as ItunesFeed;
    } catch {
      break;
    }
    const entries = normalizeEntries(data.feed?.entry);
    // First entry on iTunes RSS is typically the app metadata, not a review.
    // Skip entries without im:rating to avoid pulling that header in.
    const reviewEntries = entries.filter((e) => e["im:rating"]?.label);
    if (reviewEntries.length === 0) break;
    for (const e of reviewEntries) {
      const rating = Number.parseFloat(e["im:rating"]?.label ?? "");
      const content = e.content?.label?.trim();
      if (!content) continue;
      const link = Array.isArray(e.link) ? e.link[0]?.attributes?.label : e.link?.attributes?.label;
      out.push({
        source: "appstore",
        content,
        ...(Number.isFinite(rating) ? { rating } : {}),
        ...(e.author?.name?.label ? { author: e.author.name.label } : {}),
        ...(e.updated?.label ? { postedAt: e.updated.label } : {}),
        ...(link ? { sourceUrl: link } : {}),
      });
    }
  }
  return out;
}

function normalizeEntries(entry: ItunesEntry | ItunesEntry[] | undefined): ItunesEntry[] {
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}
