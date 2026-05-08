import { MODELS } from "@voc/shared";
import { z } from "zod";
import type { Env } from "../env.js";
import { sleep } from "./sleep.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TRANSIENT_RETRIES = 3;
const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_WAIT_MS = 60_000;

export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  model: string;
}

export class GeminiRateLimitedError extends Error {
  constructor() {
    super("Gemini rate limited after retries");
    this.name = "GeminiRateLimitedError";
  }
}

export interface GenerateJsonOptions<T> {
  /** Persona / instructions sent in systemInstruction. */
  systemInstruction?: string;
  /** User prompt body. */
  prompt: string;
  /** JSON schema (subset) used as Gemini's responseSchema. */
  responseSchema: Record<string, unknown>;
  /** Zod schema used to validate parsed output. */
  zodSchema: z.ZodSchema<T>;
  /** Flash Lite supports thinking budget; default 0 (no extended thinking). */
  thinkingBudget?: number;
  /** Sampling temperature; default 0.2 (deterministic-ish). */
  temperature?: number;
  /** Per-request timeout (ms); default 30_000. */
  timeoutMs?: number;
  /** Override model id; defaults to gemini-2.5-flash-lite. */
  model?: string;
}

export class GeminiClient {
  constructor(private readonly env: Env) {
    if (!env.GEMINI_API_KEY) {
      console.warn("[gemini] GEMINI_API_KEY is empty — calls will fail");
    }
  }

  async generateJson<T>(opts: GenerateJsonOptions<T>): Promise<{ data: T; usage: GeminiUsage }> {
    const model = opts.model ?? MODELS.geminiFlashLite;
    const url = `${ENDPOINT}/${model}:generateContent?key=${this.env.GEMINI_API_KEY}`;

    const body = {
      ...(opts.systemInstruction
        ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        temperature: opts.temperature ?? 0.2,
        thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
      },
    };

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let rateLimitRetries = 0;
    let transientRetries = 0;
    let lastError: Error | undefined;

    while (true) {
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        lastError = e as Error;
        if (transientRetries++ >= MAX_TRANSIENT_RETRIES) throw lastError;
        await sleep(500 * Math.pow(2, transientRetries));
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 429) {
        if (rateLimitRetries++ >= MAX_RATE_LIMIT_RETRIES) throw new GeminiRateLimitedError();
        console.warn(`[gemini] 429 rate-limited, sleeping ${RATE_LIMIT_WAIT_MS}ms`);
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }

      if (res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastError = new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
        if (transientRetries++ >= MAX_TRANSIENT_RETRIES) throw lastError;
        await sleep(500 * Math.pow(2, transientRetries));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`);
      }

      const json = (await res.json()) as GeminiResponse;
      const latencyMs = Date.now() - started;
      const text = extractText(json);
      const parsed = parseJsonLenient(text);
      const data = opts.zodSchema.parse(parsed);

      const usage: GeminiUsage = {
        promptTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: json.usageMetadata?.totalTokenCount ?? 0,
        latencyMs,
        model,
      };

      return { data, usage };
    }
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function extractText(res: GeminiResponse): string {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

/**
 * Gemini Flash Lite occasionally wraps JSON in ```json fences even when
 * responseMimeType is set. Strip them defensively.
 */
function parseJsonLenient(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json|JSON)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }
  return JSON.parse(text);
}
