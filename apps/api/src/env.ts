import type { DurableObjectNamespace } from "@cloudflare/workers-types";

/**
 * Runtime bindings — keep names in sync with wrangler.toml.
 * Note: D1 / R2 binding names use snake_case to match the user's wrangler.toml.
 */
export interface Env {
  voc_db: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  voc_reports: R2Bucket;
  ANALYSIS_DO: DurableObjectNamespace;

  GEMINI_API_KEY: string;
  BRAVE_SEARCH_API_KEY: string;
  FRONTEND_ORIGIN: string;
}
