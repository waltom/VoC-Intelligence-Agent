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

export const SUPPORTED_SOURCES = ["trustpilot", "opineo", "appstore", "manual"] as const;
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
  workersAiSentiment: "@cf/huggingface/distilbert-sst-2-int8",
  workersAiEmbedding: "@cf/baai/bge-small-en-v1.5",
} as const;

export const EMBEDDING_DIM = 384;

export const MAX_REVIEWS_PER_ANALYSIS = 500;
export const MAX_PASTED_REVIEWS = 200;
