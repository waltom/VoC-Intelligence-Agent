import {
  CLASSIFY_BATCH_PARALLEL,
  CLASSIFY_BATCH_SIZE,
  CLASSIFY_SYSTEM_INSTRUCTION,
  EMBEDDING_DIM,
  MODELS,
  NEURON_ESTIMATES,
  WORKERS_AI_CLASSIFY_SYSTEM,
  buildClassifyBatchPrompt,
} from "@voc/shared";
import type { Env } from "../../env.js";
import { GeminiClient } from "../../lib/gemini.js";
import { addNeuronsUsed, shouldFallbackToGemini } from "../../lib/neurons.js";
import { recordEvent } from "../events.js";
import {
  ClassifyBatchResponseJsonSchema,
  ClassifyBatchSchema,
  type ClassifyItem,
} from "../schemas.js";

interface ReviewRow {
  id: string;
  content: string;
  rating: number | null;
}

export async function runClassify(env: Env, analysisId: string): Promise<{
  classified: number;
  embedded: number;
  usedFallback: boolean;
}> {
  await recordEvent(env, { analysisId, step: "classify", status: "started" });

  const rs = await env.voc_db
    .prepare(
      "SELECT id, content, rating FROM reviews " +
        "WHERE analysis_id = ?1 AND sentiment IS NULL ORDER BY id ASC",
    )
    .bind(analysisId)
    .all<ReviewRow>();
  const rows = rs.results ?? [];

  if (rows.length === 0) {
    await recordEvent(env, {
      analysisId,
      step: "classify",
      status: "completed",
      message: "no unclassified reviews",
    });
    return { classified: 0, embedded: 0, usedFallback: false };
  }

  const fallback = await shouldFallbackToGemini(env);
  let classified = 0;
  let embedded = 0;

  const batches: ReviewRow[][] = [];
  for (let i = 0; i < rows.length; i += CLASSIFY_BATCH_SIZE) {
    batches.push(rows.slice(i, i + CLASSIFY_BATCH_SIZE));
  }

  const gemini = new GeminiClient(env);

  // Run up to CLASSIFY_BATCH_PARALLEL batches concurrently.
  for (let i = 0; i < batches.length; i += CLASSIFY_BATCH_PARALLEL) {
    const slice = batches.slice(i, i + CLASSIFY_BATCH_PARALLEL);
    const results = await Promise.all(
      slice.map(async (batch) => {
        const items = await classifyBatch(env, gemini, batch, fallback);
        await persistClassifications(env, batch, items);
        const emb = await embedBatch(env, analysisId, batch);
        return { c: batch.length, e: emb };
      }),
    );
    for (const r of results) {
      classified += r.c;
      embedded += r.e;
    }
  }

  // Compute per-source / per-category / per-sentiment stats for REFLECT/SYNTHESIZE.
  const stats = await computeStats(env, analysisId);

  await recordEvent(env, {
    analysisId,
    step: "classify",
    status: "completed",
    message: `classified ${classified}, embedded ${embedded}`,
    payload: { stats, usedFallback: fallback },
  });

  return { classified, embedded, usedFallback: fallback };
}

async function classifyBatch(
  env: Env,
  gemini: GeminiClient,
  batch: ReviewRow[],
  fallback: boolean,
): Promise<ClassifyItem[]> {
  if (fallback) return classifyWithGemini(gemini, batch);

  try {
    const result = await env.AI.run(MODELS.workersAiClassify, {
      messages: [
        { role: "system", content: WORKERS_AI_CLASSIFY_SYSTEM },
        { role: "user", content: buildClassifyBatchPrompt(batch.map((r) => r.content)) },
      ],
    });
    await addNeuronsUsed(env, NEURON_ESTIMATES.classify);

    const text = (result as { response?: string }).response ?? "";
    const parsed = JSON.parse(stripJsonFence(text));
    const items = ClassifyBatchSchema.parse(parsed);
    if (items.length !== batch.length) throw new Error("classify length mismatch");
    return items;
  } catch (e) {
    console.warn("[classify] Workers AI failed, falling back to Gemini:", (e as Error).message);
    return classifyWithGemini(gemini, batch);
  }
}

async function classifyWithGemini(
  gemini: GeminiClient,
  batch: ReviewRow[],
): Promise<ClassifyItem[]> {
  const { data } = await gemini.generateJson({
    systemInstruction: CLASSIFY_SYSTEM_INSTRUCTION,
    prompt: buildClassifyBatchPrompt(batch.map((r) => r.content)),
    responseSchema: ClassifyBatchResponseJsonSchema,
    zodSchema: ClassifyBatchSchema,
    temperature: 0.1,
  });
  if (data.length !== batch.length) {
    // Pad / truncate to match input length defensively.
    while (data.length < batch.length) data.push({ sentiment: "neutral", category: "other" });
    data.length = batch.length;
  }
  return data;
}

async function persistClassifications(
  env: Env,
  batch: ReviewRow[],
  items: ClassifyItem[],
): Promise<void> {
  const stmt = env.voc_db.prepare(
    "UPDATE reviews SET sentiment = ?1, category = ?2 WHERE id = ?3",
  );
  await env.voc_db.batch(
    batch.map((row, i) => stmt.bind(items[i]!.sentiment, items[i]!.category, row.id)),
  );
}

async function embedBatch(env: Env, analysisId: string, batch: ReviewRow[]): Promise<number> {
  if (batch.length === 0) return 0;
  let vectors: number[][] = [];
  try {
    const out = (await env.AI.run(MODELS.workersAiEmbedding, {
      text: batch.map((r) => r.content.slice(0, 1500)),
    })) as { data?: number[][] };
    vectors = out.data ?? [];
    await addNeuronsUsed(env, NEURON_ESTIMATES.embedding * batch.length);
  } catch (e) {
    console.warn("[classify] embedding failed:", (e as Error).message);
    return 0;
  }

  const upserts = batch
    .map((row, i) => ({ row, values: vectors[i] }))
    .filter((x): x is { row: ReviewRow; values: number[] } =>
      Array.isArray(x.values) && x.values.length === EMBEDDING_DIM,
    )
    .map(({ row, values }) => ({
      id: row.id,
      values,
      metadata: { analysisId, reviewId: row.id, rating: row.rating ?? 0 },
    }));

  if (upserts.length === 0) return 0;

  try {
    await env.VECTORIZE.upsert(upserts);
    // Mark embedding ref so we know the vector is in Vectorize.
    const stmt = env.voc_db.prepare("UPDATE reviews SET embedding_ref = ?1 WHERE id = ?2");
    await env.voc_db.batch(upserts.map((u) => stmt.bind(u.id, u.id)));
  } catch (e) {
    console.warn("[classify] vectorize upsert failed:", (e as Error).message);
    return 0;
  }
  return upserts.length;
}

export interface AggregateStats {
  total: number;
  bySource: Record<string, number>;
  bySentiment: Record<string, number>;
  byCategory: Record<string, number>;
  avgRating: number | null;
}

export async function computeStats(env: Env, analysisId: string): Promise<AggregateStats> {
  const rs = await env.voc_db
    .prepare(
      "SELECT source, sentiment, category, rating FROM reviews WHERE analysis_id = ?1",
    )
    .bind(analysisId)
    .all<{ source: string; sentiment: string | null; category: string | null; rating: number | null }>();
  const rows = rs.results ?? [];
  const stats: AggregateStats = {
    total: rows.length,
    bySource: {},
    bySentiment: {},
    byCategory: {},
    avgRating: null,
  };
  let ratingSum = 0;
  let ratingCount = 0;
  for (const r of rows) {
    stats.bySource[r.source] = (stats.bySource[r.source] ?? 0) + 1;
    if (r.sentiment) stats.bySentiment[r.sentiment] = (stats.bySentiment[r.sentiment] ?? 0) + 1;
    if (r.category) stats.byCategory[r.category] = (stats.byCategory[r.category] ?? 0) + 1;
    if (typeof r.rating === "number") {
      ratingSum += r.rating;
      ratingCount++;
    }
  }
  stats.avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;
  return stats;
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  return t;
}
