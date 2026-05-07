import type { Review } from "@voc/shared";

/**
 * A review object as produced by collectors, before it's assigned an id and
 * an analysis_id at persistence time.
 */
export type CollectedReview = Omit<Review, "id" | "analysisId">;

export interface SearchHit {
  url: string;
  source: string;
  title: string;
  snippet?: string;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  html?: string;
  error?: string;
  fromCache?: boolean;
}
