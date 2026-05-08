import { CATEGORIES, SENTIMENTS, SUPPORTED_SOURCES } from "@voc/shared";
import { z } from "zod";

const categoryEnum = z.enum(CATEGORIES as unknown as [string, ...string[]]);
const sentimentEnum = z.enum(SENTIMENTS as unknown as [string, ...string[]]);
const sourceEnum = z.enum(SUPPORTED_SOURCES as unknown as [string, ...string[]]);

// ----- PLAN ------------------------------------------------------------------

export const PlanSchema = z.object({
  sources: z.array(sourceEnum).min(1),
  searchQueries: z.array(z.string()).default([]),
  focusCategories: z.array(categoryEnum).default([]),
  hypothesesToTest: z.array(z.string()).default([]),
});
export type PlanResult = z.infer<typeof PlanSchema>;

export const PlanResponseJsonSchema = {
  type: "object",
  properties: {
    sources: { type: "array", items: { type: "string", enum: [...SUPPORTED_SOURCES] } },
    searchQueries: { type: "array", items: { type: "string" } },
    focusCategories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } },
    hypothesesToTest: { type: "array", items: { type: "string" } },
  },
  required: ["sources", "searchQueries", "focusCategories", "hypothesesToTest"],
};

// ----- CLASSIFY (per-batch) --------------------------------------------------

export const ClassifyItemSchema = z.object({
  sentiment: sentimentEnum,
  category: categoryEnum,
});
export const ClassifyBatchSchema = z.array(ClassifyItemSchema);
export type ClassifyItem = z.infer<typeof ClassifyItemSchema>;

export const ClassifyBatchResponseJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      sentiment: { type: "string", enum: [...SENTIMENTS] },
      category: { type: "string", enum: [...CATEGORIES] },
    },
    required: ["sentiment", "category"],
  },
};

// ----- REFLECT ---------------------------------------------------------------

export const ReflectSchema = z.object({
  isEnough: z.boolean(),
  missingAspects: z.array(z.string()).default([]),
  additionalQueries: z.array(z.string()).default([]),
  reasoning: z.string(),
});
export type ReflectResult = z.infer<typeof ReflectSchema>;

export const ReflectResponseJsonSchema = {
  type: "object",
  properties: {
    isEnough: { type: "boolean" },
    missingAspects: { type: "array", items: { type: "string" } },
    additionalQueries: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
  },
  required: ["isEnough", "missingAspects", "additionalQueries", "reasoning"],
};

// ----- SYNTHESIZE ------------------------------------------------------------

export const ActionItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.number().int().min(1).max(5),
  effort: z.number().int().min(1).max(5),
  evidence: z.array(z.string()).min(1),
});

export const SynthesisSchema = z.object({
  executiveSummary: z.string(),
  sentimentTrend: z
    .array(z.object({ month: z.string(), score: z.number() }))
    .default([]),
  categoryBreakdown: z
    .array(
      z.object({
        category: categoryEnum,
        count: z.number().int().nonnegative(),
        avgSentiment: z.number(),
      }),
    )
    .default([]),
  topComplaints: z
    .array(
      z.object({
        theme: z.string(),
        count: z.number().int().nonnegative(),
        exampleQuotes: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  topPraises: z
    .array(
      z.object({
        theme: z.string(),
        count: z.number().int().nonnegative(),
        exampleQuotes: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  competitorComparison: z
    .array(
      z.object({
        competitor: z.string(),
        winRate: z.number(),
        theirStrengths: z.array(z.string()).default([]),
        theirWeaknesses: z.array(z.string()).default([]),
      }),
    )
    .optional(),
  actionItems: z.array(ActionItemSchema).min(1),
});
export type SynthesisResult = z.infer<typeof SynthesisSchema>;

export const SynthesisResponseJsonSchema = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    sentimentTrend: {
      type: "array",
      items: {
        type: "object",
        properties: { month: { type: "string" }, score: { type: "number" } },
        required: ["month", "score"],
      },
    },
    categoryBreakdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          count: { type: "integer" },
          avgSentiment: { type: "number" },
        },
        required: ["category", "count", "avgSentiment"],
      },
    },
    topComplaints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme: { type: "string" },
          count: { type: "integer" },
          exampleQuotes: { type: "array", items: { type: "string" } },
        },
        required: ["theme", "count", "exampleQuotes"],
      },
    },
    topPraises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme: { type: "string" },
          count: { type: "integer" },
          exampleQuotes: { type: "array", items: { type: "string" } },
        },
        required: ["theme", "count", "exampleQuotes"],
      },
    },
    competitorComparison: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competitor: { type: "string" },
          winRate: { type: "number" },
          theirStrengths: { type: "array", items: { type: "string" } },
          theirWeaknesses: { type: "array", items: { type: "string" } },
        },
        required: ["competitor", "winRate", "theirStrengths", "theirWeaknesses"],
      },
    },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          impact: { type: "integer" },
          effort: { type: "integer" },
          evidence: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "impact", "effort", "evidence"],
      },
    },
  },
  required: ["executiveSummary", "actionItems"],
};
