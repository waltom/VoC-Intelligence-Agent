const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

export const apiUrl = (path: string) => `${API_URL}${path}`;
export const apiKey = () => API_KEY;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-json body */
  }
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, body, message);
  }
  return body as T;
}

export async function pingHealth(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API_URL}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// ----- demo fallback -------------------------------------------------------

export async function loadDemoAnalysis(): Promise<AnalysisDetail> {
  const res = await fetch("/demo.json");
  if (!res.ok) throw new Error("demo.json missing");
  const data = (await res.json()) as { analysis: AnalysisDetail };
  return data.analysis;
}

// ----- typed endpoints -----------------------------------------------------

export interface AnalysisListItem {
  id: string;
  businessName: string;
  status: string;
  sourceMode: string;
  createdAt: number;
  completedAt: number | null;
}

export interface AnalysisDetail {
  id: string;
  businessName: string;
  businessUrl: string | null;
  competitors: string[];
  status: string;
  sourceMode: string;
  createdAt: number;
  completedAt: number | null;
  reviewCount?: number;
  tokensUsed?: number;
  costEstimateUsd?: number;
  summary: SynthesisSummary | null;
  error: string | null;
}

export interface SynthesisSummary {
  executiveSummary: string;
  sentimentTrend: { month: string; score: number }[];
  categoryBreakdown: { category: string; count: number; avgSentiment: number }[];
  topComplaints: { theme: string; count: number; exampleQuotes: string[] }[];
  topPraises: { theme: string; count: number; exampleQuotes: string[] }[];
  competitorComparison?: {
    competitor: string;
    winRate: number;
    theirStrengths: string[];
    theirWeaknesses: string[];
  }[];
  actionItems: {
    title: string;
    description: string;
    impact: number;
    effort: number;
    evidence: string[];
  }[];
}

export interface ReviewRow {
  id: string;
  source: string;
  source_url: string | null;
  author: string | null;
  rating: number | null;
  content: string;
  posted_at: number | null;
  language: string | null;
  sentiment: string | null;
  category: string | null;
}

export const api = {
  list: (status?: string) =>
    apiFetch<{ items: AnalysisListItem[]; total: number }>(
      `/analyses${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  get: (id: string) => apiFetch<{ analysis: AnalysisDetail }>(`/analyses/${id}`),
  reviews: (id: string, q: Record<string, string | number | undefined> = {}) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") usp.set(k, String(v));
    return apiFetch<{ items: ReviewRow[]; total: number }>(
      `/analyses/${id}/reviews?${usp.toString()}`,
    );
  },
  start: (body: Record<string, unknown>) =>
    apiFetch<{ analysisId: string }>("/analyses", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<{ ok: true }>(`/analyses/${id}`, { method: "DELETE" }),
};
