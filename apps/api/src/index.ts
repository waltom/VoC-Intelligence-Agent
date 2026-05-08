import { Hono } from "hono";
import type { Env } from "./env.js";
import { corsMiddleware, requestLogger } from "./middleware.js";
import { analysesRoutes } from "./routes/analyses.js";

export { AnalysisOrchestrator } from "./agent/orchestrator.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requestLogger);
app.use("*", corsMiddleware);

app.onError((err, c) => {
  console.error("[api] unhandled", err);
  return c.json({ ok: false, error: err.message ?? "Internal error" }, 500);
});

app.notFound((c) => c.json({ ok: false, error: "Not found", path: c.req.path }, 404));

app.get("/health", (c) => c.json({ ok: true }));

app.route("/analyses", analysesRoutes);

export default app;
