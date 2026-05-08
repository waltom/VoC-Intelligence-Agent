import type { Context, MiddlewareHandler } from "hono";
import { FREE_TIER_LIMITS } from "@voc/shared";
import type { Env } from "../env.js";
import { getNeuronsUsedToday } from "../lib/neurons.js";

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export function err(code: string, message: string, details?: unknown): ApiError {
  return { error: message, code, ...(details !== undefined ? { details } : {}) };
}

const PUBLIC_PREFIXES = ["/health", "/demo/"];

/**
 * x-api-key middleware. Skips PUBLIC_PREFIXES. In dev (env.API_KEY empty),
 * logs a warning but lets the request through — so curl-from-laptop just works.
 */
export const apiKeyMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return next();

  const expected = c.env.API_KEY;
  if (!expected) {
    console.warn("[auth] API_KEY is empty — request allowed in dev mode:", path);
    return next();
  }

  const provided = c.req.header("x-api-key");
  if (provided !== expected) {
    return c.json(err("UNAUTHORIZED", "missing or invalid x-api-key"), 401);
  }
  return next();
};

/**
 * Quota guard — when daily Workers AI usage exceeds 80% of the free-tier
 * neuron budget, refuse new auto-mode analyses. manual_paste still works
 * because it doesn't run Workers AI sentiment classification through llama
 * (it goes through the same path but only on the paste contents — typically
 * dozens of reviews, not hundreds).
 */
export const quotaGuardMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const used = await getNeuronsUsedToday(c.env);
  const threshold = FREE_TIER_LIMITS.workersAi.neuronsPerDay * 0.8;
  if (used >= threshold) {
    return c.json(
      err(
        "QUOTA_NEAR_LIMIT",
        "Daily AI quota almost exhausted, try manual_paste mode",
        { neuronsUsedToday: used, threshold },
      ),
      503,
    );
  }
  return next();
};

export function requireBody<T>(
  c: Context<{ Bindings: Env }>,
  parser: (raw: unknown) => T,
): Promise<T | { json: (status: number) => Response }> {
  return c.req.json().then((raw) => {
    try {
      return parser(raw);
    } catch (e) {
      const errPayload = err("VALIDATION", (e as Error).message);
      return {
        json: (status: number) => Response.json(errPayload, { status }),
      };
    }
  });
}
