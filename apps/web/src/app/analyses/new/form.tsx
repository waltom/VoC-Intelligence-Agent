"use client";

import { ArrowRight, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ErrorBanner } from "@/components/banners";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "auto" | "paste";

const SAMPLE_PASTE = `[5] Kurier zostawił paczkę u sąsiada bez pytania.
[5] Aplikacja działa świetnie, paczka dotarła w 24h.
[2] Reklamacja idzie 3 tygodnie i nikt się nie odzywa.
[5] Wygodne, że paczkomat 24/7. Świetne rozwiązanie.
[1] Zaginęła paczka, zwrot kosztów po 6 tygodniach.`;

export function AnalysisForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("auto");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto fields
  const [businessName, setBusinessName] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);

  // Paste fields
  const [pasted, setPasted] = useState("");
  const [pasteName, setPasteName] = useState("");

  const previewCount = useMemo(() => detectReviewCount(pasted), [pasted]);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const body =
        tab === "auto"
          ? {
              businessName: businessName.trim(),
              businessUrl: businessUrl.trim() || undefined,
              competitors: competitors.map((c) => c.trim()).filter(Boolean).slice(0, 3),
              sourceMode: "auto",
            }
          : {
              businessName: pasteName.trim() || "Mój biznes",
              sourceMode: "manual_paste",
              pastedReviews: parsePasted(pasted),
            };
      const res = await api.start(body as Record<string, unknown>);
      router.push(`/analyses/${res.analysisId}?live=1`);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? "Przekroczono limit 5 analiz na godzinę. Spróbuj ponownie później."
          : (e as Error).message;
      setError(msg);
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting &&
    (tab === "auto"
      ? businessName.trim().length > 0
      : previewCount > 0 && pasteName.trim().length > 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b border-zinc-200">
        <TabButton active={tab === "auto"} onClick={() => setTab("auto")}>
          Auto
        </TabButton>
        <TabButton active={tab === "paste"} onClick={() => setTab("paste")}>
          Wklej recenzje
        </TabButton>
      </div>

      <div className="p-6 md:p-8">
        {error && <ErrorBanner message={error} className="mb-4" />}

        {tab === "auto" ? (
          <div className="space-y-5">
            <Field label="Nazwa firmy" required>
              <input
                className="input"
                placeholder="np. InPost"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="URL firmy (opcjonalny)">
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  className="input pl-9"
                  placeholder="https://inpost.pl"
                  value={businessUrl}
                  onChange={(e) => setBusinessUrl(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Konkurenci (do 3)">
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input"
                      placeholder={`np. ${["DPD", "DHL", "GLS"][i] ?? "konkurent"}`}
                      value={c}
                      onChange={(e) =>
                        setCompetitors((xs) => xs.map((x, j) => (i === j ? e.target.value : x)))
                      }
                    />
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => setCompetitors((xs) => xs.filter((_, j) => j !== i))}
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {competitors.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setCompetitors((xs) => [...xs, ""])}
                    className="button-ghost"
                  >
                    <Plus className="h-4 w-4" /> Dodaj konkurenta
                  </button>
                )}
              </div>
            </Field>
            <div className="rounded-lg bg-zinc-50 p-4 text-xs text-zinc-600">
              <strong className="text-zinc-700">Skąd pobieramy?</strong> Trustpilot, Opineo,
              App Store (iTunes RSS). Część serwisów może blokować scraping — w takim wypadku
              użyj trybu wklejania.
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Field label="Nazwa firmy / etykieta zestawu" required>
              <input
                className="input"
                placeholder="np. InPost — luty 2026"
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
              />
            </Field>
            <Field label="Recenzje (JSON / CSV / linia per recenzja)">
              <textarea
                className="input min-h-[260px] font-mono text-[13px]"
                placeholder='[{"content":"świetna obsługa","rating":5}]&#10;albo&#10;content,rating&#10;"świetna obsługa",5'
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  Rozpoznano:{" "}
                  <strong className="tabular-nums text-zinc-800">{previewCount}</strong>{" "}
                  recenzji
                </span>
                <button
                  type="button"
                  className="text-zinc-700 hover:underline"
                  onClick={() => setPasted(SAMPLE_PASTE)}
                >
                  Pobierz przykład
                </button>
              </div>
            </Field>
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            disabled={!canSubmit}
            onClick={submit}
            className="button-primary h-10 px-5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uruchamiam…
              </>
            ) : (
              <>
                Uruchom analizę <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border-b-2 px-6 py-3 text-sm font-medium transition",
        active
          ? "border-zinc-900 text-zinc-900"
          : "border-transparent text-zinc-500 hover:text-zinc-700",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-bad">*</span>}
      </span>
      {children}
    </label>
  );
}

// ---- input parsing ---------------------------------------------------------

function detectReviewCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter((r) => r?.content?.trim()).length;
    } catch {
      return 0;
    }
  }
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  // CSV: header + rows
  if (lines[0]?.includes(",") && /content|review|opinia|tekst/i.test(lines[0]!)) {
    return Math.max(0, lines.length - 1);
  }
  return lines.length;
}

function parsePasted(text: string): { content: string; rating?: number }[] {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t);
      return (Array.isArray(parsed) ? parsed : [parsed])
        .filter((r) => r?.content?.trim())
        .map((r) => ({
          content: String(r.content),
          ...(typeof r.rating === "number" ? { rating: r.rating } : {}),
        }));
    } catch {
      // fall through
    }
  }
  // plaintext with optional [N] prefix/suffix
  return t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const prefix = line.match(/^\[(\d+(?:\.\d+)?)\]\s*(.+)$/);
      const suffix = line.match(/^(.+?)\s*\[(\d+(?:\.\d+)?)\]\s*$/);
      if (prefix) return { content: prefix[2]!, rating: Number(prefix[1]) };
      if (suffix) return { content: suffix[1]!, rating: Number(suffix[2]) };
      return { content: line };
    });
}
