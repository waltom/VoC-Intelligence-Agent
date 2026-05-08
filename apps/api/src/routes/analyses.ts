import type { BusinessInput } from "@voc/shared";
import { Hono } from "hono";
import { listEventsSince } from "../agent/events.js";
import type { Env } from "../env.js";
import { sleep } from "../lib/sleep.js";
import { sseResponse, type SseEvent } from "../lib/sse.js";
import { createAnalysis } from "../storage.js";

export const analysesRoutes = new Hono<{ Bindings: Env }>();

analysesRoutes.post("/", async (c) => {
  const body = await c.req.json<BusinessInput>();
  if (!body?.businessName || !body.sourceMode) {
    return c.json({ ok: false, error: "businessName and sourceMode are required" }, 400);
  }

  const analysisId = await createAnalysis(c.env, body);
  await c.env.voc_db
    .prepare("UPDATE analyses SET status = 'queued' WHERE id = ?1")
    .bind(analysisId)
    .run();

  const stub = c.env.ANALYSIS_DO.get(c.env.ANALYSIS_DO.idFromName(analysisId));
  const startRes = await stub.fetch("https://do/start", {
    method: "POST",
    body: JSON.stringify({ analysisId, input: body }),
    headers: { "content-type": "application/json" },
  });
  if (!startRes.ok) {
    const txt = await startRes.text().catch(() => "");
    return c.json({ ok: false, error: `failed to start: ${txt}`, analysisId }, 500);
  }

  return c.json({
    ok: true,
    analysisId,
    statusUrl: `/analyses/${analysisId}`,
    eventsUrl: `/analyses/${analysisId}/events`,
  });
});

analysesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.voc_db
    .prepare(
      "SELECT id, business_name, business_url, competitors, status, source_mode, " +
        "       created_at, completed_at, summary_json, error " +
        "FROM analyses WHERE id = ?1",
    )
    .bind(id)
    .first<{
      id: string;
      business_name: string;
      business_url: string | null;
      competitors: string | null;
      status: string;
      source_mode: string;
      created_at: number;
      completed_at: number | null;
      summary_json: string | null;
      error: string | null;
    }>();
  if (!row) return c.json({ ok: false, error: "not found" }, 404);

  return c.json({
    ok: true,
    analysis: {
      id: row.id,
      businessName: row.business_name,
      businessUrl: row.business_url,
      competitors: row.competitors ? JSON.parse(row.competitors) : [],
      status: row.status,
      sourceMode: row.source_mode,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      summary: row.summary_json ? JSON.parse(row.summary_json) : null,
      error: row.error,
    },
  });
});

analysesRoutes.get("/:id/events", (c) => {
  const id = c.req.param("id");
  const env = c.env;

  return sseResponse(streamEvents(env, id));
});

async function* streamEvents(env: Env, analysisId: string): AsyncGenerator<SseEvent, void, unknown> {
  let since = 0;
  // Initial hello so the client knows the stream is open.
  yield { event: "open", data: { analysisId } };

  // Poll D1.events; terminate once the analysis reaches a terminal status or
  // we hit the soft cap. Polling is far simpler than DO WebSocket plumbing
  // and matches the spec's "polluje D1.events co 500ms" suggestion.
  const MAX_TICKS = 600; // 600 * 500ms = 5 minutes

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const events = await listEventsSince(env, analysisId, since);
    for (const ev of events) {
      since = ev.created_at;
      yield {
        event: ev.step,
        id: ev.id,
        data: {
          step: ev.step,
          status: ev.status,
          message: ev.message,
          payload: ev.payload_json ? JSON.parse(ev.payload_json) : null,
          createdAt: ev.created_at,
        },
      };
    }

    const status = await env.voc_db
      .prepare("SELECT status FROM analyses WHERE id = ?1")
      .bind(analysisId)
      .first<{ status: string }>();
    if (status && (status.status === "completed" || status.status === "failed")) {
      yield { event: "end", data: { status: status.status } };
      return;
    }

    await sleep(500);
  }

  yield { event: "end", data: { status: "timeout" } };
}
