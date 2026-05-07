import type { Env } from "../env.js";
import { sha256Hex } from "./hash.js";

export const SCRAPE_CACHE_TTL_SECONDS = 60 * 60 * 24;

export async function scrapeCacheKey(url: string): Promise<string> {
  return `scrape:${await sha256Hex(url)}`;
}

export async function getCached(env: Env, key: string): Promise<string | undefined> {
  const row = await env.voc_db
    .prepare("SELECT value, expires_at FROM cache WHERE key = ?1")
    .bind(key)
    .first<{ value: string; expires_at: number }>();
  if (!row) return undefined;
  if (row.expires_at <= Math.floor(Date.now() / 1000)) {
    await env.voc_db.prepare("DELETE FROM cache WHERE key = ?1").bind(key).run();
    return undefined;
  }
  return row.value;
}

export async function setCached(
  env: Env,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await env.voc_db
    .prepare(
      "INSERT INTO cache (key, value, expires_at) VALUES (?1, ?2, ?3) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    )
    .bind(key, value, expiresAt)
    .run();
}
