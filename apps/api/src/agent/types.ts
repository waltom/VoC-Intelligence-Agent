import type { BusinessInput } from "@voc/shared";

export type AgentStep =
  | "queued"
  | "plan"
  | "collect"
  | "classify"
  | "reflect"
  | "synthesize"
  | "completed"
  | "failed";

export interface AgentState {
  current_step: AgentStep;
  attempt: number;
  reflect_count: number;
  classify_cursor: number;
  plan_json: string | null;
  reflect_json: string | null;
  stats_json: string | null;
  additional_queries_json: string | null;
  business_input: string;
  started_at: number;
  updated_at: number;
  error: string | null;
}

export interface StartInput {
  analysisId: string;
  input: BusinessInput;
}
