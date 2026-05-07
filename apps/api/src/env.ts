import type { DurableObjectNamespace } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  VEC: VectorizeIndex;
  AI: Ai;
  BUCKET: R2Bucket;
  ANALYSIS_DO: DurableObjectNamespace;

  GEMINI_API_KEY: string;
  BRAVE_SEARCH_API_KEY: string;
  FRONTEND_ORIGIN: string;
}
