import type { Env } from "../env.js";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Per-IP, per-hour rate limit, persisted in D1.cache.
 * Key shape: rl:{ip}:{hour-bucket}, value = current count, expires at end of bucket.
 */
export async function rateLimit(
  env: Env,
  ip: string,
  scope: string,
  limit: number,
  windowSeconds = 3600,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const key = `rl:${scope}:${ip}:${bucket}`;
  const expiresAt = (bucket + 1) * windowSeconds;

  const existing = await env.voc_db
    .prepare("SELECT value FROM cache WHERE key = ?1 AND expires_at > ?2")
    .bind(key, now)
    .first<{ value: string }>();

  const current = existing ? Number.parseInt(existing.value, 10) || 0 : 0;
  const next = current + 1;

  await env.voc_db
    .prepare(
      "INSERT INTO cache (key, value, expires_at) VALUES (?1, ?2, ?3) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
    )
    .bind(key, String(next), expiresAt)
    .run();

  return {
    allowed: next <= limit,
    count: next,
    limit,
    retryAfterSeconds: Math.max(1, expiresAt - now),
  };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
