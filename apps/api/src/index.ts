import type { BusinessInput } from "@voc/shared";
import { Hono } from "hono";
import { collectReviews } from "./collectors/index.js";
import type { Env } from "./env.js";
import { corsMiddleware, requestLogger } from "./middleware.js";
import {
  createAnalysis,
  markAnalysisCompleted,
  markAnalysisFailed,
  persistReviews,
} from "./storage.js";

export { AnalysisOrchestrator } from "./orchestrator.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requestLogger);
app.use("*", corsMiddleware);

app.onError((err, c) => {
  console.error("[api] unhandled", err);
  return c.json({ ok: false, error: err.message ?? "Internal error" }, 500);
});

app.notFound((c) => c.json({ ok: false, error: "Not found", path: c.req.path }, 404));

app.get("/health", (c) => c.json({ ok: true }));

// TODO: remove after Prompt 3 (replaced by async DO orchestration).
app.post("/dev/collect", async (c) => {
  const body = await c.req.json<BusinessInput>();
  if (!body?.businessName || !body.sourceMode) {
    return c.json({ ok: false, error: "businessName and sourceMode are required" }, 400);
  }

  const analysisId = await createAnalysis(c.env, body);

  try {
    const reviews = await collectReviews(c.env, body);
    await persistReviews(c.env, analysisId, reviews);
    await markAnalysisCompleted(c.env, analysisId);

    return c.json({
      ok: true,
      analysisId,
      count: reviews.length,
      sample: reviews.slice(0, 3),
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    await markAnalysisFailed(c.env, analysisId, msg);
    return c.json({ ok: false, error: msg, analysisId }, 500);
  }
});

export default app;
