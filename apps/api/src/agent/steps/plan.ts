import type { BusinessInput } from "@voc/shared";
import { PLAN_SYSTEM_INSTRUCTION, buildPlanPrompt } from "@voc/shared";
import type { Env } from "../../env.js";
import { GeminiClient } from "../../lib/gemini.js";
import { recordEvent } from "../events.js";
import { PlanResponseJsonSchema, PlanSchema, type PlanResult } from "../schemas.js";

export async function runPlan(
  env: Env,
  analysisId: string,
  input: BusinessInput,
): Promise<PlanResult> {
  await recordEvent(env, { analysisId, step: "discover", status: "started" });

  // Manual paste short-circuits planning entirely.
  if (input.sourceMode === "manual_paste") {
    const plan: PlanResult = {
      sources: ["manual"],
      searchQueries: [],
      focusCategories: [],
      hypothesesToTest: [],
    };
    await recordEvent(env, {
      analysisId,
      step: "discover",
      status: "completed",
      message: "manual paste mode — skipping LLM plan",
      payload: { plan },
    });
    return plan;
  }

  const client = new GeminiClient(env);
  const { data: plan, usage } = await client.generateJson({
    systemInstruction: PLAN_SYSTEM_INSTRUCTION,
    prompt: buildPlanPrompt({
      businessName: input.businessName,
      ...(input.businessUrl ? { businessUrl: input.businessUrl } : {}),
      competitors: input.competitors ?? [],
      sourceMode: input.sourceMode,
    }),
    responseSchema: PlanResponseJsonSchema,
    zodSchema: PlanSchema,
  });

  await recordEvent(env, {
    analysisId,
    step: "discover",
    status: "completed",
    message: "plan generated",
    payload: { plan, usage },
  });

  return plan;
}
