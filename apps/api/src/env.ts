import type { DurableObjectNamespace } from "@cloudflare/workers-types";

/**
 * Runtime bindings — keep names in sync with wrangler.toml.
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

  /** Public-ish API key required for /analyses/* (set via .dev.vars or `wrangler secret`). */
  API_KEY: string;
  /** Optional logo as data URL embedded into report covers. */
  LOGO_DATA_URL?: string;
}
