import type { AgentEventStatus, AgentEventStep } from "@voc/shared";
import type { Env } from "../env.js";

export async function recordEvent(
  env: Env,
  args: {
    analysisId: string;
    step: AgentEventStep;
    status: AgentEventStatus;
    message?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await env.voc_db
    .prepare(
      "INSERT INTO events (id, analysis_id, step, status, message, payload_json, created_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(
      crypto.randomUUID(),
      args.analysisId,
      args.step,
      args.status,
      args.message ?? null,
      args.payload ? JSON.stringify(args.payload) : null,
      Date.now(),
    )
    .run()
    .catch((e) => console.error("[events] failed to record:", (e as Error).message));
}

export async function listEventsSince(
  env: Env,
  analysisId: string,
  sinceMs: number,
): Promise<
  {
    id: string;
    step: string;
    status: string;
    message: string | null;
    payload_json: string | null;
    created_at: number;
  }[]
> {
  const rs = await env.voc_db
    .prepare(
      "SELECT id, step, status, message, payload_json, created_at " +
        "FROM events WHERE analysis_id = ?1 AND created_at > ?2 ORDER BY created_at ASC",
    )
    .bind(analysisId, sinceMs)
    .all<{
      id: string;
      step: string;
      status: string;
      message: string | null;
      payload_json: string | null;
      created_at: number;
    }>();
  return rs.results ?? [];
}
