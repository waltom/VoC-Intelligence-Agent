"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Quote,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CATEGORY_LABELS, type Category } from "@voc/shared";
import { CategoryBreakdown, CategoryRadar, SentimentTrendChart } from "@/components/charts";
import { CategoryChip, CostHint } from "@/components/badges";
import type { AnalysisDetail } from "@/lib/api";
import { apiUrl } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

interface DashboardProps {
  analysis: AnalysisDetail;
  isDemo?: boolean;
}

export function Dashboard({ analysis, isDemo }: DashboardProps) {
  const summary = analysis.summary;
  if (!summary) {
    return (
      <div className="container-narrow py-16">
        <p className="text-zinc-500">Analiza nie ma jeszcze podsumowania.</p>
      </div>
    );
  }

  const { score, label } = computeScore(summary);
  const totalReviews = analysis.reviewCount ?? 0;
  const avgRating = computeAvgRating(summary);
  const positivePct = computePositivePct(summary);
  const biggestPain = computeBiggestPain(summary);

  return (
    <div className="container-narrow py-10">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label-eyebrow mb-2">VoC Report · {formatDate(analysis.createdAt)}</p>
          <h1 className="heading-1 text-4xl">{analysis.businessName}</h1>
          {analysis.competitors.length > 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              vs. {analysis.competitors.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ScoreGauge score={score} label={label} />
          <ExportMenu analysisId={analysis.id} disabled={isDemo} />
        </div>
      </header>

      {/* KPI cards */}
      <section className="mt-10 grid gap-4 md:grid-cols-4">
        <KpiCard label="Total reviews" value={totalReviews.toLocaleString("pl-PL")} />
        <KpiCard
          label="Avg rating"
          value={avgRating !== null ? avgRating.toFixed(1) : "—"}
          icon={<Star className="h-4 w-4 text-warn" />}
        />
        <KpiCard label="% positive" value={`${Math.round(positivePct * 100)}%`} />
        <KpiCard
          label="Biggest pain"
          value={biggestPain ? CATEGORY_LABELS[biggestPain as Category] ?? biggestPain : "—"}
        />
      </section>

      {/* Executive summary */}
      <section className="card mt-8 p-6">
        <p className="label-eyebrow mb-3">Executive summary</p>
        <p className="text-[16px] leading-relaxed text-zinc-800">
          {summary.executiveSummary}
        </p>
        <div className="mt-4">
          <CostHint tokensUsed={analysis.tokensUsed} costUsd={analysis.costEstimateUsd} />
        </div>
      </section>

      {/* Charts */}
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <p className="label-eyebrow mb-4">Trend sentymentu</p>
          <SentimentTrendChart data={summary.sentimentTrend} />
        </div>
        <div className="card p-6">
          <p className="label-eyebrow mb-4">Sentyment per kategoria</p>
          <CategoryRadar data={summary.categoryBreakdown} />
        </div>
      </section>

      <section className="card mt-6 p-6">
        <p className="label-eyebrow mb-4">Liczność i sentyment per kategoria</p>
        <CategoryBreakdown data={summary.categoryBreakdown} />
      </section>

      {/* Complaints / Praises */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <ThemeCard
          icon={<ThumbsDown className="h-4 w-4 text-bad" />}
          title="Top reklamacje"
          variant="negative"
          items={summary.topComplaints}
        />
        <ThemeCard
          icon={<ThumbsUp className="h-4 w-4 text-good" />}
          title="Top pochwały"
          variant="positive"
          items={summary.topPraises}
        />
      </section>

      {/* Action items */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="heading-2">Action items</h2>
          <p className="text-xs text-zinc-500">
            Posortowane po impact × (6 − effort). Cytaty zwalidowane substring matchem.
          </p>
        </div>
        <div className="space-y-3">
          {sortActionItems(summary.actionItems).map((item, i) => (
            <ActionItemCard key={i} item={item} index={i} />
          ))}
        </div>
      </section>

      {/* Reviews link */}
      <section className="mt-10">
        <Link
          href={`/analyses/${analysis.id}/reviews`}
          className="button-secondary"
          aria-disabled={isDemo}
        >
          Przeglądaj recenzje <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

// ----- KPI card ------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="label-eyebrow">{label}</p>
        {icon}
      </div>
      <p className="stat-value mt-3">{value}</p>
    </div>
  );
}

// ----- Score gauge ---------------------------------------------------------

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  const dash = (score / 100) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f4f4f5" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${dash} 100`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-base font-semibold tabular-nums">
          {Math.round(score)}
        </span>
      </div>
      <div>
        <p className="label-eyebrow">VoC Score</p>
        <p className="text-sm font-medium" style={{ color }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ----- Export menu ---------------------------------------------------------

function ExportMenu({ analysisId, disabled }: { analysisId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="button-secondary"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? "Eksport niedostępny w trybie demo" : undefined}
      >
        <Download className="h-4 w-4" /> Eksportuj <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-elevated">
          <a
            href={apiUrl(`/analyses/${analysisId}/report.html`)}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50"
          >
            HTML <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </a>
          <button
            onClick={() => {
              alert(
                "PDF: otwórz raport HTML i użyj Print → Save as PDF.\nTo daje czystszy efekt niż renderowanie po stronie serwera.",
              );
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
          >
            PDF <span className="text-xs text-zinc-400">(via Print)</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ----- Theme cards ---------------------------------------------------------

function ThemeCard({
  icon,
  title,
  variant,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  variant: "positive" | "negative";
  items: { theme: string; count: number; exampleQuotes: string[] }[];
}) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="heading-2">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Brak danych.</p>
      ) : (
        <ul className="space-y-4">
          {items.slice(0, 5).map((it, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "font-medium",
                    variant === "negative" ? "text-bad" : "text-good",
                  )}
                >
                  {it.theme}
                </p>
                <span className="text-xs tabular-nums text-zinc-500">×{it.count}</span>
              </div>
              {it.exampleQuotes.length > 0 && (
                <blockquote className="mt-1 border-l-2 border-zinc-200 pl-3 text-sm italic text-zinc-600">
                  &ldquo;{it.exampleQuotes[0]}&rdquo;
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----- Action items --------------------------------------------------------

function ActionItemCard({
  item,
  index,
}: {
  item: { title: string; description: string; impact: number; effort: number; evidence: string[] };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`ai-done:${item.title}`) === "1";
  });
  const toggleDone = () => {
    setDone((d) => {
      const next = !d;
      try {
        if (next) localStorage.setItem(`ai-done:${item.title}`, "1");
        else localStorage.removeItem(`ai-done:${item.title}`);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className={cn("card p-5 transition", done && "opacity-60")}>
      <div className="flex items-start gap-4">
        <button
          onClick={toggleDone}
          className={cn(
            "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border transition",
            done
              ? "border-good bg-good text-white"
              : "border-zinc-300 hover:border-zinc-400",
          )}
          aria-label={done ? "Oznacz jako nie zaplanowane" : "Oznacz jako zaplanowane"}
        >
          {done && (
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <path d="M6 11.5L2.5 8l1-1 2.5 2.5 5.5-5.5 1 1z" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <p className="text-xs text-zinc-400">#{index + 1}</p>
          <h4
            className={cn(
              "mt-1 text-base font-semibold tracking-tight text-zinc-900",
              done && "line-through",
            )}
          >
            {item.title}
          </h4>
          <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs font-medium text-zinc-700 hover:underline"
          >
            {expanded ? "Ukryj evidence" : `Dlaczego? (${item.evidence.length} cytatów)`}
          </button>
          {expanded && (
            <ul className="mt-3 space-y-2">
              {item.evidence.map((q, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700"
                >
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="hidden shrink-0 text-right md:block">
          <Dots count={item.impact} label="Impact" color="#16a34a" />
          <Dots count={item.effort} label="Effort" color="#d97706" />
        </div>
      </div>
    </div>
  );
}

function Dots({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="mt-0.5 flex justify-end gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: i < count ? color : "#e4e4e7" }}
          />
        ))}
      </div>
    </div>
  );
}

// ----- helpers -------------------------------------------------------------

function computeScore(summary: NonNullable<AnalysisDetail["summary"]>): {
  score: number;
  label: string;
} {
  // Simple weighted score: positives boost, negatives penalize, scaled to 0-100.
  const counts = summary.categoryBreakdown;
  const totalCount = counts.reduce((a, b) => a + b.count, 0) || 1;
  const weighted = counts.reduce((a, b) => a + b.avgSentiment * b.count, 0) / totalCount;
  const score = Math.round((weighted + 1) * 50);
  const label =
    score >= 70 ? "Lider sentymentu" : score >= 40 ? "W normie" : "Wymaga uwagi";
  return { score, label };
}

function computeAvgRating(_summary: NonNullable<AnalysisDetail["summary"]>): number | null {
  // We don't have a direct avg-rating in summary; return null and let the UI show "—".
  // Wired up as KPI for visual balance — exact value comes from the dashboard fetch in v2.
  return null;
}

function computePositivePct(summary: NonNullable<AnalysisDetail["summary"]>): number {
  const all = summary.categoryBreakdown;
  if (all.length === 0) return 0;
  const positive = all
    .filter((c) => c.avgSentiment > 0.2)
    .reduce((a, b) => a + b.count, 0);
  const total = all.reduce((a, b) => a + b.count, 0) || 1;
  return positive / total;
}

function computeBiggestPain(
  summary: NonNullable<AnalysisDetail["summary"]>,
): string | null {
  const negatives = [...summary.categoryBreakdown]
    .filter((c) => c.avgSentiment < 0)
    .sort((a, b) => a.avgSentiment - b.avgSentiment);
  return negatives[0]?.category ?? null;
}

function sortActionItems<T extends { impact: number; effort: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.impact * (6 - b.effort) - a.impact * (6 - a.effort));
}

// suppress unused
void CategoryChip;
