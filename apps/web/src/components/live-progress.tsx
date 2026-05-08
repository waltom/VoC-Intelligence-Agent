"use client";

import { Brain, CheckCircle2, Circle, Loader2, Sparkles, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "init", label: "Plan" },
  { key: "discover", label: "Plan" },
  { key: "scrape", label: "Collect" },
  { key: "classify", label: "Classify" },
  { key: "synthesize", label: "Reflect / Synthesize" },
  { key: "report", label: "Report" },
] as const;

const STEPPER = ["Plan", "Collect", "Classify", "Reflect", "Synthesize"] as const;
type StepperStep = (typeof STEPPER)[number];

interface LiveEvent {
  step: string;
  status: string;
  message: string | null;
  payload: { plan?: unknown; reflection?: { reasoning?: string }; usage?: { totalTokens?: number }; total?: number; count?: number; classified?: number; embedded?: number } | null;
  createdAt: number;
}

interface LiveProgressProps {
  analysisId: string;
  onComplete: () => void;
}

function eventToStepper(step: string, message: string | null): StepperStep | null {
  if (step === "discover" || step === "init") return "Plan";
  if (step === "scrape") return "Collect";
  if (step === "classify") return "Classify";
  if (step === "synthesize") return message?.startsWith("reflect") ? "Reflect" : "Synthesize";
  return null;
}

export function LiveProgress({ analysisId, onComplete }: LiveProgressProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<"running" | "completed" | "failed" | "rate_limited">(
    "running",
  );
  const [activeStep, setActiveStep] = useState<StepperStep>("Plan");
  const [completedSteps, setCompletedSteps] = useState<Set<StepperStep>>(new Set());
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(apiUrl(`/analyses/${analysisId}/events`));
    eventSourceRef.current = es;

    const handler = (rawEvent: MessageEvent) => {
      try {
        const data = JSON.parse(rawEvent.data) as LiveEvent | { status: string };
        if ("step" in data) {
          setEvents((prev) => [...prev, data].slice(-30));
          const stepper = eventToStepper(data.step, data.message);
          if (stepper) {
            setActiveStep(stepper);
            if (data.status === "completed") {
              setCompletedSteps((s) => new Set(s).add(stepper));
            }
          }
          const reflectReason = data.payload?.reflection?.reasoning;
          if (reflectReason) setReasoning(reflectReason);
          const usage = data.payload?.usage?.totalTokens;
          if (typeof usage === "number") setTokens((t) => t + usage);
        } else if ("status" in data && (data.status === "completed" || data.status === "failed")) {
          setStatus(data.status);
          if (data.status === "completed") {
            setCompletedSteps(new Set(STEPPER));
            setTimeout(onComplete, 1200);
          }
        }
      } catch {
        /* ignore */
      }
    };

    // Generic event handler — listen on all named events.
    for (const e of [
      "open",
      "init",
      "discover",
      "scrape",
      "classify",
      "synthesize",
      "report",
      "error",
      "end",
    ]) {
      es.addEventListener(e, handler);
    }
    es.onerror = () => {
      // network glitch: keep displaying — wrangler dev sometimes drops idle SSE
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [analysisId, onComplete]);

  const costEstimate = (tokens / 1_000_000) * 0.4; // upper bound: all output

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <p className="label-eyebrow mb-3">Postęp agenta</p>
        <Stepper active={activeStep} completed={completedSteps} status={status} />
        {status === "rate_limited" && (
          <div className="mt-4 rounded-lg border border-warn/30 bg-warn-muted/40 p-3 text-sm">
            Gemini chwilowo limituje zapytania. Spróbuj w trybie wklejania —{" "}
            <a href="/analyses/new" className="font-medium underline">
              wklej recenzje
            </a>
            .
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card p-6 md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-zinc-500" />
            <p className="label-eyebrow">Agent thinks aloud</p>
          </div>
          {reasoning ? (
            <p className="text-[15px] leading-relaxed text-zinc-800">&ldquo;{reasoning}&rdquo;</p>
          ) : (
            <p className="text-sm italic text-zinc-400">
              Czekam na pierwszą refleksję agenta…
            </p>
          )}
        </div>

        <div className="card p-6">
          <p className="label-eyebrow mb-2">Zużycie</p>
          <p className="stat-value">{tokens.toLocaleString("pl-PL")}</p>
          <p className="text-xs text-zinc-500">tokens (Gemini)</p>
          <p className="mt-3 text-sm text-zinc-700">
            <span className="tabular-nums">${costEstimate.toFixed(4)}</span>{" "}
            <span className="text-xs text-zinc-500">szacowany koszt</span>
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
          <p className="label-eyebrow">Live events</p>
          <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <div className="px-6 py-8 text-sm text-zinc-400">
              <Loader2 className="mb-2 h-4 w-4 animate-spin" />
              Inicjalizuję orchestrator…
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {events.map((ev, i) => (
                <li key={i} className="flex items-start gap-3 px-6 py-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 place-items-center">
                    {ev.status === "failed" ? (
                      <XCircle className="h-3.5 w-3.5 text-bad" />
                    ) : ev.status === "completed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-good" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-zinc-800">
                      {ev.step}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        {ev.status}
                      </span>
                    </p>
                    {ev.message && <p className="text-xs text-zinc-500">{ev.message}</p>}
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                    {new Date(ev.createdAt).toLocaleTimeString("pl-PL")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  active,
  completed,
  status,
}: {
  active: StepperStep;
  completed: Set<StepperStep>;
  status: "running" | "completed" | "failed" | "rate_limited";
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {STEPPER.map((step, i) => {
        const isDone = completed.has(step) || status === "completed";
        const isActive = !isDone && step === active && status === "running";
        const isFailed = status === "failed" && step === active;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-medium transition",
                isFailed
                  ? "border-bad bg-bad text-white"
                  : isDone
                    ? "border-good bg-good text-white"
                    : isActive
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-500",
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : isFailed ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                isDone || isActive ? "font-medium text-zinc-900" : "text-zinc-500",
              )}
            >
              {step}
            </span>
            {i < STEPPER.length - 1 && <span className="mx-1 h-px w-6 bg-zinc-200" />}
          </li>
        );
      })}
    </ol>
  );
}

void STEPS;
