import { SYNTHESIZE_SYSTEM_INSTRUCTION, buildSynthesizePrompt } from "@voc/shared";
import type { Env } from "../../env.js";
import { GeminiClient } from "../../lib/gemini.js";
import { recordEvent } from "../events.js";
import {
  SynthesisResponseJsonSchema,
  SynthesisSchema,
  type SynthesisResult,
} from "../schemas.js";
import type { AggregateStats } from "./classify.js";

const MAX_SYNTHESIS_ATTEMPTS = 2;

interface ReviewRow {
  id: string;
  content: string;
  sentiment: string | null;
  category: string | null;
  rating: number | null;
}

export async function runSynthesize(
  env: Env,
  analysisId: string,
  businessName: string,
  competitors: string[],
  stats: AggregateStats,
  reflectionNotes: string | undefined,
): Promise<SynthesisResult> {
  await recordEvent(env, { analysisId, step: "synthesize", status: "started" });

  const allReviews = await fetchAllReviews(env, analysisId);
  const topByCategory = groupTopByCategory(allReviews);

  const client = new GeminiClient(env);
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_SYNTHESIS_ATTEMPTS; attempt++) {
    const { data: synthesis, usage } = await client.generateJson({
      systemInstruction: SYNTHESIZE_SYSTEM_INSTRUCTION,
      prompt: buildSynthesizePrompt({
        businessName,
        competitors,
        stats,
        topReviewsByCategory: topByCategory,
        ...(reflectionNotes ? { reflectionNotes } : {}),
        ...(lastError ? { retryFeedback: lastError } : {}),
      }),
      responseSchema: SynthesisResponseJsonSchema,
      zodSchema: SynthesisSchema,
      temperature: 0.4,
    });

    const validation = validateEvidence(synthesis, allReviews);
    if (validation.ok) {
      await recordEvent(env, {
        analysisId,
        step: "synthesize",
        status: "completed",
        message: `synthesis ok (attempt ${attempt})`,
        payload: { usage, attempt },
      });
      return synthesis;
    }

    lastError = `attempt ${attempt}: ${validation.message}`;
    await recordEvent(env, {
      analysisId,
      step: "synthesize",
      status: "progress",
      message: `evidence validation failed: ${validation.message}`,
      payload: { attempt, hallucinatedQuotes: validation.hallucinated },
    });
  }

  // After max attempts: keep last synthesis but return without strict validation.
  // We re-run once more with retryFeedback included, so that the user still gets
  // a report; the failure is logged for transparency.
  const { data: finalSynthesis } = await client.generateJson({
    systemInstruction: SYNTHESIZE_SYSTEM_INSTRUCTION,
    prompt: buildSynthesizePrompt({
      businessName,
      competitors,
      stats,
      topReviewsByCategory: topByCategory,
      ...(reflectionNotes ? { reflectionNotes } : {}),
      retryFeedback: `${lastError ?? ""} — usuń wszystkie nieuzasadnione cytaty.`,
    }),
    responseSchema: SynthesisResponseJsonSchema,
    zodSchema: SynthesisSchema,
    temperature: 0.2,
  });

  await recordEvent(env, {
    analysisId,
    step: "synthesize",
    status: "completed",
    message: "synthesis completed with relaxed validation",
    payload: { lastError },
  });
  return finalSynthesis;
}

async function fetchAllReviews(env: Env, analysisId: string): Promise<ReviewRow[]> {
  const rs = await env.voc_db
    .prepare(
      "SELECT id, content, sentiment, category, rating FROM reviews WHERE analysis_id = ?1",
    )
    .bind(analysisId)
    .all<ReviewRow>();
  return rs.results ?? [];
}

function groupTopByCategory(
  rows: ReviewRow[],
): Record<string, { content: string; sentiment?: string; rating?: number }[]> {
  const out: Record<string, ReviewRow[]> = {};
  for (const r of rows) {
    const key = r.category ?? "other";
    (out[key] ??= []).push(r);
  }
  const result: Record<string, { content: string; sentiment?: string; rating?: number }[]> = {};
  for (const [cat, list] of Object.entries(out)) {
    list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const positives = list.slice(0, 3);
    const negatives = list.slice(-3).reverse();
    const merged = [...positives, ...negatives].slice(0, 6);
    result[cat] = merged.map((r) => ({
      content: r.content.slice(0, 400),
      ...(r.sentiment ? { sentiment: r.sentiment } : {}),
      ...(r.rating !== null ? { rating: r.rating } : {}),
    }));
  }
  return result;
}

interface ValidationResult {
  ok: boolean;
  message: string;
  hallucinated: string[];
}

function validateEvidence(synthesis: SynthesisResult, reviews: ReviewRow[]): ValidationResult {
  const corpus = reviews.map((r) => normalizeQuote(r.content));
  const hallucinated: string[] = [];

  for (const item of synthesis.actionItems) {
    for (const quote of item.evidence) {
      const needle = normalizeQuote(quote);
      if (needle.length < 12) continue; // ignore trivial fragments
      if (!corpus.some((c) => c.includes(needle))) {
        hallucinated.push(quote);
      }
    }
  }

  if (hallucinated.length === 0) return { ok: true, message: "ok", hallucinated: [] };
  return {
    ok: false,
    message: `${hallucinated.length} quote(s) not found in source reviews`,
    hallucinated,
  };
}

function normalizeQuote(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
