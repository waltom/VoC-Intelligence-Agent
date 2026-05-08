import type { Env } from "../env.js";

/** Gemini 2.5 Flash Lite list price (per 1M tokens), Apr 2026 — adjust if changes. */
export const GEMINI_PRICING = {
  inputPerMillion: 0.1,
  outputPerMillion: 0.4,
} as const;

export function geminiCostUsd(promptTokens: number, outputTokens: number): number {
  const input = (promptTokens / 1_000_000) * GEMINI_PRICING.inputPerMillion;
  const output = (outputTokens / 1_000_000) * GEMINI_PRICING.outputPerMillion;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

export interface UsageTotals {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * Aggregate Gemini token usage from events.payload_json for an analysis.
 * Workers AI calls don't return token counts so we count only Gemini steps.
 */
export async function computeUsageForAnalysis(
  env: Env,
  analysisId: string,
): Promise<UsageTotals> {
  const rs = await env.voc_db
    .prepare(
      "SELECT payload_json FROM events " +
        "WHERE analysis_id = ?1 AND payload_json IS NOT NULL",
    )
    .bind(analysisId)
    .all<{ payload_json: string }>();

  let prompt = 0;
  let output = 0;

  for (const row of rs.results ?? []) {
    try {
      const payload = JSON.parse(row.payload_json) as {
        usage?: { promptTokens?: number; outputTokens?: number };
      };
      if (payload.usage) {
        prompt += payload.usage.promptTokens ?? 0;
        output += payload.usage.outputTokens ?? 0;
      }
    } catch {
      /* tolerate malformed JSON */
    }
  }

  return {
    promptTokens: prompt,
    outputTokens: output,
    totalTokens: prompt + output,
    costUsd: geminiCostUsd(prompt, output),
  };
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Lightweight structured logger. warn/error are also persisted as events
 * (with step="error") so they show up in the SSE stream.
 */
export async function logEvent(
  env: Env,
  level: LogLevel,
  msg: string,
  ctx: Record<string, unknown> = {},
): Promise<void> {
  const line = `[${level}] ${msg} ${Object.keys(ctx).length ? JSON.stringify(ctx) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if ((level === "warn" || level === "error") && typeof ctx.analysisId === "string") {
    await env.voc_db
      .prepare(
        "INSERT INTO events (id, analysis_id, step, status, message, payload_json, created_at) " +
          "VALUES (?1, ?2, 'error', ?3, ?4, ?5, ?6)",
      )
      .bind(
        crypto.randomUUID(),
        ctx.analysisId,
        level === "error" ? "failed" : "progress",
        msg.slice(0, 500),
        JSON.stringify(ctx),
        Date.now(),
      )
      .run()
      .catch(() => undefined);
  }
}
