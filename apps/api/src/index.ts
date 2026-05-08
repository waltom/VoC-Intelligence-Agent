import { Hono } from "hono";
import type { Env } from "./env.js";
import { corsMiddleware, requestLogger } from "./middleware.js";
import { apiKeyMiddleware, err, quotaGuardMiddleware } from "./middleware/auth.js";
import { analysesRoutes } from "./routes/analyses.js";
import { demoRoutes } from "./routes/demo.js";

export { AnalysisOrchestrator } from "./agent/orchestrator.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requestLogger);
app.use("*", corsMiddleware);
app.use("*", apiKeyMiddleware);

app.onError((err, c) => {
  console.error("[api] unhandled", err);
  return c.json({ error: err.message ?? "Internal error", code: "INTERNAL" }, 500);
});

app.notFound((c) =>
  c.json(err("NOT_FOUND", "route not found", { path: c.req.path }), 404),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/demo", demoRoutes);

// Quota guard only on POST /analyses (start). Read endpoints stay open.
app.use("/analyses", async (c, next) => {
  if (c.req.method === "POST") return quotaGuardMiddleware(c, next);
  return next();
});

app.route("/analyses", analysesRoutes);

export default app;
