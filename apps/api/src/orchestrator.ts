import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.js";

/**
 * AnalysisOrchestrator
 *
 * Durable Object that orchestrates a single analysis lifecycle:
 *   discover -> scrape -> classify -> embed -> synthesize -> report
 *
 * Uses SQLite-backed storage (free plan compatible). Concrete step logic
 * is added in Prompt 3; this file is intentionally a thin shell.
 */
export class AnalysisOrchestrator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return new Response(
      JSON.stringify({
        ok: true,
        do: "AnalysisOrchestrator",
        path: url.pathname,
        note: "skeleton - logic implemented in later phase",
      }),
      { headers: { "content-type": "application/json" } },
    );
  }
}
