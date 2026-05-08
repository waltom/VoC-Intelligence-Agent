import type { BusinessInput } from "@voc/shared";
import type { CollectedReview } from "./collectors/types.js";
import type { Env } from "./env.js";
import { postedAtToEpochMs } from "./lib/dates.js";

export async function createAnalysis(env: Env, input: BusinessInput): Promise<string> {
  const id = crypto.randomUUID();
  await env.voc_db
    .prepare(
      "INSERT INTO analyses " +
        "(id, business_name, business_url, competitors, status, source_mode, created_at) " +
        "VALUES (?1, ?2, ?3, ?4, 'discovering', ?5, ?6)",
    )
    .bind(
      id,
      input.businessName,
      input.businessUrl ?? null,
      JSON.stringify(input.competitors ?? []),
      input.sourceMode,
      Date.now(),
    )
    .run();
  return id;
}

export async function persistReviews(
  env: Env,
  analysisId: string,
  reviews: CollectedReview[],
): Promise<string[]> {
  if (reviews.length === 0) return [];
  const ids = reviews.map(() => crypto.randomUUID());
  const stmt = env.voc_db.prepare(
    "INSERT INTO reviews " +
      "(id, analysis_id, source, source_url, author, rating, content, posted_at, language) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  );
  const batch = reviews.map((r, i) =>
    stmt.bind(
      ids[i]!,
      analysisId,
      r.source,
      r.sourceUrl ?? null,
      r.author ?? null,
      r.rating ?? null,
      r.content,
      postedAtToEpochMs(r.postedAt),
      r.language ?? null,
    ),
  );
  await env.voc_db.batch(batch);
  return ids;
}

export async function markAnalysisCompleted(env: Env, id: string): Promise<void> {
  await env.voc_db
    .prepare("UPDATE analyses SET status = 'completed', completed_at = ?1 WHERE id = ?2")
    .bind(Date.now(), id)
    .run();
}

export async function markAnalysisFailed(env: Env, id: string, error: string): Promise<void> {
  await env.voc_db
    .prepare("UPDATE analyses SET status = 'failed', error = ?1, completed_at = ?2 WHERE id = ?3")
    .bind(error.slice(0, 1000), Date.now(), id)
    .run();
}
