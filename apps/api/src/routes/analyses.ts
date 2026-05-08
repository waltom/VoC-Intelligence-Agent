import { CATEGORIES, MAX_PASTED_REVIEWS, SENTIMENTS } from "@voc/shared";
import { Hono } from "hono";
import { z } from "zod";
import { listEventsSince } from "../agent/events.js";
import { SynthesisSchema, type SynthesisResult } from "../agent/schemas.js";
import type { Env } from "../env.js";
import { err } from "../middleware/auth.js";
import { clientIp, rateLimit } from "../lib/rate-limit.js";
import {
  deleteCachedReport,
  getCachedReport,
  putCachedReport,
  renderReportHtml,
} from "../lib/report-html.js";
import { pdfNotImplemented } from "../lib/report-pdf.js";
import { sleep } from "../lib/sleep.js";
import { sseResponse, type SseEvent } from "../lib/sse.js";
import { computeUsageForAnalysis } from "../lib/telemetry.js";
import { createAnalysis } from "../storage.js";

export const analysesRoutes = new Hono<{ Bindings: Env }>();

const POST_RATE_LIMIT = 5;

const PastedReviewSchema = z.object({
  content: z.string().min(1),
  rating: z.number().min(0).max(5).optional(),
  author: z.string().optional(),
  postedAt: z.string().optional(),
  source: z.string().optional(),
});

const StartBodySchema = z.object({
  businessName: z.string().min(1).max(200),
  businessUrl: z.string().url().optional(),
  competitors: z.array(z.string().min(1)).max(10).optional(),
  sourceMode: z.enum(["auto", "manual_paste"]),
  pastedReviews: z.array(PastedReviewSchema).max(MAX_PASTED_REVIEWS).optional(),
  appStoreId: z.string().optional(),
  appStoreCountry: z.string().length(2).optional(),
});

// ----- POST /analyses --------------------------------------------------------

analysesRoutes.post("/", async (c) => {
  const rl = await rateLimit(c.env, clientIp(c.req.raw), "post-analyses", POST_RATE_LIMIT);
  if (!rl.allowed) {
    return c.json(
      err("RATE_LIMITED", `Limit ${rl.limit} POST/hour exceeded`, {
        retryAfterSeconds: rl.retryAfterSeconds,
      }),
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  let parsed;
  try {
    parsed = StartBodySchema.parse(await c.req.json());
  } catch (e) {
    return c.json(err("VALIDATION", "invalid request body", (e as z.ZodError).issues), 400);
  }

  if (parsed.sourceMode === "manual_paste" && (!parsed.pastedReviews?.length)) {
    return c.json(err("VALIDATION", "pastedReviews is required for manual_paste"), 400);
  }

  const analysisId = await createAnalysis(c.env, parsed);
  await c.env.voc_db
    .prepare("UPDATE analyses SET status = 'queued' WHERE id = ?1")
    .bind(analysisId)
    .run();

  const stub = c.env.ANALYSIS_DO.get(c.env.ANALYSIS_DO.idFromName(analysisId));
  const startRes = await stub.fetch("https://do/start", {
    method: "POST",
    body: JSON.stringify({ analysisId, input: parsed }),
    headers: { "content-type": "application/json" },
  });
  if (!startRes.ok) {
    const txt = await startRes.text().catch(() => "");
    return c.json(err("INTERNAL", `failed to start: ${txt.slice(0, 200)}`, { analysisId }), 500);
  }

  return c.json({
    ok: true,
    analysisId,
    statusUrl: `/analyses/${analysisId}`,
    eventsUrl: `/analyses/${analysisId}/events`,
    reportUrl: `/analyses/${analysisId}/report.html`,
  });
});

// ----- GET /analyses (list, paginated, optional status filter) --------------

const ListQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

analysesRoutes.get("/", async (c) => {
  let q;
  try {
    q = ListQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  } catch (e) {
    return c.json(err("VALIDATION", "invalid query", (e as z.ZodError).issues), 400);
  }

  const where = q.status ? "WHERE status = ?1" : "";
  const params = q.status ? [q.status, q.limit, q.offset] : [q.limit, q.offset];
  const limitParam = q.status ? "?2" : "?1";
  const offsetParam = q.status ? "?3" : "?2";

  const rs = await c.env.voc_db
    .prepare(
      `SELECT id, business_name, status, source_mode, created_at, completed_at
       FROM analyses ${where}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
    )
    .bind(...params)
    .all<{
      id: string;
      business_name: string;
      status: string;
      source_mode: string;
      created_at: number;
      completed_at: number | null;
    }>();

  const total = await c.env.voc_db
    .prepare(`SELECT COUNT(*) as n FROM analyses ${where}`)
    .bind(...(q.status ? [q.status] : []))
    .first<{ n: number }>();

  return c.json({
    ok: true,
    total: total?.n ?? 0,
    limit: q.limit,
    offset: q.offset,
    items: (rs.results ?? []).map((r) => ({
      id: r.id,
      businessName: r.business_name,
      status: r.status,
      sourceMode: r.source_mode,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    })),
  });
});

// ----- GET /analyses/:id -----------------------------------------------------

analysesRoutes.get("/:id", async (c) => {
  const analysis = await loadAnalysis(c.env, c.req.param("id"));
  if (!analysis) return c.json(err("NOT_FOUND", "analysis not found"), 404);

  const usage = await computeUsageForAnalysis(c.env, analysis.id);
  const reviewCount = await c.env.voc_db
    .prepare("SELECT COUNT(*) as n FROM reviews WHERE analysis_id = ?1")
    .bind(analysis.id)
    .first<{ n: number }>();

  return c.json({
    ok: true,
    analysis: {
      ...analysis,
      reviewCount: reviewCount?.n ?? 0,
      tokensUsed: usage.totalTokens,
      costEstimateUsd: usage.costUsd,
    },
  });
});

// ----- GET /analyses/:id/events (SSE) ---------------------------------------

analysesRoutes.get("/:id/events", (c) => {
  const id = c.req.param("id");
  return sseResponse(streamEvents(c.env, id));
});

async function* streamEvents(
  env: Env,
  analysisId: string,
): AsyncGenerator<SseEvent, void, unknown> {
  let since = 0;
  yield { event: "open", data: { analysisId } };

  const MAX_TICKS = 600; // 5 min
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

// ----- GET /analyses/:id/reviews --------------------------------------------

const ReviewsQuerySchema = z.object({
  sentiment: z.enum(SENTIMENTS as unknown as [string, ...string[]]).optional(),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]).optional(),
  q: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

analysesRoutes.get("/:id/reviews", async (c) => {
  const id = c.req.param("id");
  let q;
  try {
    q = ReviewsQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  } catch (e) {
    return c.json(err("VALIDATION", "invalid query", (e as z.ZodError).issues), 400);
  }

  const where: string[] = ["analysis_id = ?"];
  const args: (string | number)[] = [id];
  if (q.sentiment) {
    where.push("sentiment = ?");
    args.push(q.sentiment);
  }
  if (q.category) {
    where.push("category = ?");
    args.push(q.category);
  }
  if (q.q) {
    where.push("content LIKE ?");
    args.push(`%${q.q}%`);
  }

  const total = await c.env.voc_db
    .prepare(`SELECT COUNT(*) as n FROM reviews WHERE ${where.join(" AND ")}`)
    .bind(...args)
    .first<{ n: number }>();

  const rs = await c.env.voc_db
    .prepare(
      `SELECT id, source, source_url, author, rating, content, posted_at, language, sentiment, category
       FROM reviews WHERE ${where.join(" AND ")}
       ORDER BY posted_at DESC NULLS LAST, id ASC
       LIMIT ? OFFSET ?`,
    )
    .bind(...args, q.limit, q.offset)
    .all();

  return c.json({
    ok: true,
    total: total?.n ?? 0,
    limit: q.limit,
    offset: q.offset,
    items: rs.results ?? [],
  });
});

// ----- GET /analyses/:id/report.html ---------------------------------------

analysesRoutes.get("/:id/report.html", async (c) => {
  const id = c.req.param("id");

  // R2 cache check.
  const cached = await getCachedReport(c.env, id);
  if (cached) {
    return new Response(cached, {
      headers: htmlHeaders(id, "cached"),
    });
  }

  const analysis = await loadAnalysis(c.env, id);
  if (!analysis) return c.json(err("NOT_FOUND", "analysis not found"), 404);
  if (analysis.status !== "completed" || !analysis.summary) {
    return c.json(
      err("NOT_READY", "analysis is not completed yet", { status: analysis.status }),
      409,
    );
  }

  let summary: SynthesisResult;
  try {
    summary = SynthesisSchema.parse(analysis.summary);
  } catch (e) {
    return c.json(err("INTERNAL", "stored summary is malformed", (e as z.ZodError).issues), 500);
  }

  const usage = await computeUsageForAnalysis(c.env, id);
  const reviewCount = await c.env.voc_db
    .prepare("SELECT COUNT(*) as n FROM reviews WHERE analysis_id = ?1")
    .bind(id)
    .first<{ n: number }>();

  const html = renderReportHtml({
    analysisId: id,
    businessName: analysis.businessName,
    competitors: analysis.competitors,
    createdAt: analysis.createdAt,
    completedAt: analysis.completedAt,
    summary,
    usage,
    reviewCount: reviewCount?.n ?? 0,
    ...(c.env.LOGO_DATA_URL ? { logoDataUrl: c.env.LOGO_DATA_URL } : {}),
  });

  await putCachedReport(c.env, id, html);
  return new Response(html, { headers: htmlHeaders(id, "fresh") });
});

function htmlHeaders(id: string, source: "fresh" | "cached"): Record<string, string> {
  return {
    "content-type": "text/html; charset=utf-8",
    "content-disposition": `inline; filename="voc-report-${id}.html"`,
    "x-cache": source,
  };
}

// ----- GET /analyses/:id/report.pdf ----------------------------------------

analysesRoutes.get("/:id/report.pdf", (c) => pdfNotImplemented(c.req.param("id")));

// ----- DELETE /analyses/:id -------------------------------------------------

analysesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const exists = await c.env.voc_db
    .prepare("SELECT 1 FROM analyses WHERE id = ?1")
    .bind(id)
    .first();
  if (!exists) return c.json(err("NOT_FOUND", "analysis not found"), 404);

  // Vectorize: best-effort batch delete. Pull review ids first.
  const ids = await c.env.voc_db
    .prepare("SELECT id FROM reviews WHERE analysis_id = ?1 AND embedding_ref IS NOT NULL")
    .bind(id)
    .all<{ id: string }>();
  const vectorIds = (ids.results ?? []).map((r) => r.id);
  if (vectorIds.length > 0) {
    try {
      await c.env.VECTORIZE.deleteByIds(vectorIds);
    } catch (e) {
      console.warn("[delete] vectorize cleanup failed:", (e as Error).message);
    }
  }

  // R2 cached report.
  await deleteCachedReport(c.env, id);

  // DO state.
  try {
    const stub = c.env.ANALYSIS_DO.get(c.env.ANALYSIS_DO.idFromName(id));
    await stub.fetch("https://do/reset", { method: "POST" }).catch(() => undefined);
  } catch {
    /* ignore */
  }

  // D1 — events and reviews cascade via FK ON DELETE CASCADE.
  await c.env.voc_db.prepare("DELETE FROM analyses WHERE id = ?1").bind(id).run();

  return c.json({ ok: true, deleted: id, vectorsRemoved: vectorIds.length });
});

// ----- helpers --------------------------------------------------------------

interface LoadedAnalysis {
  id: string;
  businessName: string;
  businessUrl: string | null;
  competitors: string[];
  status: string;
  sourceMode: string;
  createdAt: number;
  completedAt: number | null;
  summary: unknown | null;
  error: string | null;
}

async function loadAnalysis(env: Env, id: string): Promise<LoadedAnalysis | null> {
  const row = await env.voc_db
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
  if (!row) return null;
  return {
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
  };
}
