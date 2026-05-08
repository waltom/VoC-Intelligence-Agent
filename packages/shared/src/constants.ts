import type { Category, Sentiment } from "./types.js";

export const CATEGORIES: readonly Category[] = [
  "price",
  "service",
  "quality",
  "delivery",
  "ux",
  "communication",
  "other",
] as const;

export const SENTIMENTS: readonly Sentiment[] = ["positive", "neutral", "negative"] as const;

export const SUPPORTED_SOURCES = ["trustpilot", "opineo", "itunes", "manual"] as const;
export type SourceName = (typeof SUPPORTED_SOURCES)[number];

export const SCRAPE_CACHE_TTL_SECONDS = 60 * 60 * 24;

export const FREE_TIER_LIMITS = {
  workersAi: { neuronsPerDay: 10_000 },
  gemini: { requestsPerDay: 1500 },
  brave: { requestsPerMonth: 2000 },
  d1: { readsPerDay: 5_000_000 },
  vectorize: { queriedDimensionsPerMonth: 30_000_000 },
} as const;

export const MODELS = {
  geminiFlashLite: "gemini-2.5-flash-lite",
  workersAiClassify: "@cf/meta/llama-3.1-8b-instruct",
  workersAiEmbedding: "@cf/baai/bge-m3",
} as const;

// bge-m3 is multilingual and produces 1024-dim vectors (vs bge-small-en's 384).
// Vectorize index must be created with --dimensions=1024 to match.
export const EMBEDDING_DIM = 1024;

// Rough neuron-cost estimates per call. Used by the daily counter to decide
// when to fall back to Gemini for classification.
export const NEURON_ESTIMATES = {
  classify: 250,
  embedding: 60,
} as const;

export const NEURON_FALLBACK_THRESHOLD = 500;

export const MAX_REVIEWS_PER_ANALYSIS = 500;
export const MAX_PASTED_REVIEWS = 200;
export const CLASSIFY_BATCH_SIZE = 10;
export const CLASSIFY_BATCH_PARALLEL = 3;
export const REFLECT_MAX_CYCLES = 2;
