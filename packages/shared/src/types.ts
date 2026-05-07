export type Sentiment = "positive" | "neutral" | "negative";

export type Category =
  | "price"
  | "service"
  | "quality"
  | "delivery"
  | "ux"
  | "communication"
  | "other";

export type AnalysisStatus =
  | "pending"
  | "discovering"
  | "scraping"
  | "classifying"
  | "embedding"
  | "synthesizing"
  | "completed"
  | "failed";

export type SourceMode = "auto" | "manual_paste";

export interface PastedReview {
  content: string;
  rating?: number;
  author?: string;
  postedAt?: string;
  source?: string;
}

export interface BusinessInput {
  businessName: string;
  businessUrl?: string;
  competitors?: string[];
  sourceMode: SourceMode;
  pastedReviews?: PastedReview[];
}

export interface Review {
  id: string;
  analysisId: string;
  source: string;
  sourceUrl?: string;
  author?: string;
  rating?: number;
  content: string;
  postedAt?: string;
  language?: string;
  sentiment?: Sentiment;
  category?: Category;
  embeddingRef?: string;
  rawJson?: string;
}

export interface ActionItem {
  title: string;
  description: string;
  impact: 1 | 2 | 3 | 4 | 5;
  effort: 1 | 2 | 3 | 4 | 5;
  evidence: string[];
}

export interface AnalysisSummary {
  overallSentiment: Sentiment;
  averageRating?: number;
  totalReviews: number;
  byCategory: Record<Category, { positive: number; neutral: number; negative: number }>;
  topThemes: { theme: string; count: number; sentiment: Sentiment }[];
  actionItems: ActionItem[];
  competitorComparison?: {
    name: string;
    averageRating?: number;
    totalReviews: number;
    overallSentiment: Sentiment;
  }[];
  generatedAt: string;
}

export interface Analysis {
  id: string;
  businessName: string;
  businessUrl?: string;
  competitors: string[];
  status: AnalysisStatus;
  sourceMode: SourceMode;
  createdAt: string;
  completedAt?: string;
  summary?: AnalysisSummary;
  error?: string;
  tokensUsed: number;
  costEstimateUsd: number;
}

export type AgentEventStep =
  | "init"
  | "discover"
  | "scrape"
  | "classify"
  | "embed"
  | "synthesize"
  | "report"
  | "error";

export type AgentEventStatus = "started" | "progress" | "completed" | "failed";

export interface AgentEvent {
  id: string;
  analysisId: string;
  step: AgentEventStep;
  status: AgentEventStatus;
  message?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
