import { REFLECT_SYSTEM_INSTRUCTION, buildReflectPrompt } from "@voc/shared";
import type { Env } from "../../env.js";
import { GeminiClient } from "../../lib/gemini.js";
import { recordEvent } from "../events.js";
import {
  ReflectResponseJsonSchema,
  ReflectSchema,
  type PlanResult,
  type ReflectResult,
} from "../schemas.js";
import type { AggregateStats } from "./classify.js";

export async function runReflect(
  env: Env,
  analysisId: string,
  plan: PlanResult,
  stats: AggregateStats,
  reflectCount: number,
): Promise<ReflectResult> {
  await recordEvent(env, { analysisId, step: "synthesize", status: "started", message: "reflect" });

  // Pull a small sample of representative reviews for the LLM to inspect.
  const sample = await env.voc_db
    .prepare(
      "SELECT content, sentiment, category FROM reviews " +
        "WHERE analysis_id = ?1 ORDER BY RANDOM() LIMIT 8",
    )
    .bind(analysisId)
    .all<{ content: string; sentiment: string | null; category: string | null }>();

  const sampleReviews = (sample.results ?? []).map((r) => ({
    content: r.content,
    sentiment: r.sentiment ?? undefined,
    category: r.category ?? undefined,
  }));

  const client = new GeminiClient(env);
  const { data: reflection, usage } = await client.generateJson({
    systemInstruction: REFLECT_SYSTEM_INSTRUCTION,
    prompt: buildReflectPrompt({ plan, stats, sampleReviews, reflectCount }),
    responseSchema: ReflectResponseJsonSchema,
    zodSchema: ReflectSchema,
    temperature: 0.3,
  });

  await recordEvent(env, {
    analysisId,
    step: "synthesize",
    status: "progress",
    message: `reflect: ${reflection.isEnough ? "enough" : "needs more"}`,
    payload: { reflection, usage, cycle: reflectCount + 1 },
  });

  return reflection;
}
