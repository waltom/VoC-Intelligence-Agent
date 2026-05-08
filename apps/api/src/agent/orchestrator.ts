import { REFLECT_MAX_CYCLES, type BusinessInput } from "@voc/shared";
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.js";
import {
  markAnalysisCompleted,
  markAnalysisFailed,
} from "../storage.js";
import { recordEvent } from "./events.js";
import {
  PlanSchema,
  ReflectSchema,
  type PlanResult,
  type ReflectResult,
  type SynthesisResult,
} from "./schemas.js";
import { computeStats, runClassify, type AggregateStats } from "./steps/classify.js";
import { runCollect } from "./steps/collect.js";
import { runPlan } from "./steps/plan.js";
import { runReflect } from "./steps/reflect.js";
import { runSynthesize } from "./steps/synthesize.js";
import type { AgentState, AgentStep, StartInput } from "./types.js";

const ALARM_GAP_MS = 50;
const MAX_ATTEMPTS_PER_STEP = 2;

/**
 * Replaces Cloudflare Workflows on the Free plan. The DO holds analysis state
 * in its SQLite store and advances through steps via setAlarm() — each alarm
 * runs a single step (or a single chunk of a step) so we never blow past the
 * 30s CPU limit per invocation.
 */
export class AnalysisOrchestrator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ensureSchema();
  }

  // -------- public RPC (via fetch routing) -----------------------------------

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      switch (url.pathname) {
        case "/start": {
          const body = (await request.json()) as StartInput;
          await this.start(body);
          return Response.json({ ok: true, analysisId: body.analysisId });
        }
        case "/status": {
          const state = this.readState();
          return Response.json({ ok: true, state });
        }
        default:
          return Response.json({ ok: false, error: "unknown DO route" }, { status: 404 });
      }
    } catch (e) {
      console.error("[DO] fetch error:", e);
      return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
    }
  }

  async start({ analysisId, input }: StartInput): Promise<void> {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO state " +
        "(analysis_id, current_step, attempt, reflect_count, classify_cursor, " +
        " plan_json, reflect_json, stats_json, additional_queries_json, " +
        " business_input, started_at, updated_at, error) " +
        "VALUES (?, 'plan', 0, 0, 0, NULL, NULL, NULL, NULL, ?, ?, ?, NULL)",
      analysisId,
      JSON.stringify(input),
      now,
      now,
    );
    await recordEvent(this.env, { analysisId, step: "init", status: "started" });
    await this.ctx.storage.setAlarm(Date.now() + ALARM_GAP_MS);
  }

  // -------- alarm-driven step loop ------------------------------------------

  override async alarm(): Promise<void> {
    const state = this.readState();
    if (!state) return;
    if (state.current_step === "completed" || state.current_step === "failed") return;

    const analysisId = this.getAnalysisId();
    if (!analysisId) return;

    try {
      const next = await this.runStep(analysisId, state);
      if (next === "completed") {
        await markAnalysisCompleted(this.env, analysisId);
        this.updateStep(next);
        await recordEvent(this.env, {
          analysisId,
          step: "report",
          status: "completed",
          message: "analysis finished",
        });
        return;
      }
      if (next === "failed") {
        return; // failure path handled in catch
      }
      this.updateStep(next, { resetAttempt: true });
      await this.ctx.storage.setAlarm(Date.now() + ALARM_GAP_MS);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      console.error(`[DO ${analysisId}] step ${state.current_step} failed:`, msg);

      const attempt = state.attempt + 1;
      if (attempt >= MAX_ATTEMPTS_PER_STEP) {
        await markAnalysisFailed(this.env, analysisId, msg);
        this.updateStep("failed", { error: msg });
        await recordEvent(this.env, {
          analysisId,
          step: "error",
          status: "failed",
          message: msg,
        });
        return;
      }

      this.bumpAttempt(attempt, msg);
      await recordEvent(this.env, {
        analysisId,
        step: "error",
        status: "progress",
        message: `retry ${attempt}/${MAX_ATTEMPTS_PER_STEP}: ${msg}`,
      });
      // Exponential backoff between retries.
      await this.ctx.storage.setAlarm(Date.now() + 1000 * Math.pow(2, attempt));
    }
  }

  // -------- step dispatch ----------------------------------------------------

  private async runStep(analysisId: string, state: AgentState): Promise<AgentStep> {
    const input = JSON.parse(state.business_input) as BusinessInput;

    switch (state.current_step) {
      case "plan": {
        const plan = await runPlan(this.env, analysisId, input);
        this.savePlan(plan);
        return "collect";
      }
      case "collect": {
        const plan = this.requirePlan(state);
        const additional = state.additional_queries_json
          ? (JSON.parse(state.additional_queries_json) as string[])
          : [];
        await runCollect(this.env, analysisId, input, plan, additional);
        return "classify";
      }
      case "classify": {
        await runClassify(this.env, analysisId);
        const stats = await computeStats(this.env, analysisId);
        this.saveStats(stats);
        // Manual paste skips reflect entirely.
        return input.sourceMode === "manual_paste" ? "synthesize" : "reflect";
      }
      case "reflect": {
        const plan = this.requirePlan(state);
        const stats = state.stats_json
          ? (JSON.parse(state.stats_json) as AggregateStats)
          : await computeStats(this.env, analysisId);
        const reflection = await runReflect(
          this.env,
          analysisId,
          plan,
          stats,
          state.reflect_count,
        );
        this.saveReflection(reflection);

        if (
          !reflection.isEnough &&
          state.reflect_count < REFLECT_MAX_CYCLES - 1 &&
          reflection.additionalQueries.length > 0
        ) {
          this.queueAnotherCollect(reflection.additionalQueries, state.reflect_count + 1);
          return "collect";
        }
        return "synthesize";
      }
      case "synthesize": {
        const stats = state.stats_json
          ? (JSON.parse(state.stats_json) as AggregateStats)
          : await computeStats(this.env, analysisId);
        const reflection = state.reflect_json
          ? (JSON.parse(state.reflect_json) as ReflectResult)
          : undefined;
        const synthesis = await runSynthesize(
          this.env,
          analysisId,
          input.businessName,
          input.competitors ?? [],
          stats,
          reflection?.reasoning,
        );
        await this.persistSummary(analysisId, synthesis);
        return "completed";
      }
      default:
        return "failed";
    }
  }

  // -------- SQLite state helpers --------------------------------------------

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (
        analysis_id              TEXT PRIMARY KEY,
        current_step             TEXT NOT NULL,
        attempt                  INTEGER NOT NULL DEFAULT 0,
        reflect_count            INTEGER NOT NULL DEFAULT 0,
        classify_cursor          INTEGER NOT NULL DEFAULT 0,
        plan_json                TEXT,
        reflect_json             TEXT,
        stats_json               TEXT,
        additional_queries_json  TEXT,
        business_input           TEXT NOT NULL,
        started_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL,
        error                    TEXT
      )
    `);
  }

  private readState(): AgentState | null {
    const cursor = this.ctx.storage.sql.exec<AgentState>("SELECT * FROM state LIMIT 1");
    const rows = cursor.toArray();
    return rows[0] ?? null;
  }

  private getAnalysisId(): string | null {
    const cursor = this.ctx.storage.sql.exec<{ analysis_id: string }>(
      "SELECT analysis_id FROM state LIMIT 1",
    );
    return cursor.toArray()[0]?.analysis_id ?? null;
  }

  private updateStep(step: AgentStep, opts: { resetAttempt?: boolean; error?: string } = {}): void {
    const now = Date.now();
    if (opts.error) {
      this.ctx.storage.sql.exec(
        "UPDATE state SET current_step = ?, updated_at = ?, error = ?",
        step,
        now,
        opts.error,
      );
    } else if (opts.resetAttempt) {
      this.ctx.storage.sql.exec(
        "UPDATE state SET current_step = ?, attempt = 0, updated_at = ?",
        step,
        now,
      );
    } else {
      this.ctx.storage.sql.exec(
        "UPDATE state SET current_step = ?, updated_at = ?",
        step,
        now,
      );
    }
  }

  private bumpAttempt(attempt: number, error: string): void {
    this.ctx.storage.sql.exec(
      "UPDATE state SET attempt = ?, error = ?, updated_at = ?",
      attempt,
      error,
      Date.now(),
    );
  }

  private savePlan(plan: PlanResult): void {
    this.ctx.storage.sql.exec(
      "UPDATE state SET plan_json = ?, updated_at = ?",
      JSON.stringify(plan),
      Date.now(),
    );
  }

  private requirePlan(state: AgentState): PlanResult {
    if (!state.plan_json) throw new Error("plan missing in state");
    return PlanSchema.parse(JSON.parse(state.plan_json));
  }

  private saveStats(stats: AggregateStats): void {
    this.ctx.storage.sql.exec(
      "UPDATE state SET stats_json = ?, updated_at = ?",
      JSON.stringify(stats),
      Date.now(),
    );
  }

  private saveReflection(reflection: ReflectResult): void {
    this.ctx.storage.sql.exec(
      "UPDATE state SET reflect_json = ?, reflect_count = reflect_count + 1, updated_at = ?",
      JSON.stringify(ReflectSchema.parse(reflection)),
      Date.now(),
    );
  }

  private queueAnotherCollect(queries: string[], _nextReflectCount: number): void {
    this.ctx.storage.sql.exec(
      "UPDATE state SET additional_queries_json = ?, updated_at = ?",
      JSON.stringify(queries),
      Date.now(),
    );
  }

  private async persistSummary(analysisId: string, synthesis: SynthesisResult): Promise<void> {
    await this.env.voc_db
      .prepare("UPDATE analyses SET summary_json = ?1 WHERE id = ?2")
      .bind(JSON.stringify(synthesis), analysisId)
      .run();
  }
}
