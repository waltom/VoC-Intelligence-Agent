import { FREE_TIER_LIMITS, NEURON_FALLBACK_THRESHOLD } from "@voc/shared";
import type { Env } from "../env.js";

/**
 * Coarse Workers AI neuron counter, persisted in D1's cache table per UTC day.
 * Cloudflare doesn't return neuron usage in the runtime — we estimate based on
 * model class. Good enough to decide when to fall back to Gemini.
 */
function todayKey(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `neurons:${yyyy}-${mm}-${dd}`;
}

function endOfTodayUnix(): number {
  const d = new Date();
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) / 1000);
}

export async function getNeuronsUsedToday(env: Env): Promise<number> {
  const row = await env.voc_db
    .prepare("SELECT value FROM cache WHERE key = ?1 AND expires_at > ?2")
    .bind(todayKey(), Math.floor(Date.now() / 1000))
    .first<{ value: string }>();
  if (!row) return 0;
  const n = Number.parseInt(row.value, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function addNeuronsUsed(env: Env, amount: number): Promise<number> {
  const current = await getNeuronsUsedToday(env);
  const next = current + Math.max(0, Math.round(amount));
  await env.voc_db
    .prepare(
      "INSERT INTO cache (key, value, expires_at) VALUES (?1, ?2, ?3) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    )
    .bind(todayKey(), String(next), endOfTodayUnix())
    .run();
  return next;
}

export async function neuronBudgetRemaining(env: Env): Promise<number> {
  const used = await getNeuronsUsedToday(env);
  return Math.max(0, FREE_TIER_LIMITS.workersAi.neuronsPerDay - used);
}

export async function shouldFallbackToGemini(env: Env): Promise<boolean> {
  return (await neuronBudgetRemaining(env)) < NEURON_FALLBACK_THRESHOLD;
}
