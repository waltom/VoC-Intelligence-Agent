import type { BusinessInput } from "@voc/shared";
import { collectReviews } from "../../collectors/index.js";
import type { CollectedReview } from "../../collectors/types.js";
import type { Env } from "../../env.js";
import { persistReviews } from "../../storage.js";
import { recordEvent } from "../events.js";
import type { PlanResult } from "../schemas.js";

export async function runCollect(
  env: Env,
  analysisId: string,
  input: BusinessInput,
  plan: PlanResult,
  additionalQueries: string[],
): Promise<{ collected: number; reviewIds: string[] }> {
  await recordEvent(env, {
    analysisId,
    step: "scrape",
    status: "started",
    payload: { sources: plan.sources, additionalQueries },
  });

  // Mix plan queries with any additional queries proposed by reflect.
  const merged: BusinessInput = {
    ...input,
    competitors: input.competitors ?? [],
  };

  let reviews: CollectedReview[] = [];
  try {
    reviews = await collectReviews(env, merged, {
      planQueries: [...plan.searchQueries, ...additionalQueries],
      allowedSources: plan.sources,
    });
  } catch (e) {
    await recordEvent(env, {
      analysisId,
      step: "scrape",
      status: "failed",
      message: (e as Error).message,
    });
    throw e;
  }

  const reviewIds = await persistReviews(env, analysisId, reviews);

  // Guard: if we have ZERO reviews in D1 for this analysis after this pass,
  // there's no point in continuing — synthesize would either fail Zod (empty
  // actionItems) or hallucinate. Surface a clear, user-actionable message.
  const total = await env.voc_db
    .prepare("SELECT COUNT(*) as n FROM reviews WHERE analysis_id = ?1")
    .bind(analysisId)
    .first<{ n: number }>();
  if ((total?.n ?? 0) === 0) {
    const msg =
      "No reviews collected. Public review sites (Trustpilot/Opineo) commonly " +
      "block Workers fetch (HTTP 403) or have changed markup. Retry with " +
      'sourceMode="manual_paste" and pastedReviews=[...] to bypass scraping.';
    await recordEvent(env, {
      analysisId,
      step: "scrape",
      status: "failed",
      message: msg,
      payload: { sources: plan.sources, additionalQueries },
    });
    throw new Error(msg);
  }

  await recordEvent(env, {
    analysisId,
    step: "scrape",
    status: "completed",
    message: `collected ${reviews.length} reviews (total in DB: ${total?.n ?? 0})`,
    payload: { count: reviews.length, total: total?.n ?? 0, sources: plan.sources },
  });

  return { collected: reviews.length, reviewIds };
}
