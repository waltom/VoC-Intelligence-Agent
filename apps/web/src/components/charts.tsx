"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from "@voc/shared";
import type { SynthesisSummary } from "@/lib/api";

const TICK = { fill: "#71717a", fontSize: 11 };

// ----- Sentiment trend -----------------------------------------------------

export function SentimentTrendChart({ data }: { data: SynthesisSummary["sentimentTrend"] }) {
  if (data.length < 2) {
    return (
      <div className="grid h-[260px] place-items-center rounded-lg bg-zinc-50 text-sm text-zinc-400">
        Za mało danych miesięcznych, żeby narysować trend.
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f4f4f5" vertical={false} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis
            domain={[-1, 1]}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e4e4e7",
              borderRadius: 8,
              fontSize: 12,
              background: "white",
            }}
            formatter={(v: number) => v.toFixed(2)}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#2563eb"
            strokeWidth={2.5}
            fill="url(#trendFill)"
            dot={{ r: 3, fill: "#2563eb" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ----- Category radar ------------------------------------------------------

export function CategoryRadar({
  data,
  competitorData,
  competitorName,
}: {
  data: SynthesisSummary["categoryBreakdown"];
  competitorData?: SynthesisSummary["categoryBreakdown"];
  competitorName?: string;
}) {
  const radar = data.map((d) => ({
    category: CATEGORY_LABELS[d.category as Category] ?? d.category,
    own: Math.max(0, (d.avgSentiment + 1) * 50), // map [-1,1] -> [0,100]
    ...(competitorData
      ? {
          competitor:
            (competitorData.find((c) => c.category === d.category)?.avgSentiment ?? 0 + 1) * 50,
        }
      : {}),
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <RadarChart data={radar} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <PolarGrid stroke="#e4e4e7" />
          <PolarAngleAxis dataKey="category" tick={TICK} />
          <Radar dataKey="own" stroke="#2563eb" fill="#2563eb" fillOpacity={0.25} />
          {competitorData && (
            <Radar
              dataKey="competitor"
              stroke="#a855f7"
              fill="#a855f7"
              fillOpacity={0.15}
              name={competitorName}
            />
          )}
          {competitorData && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ----- Category breakdown (horizontal bars) -------------------------------

export function CategoryBreakdown({ data }: { data: SynthesisSummary["categoryBreakdown"] }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <div className="space-y-2">
      {sorted.map((c) => {
        const colors = CATEGORY_COLORS[c.category as Category] ?? CATEGORY_COLORS.other;
        const max = Math.max(...sorted.map((x) => x.count), 1);
        const widthPct = (c.count / max) * 100;
        const sentimentColor =
          c.avgSentiment > 0.2
            ? "#16a34a"
            : c.avgSentiment < -0.2
              ? "#dc2626"
              : "#71717a";
        return (
          <div key={c.category} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
            <span className="text-sm font-medium text-zinc-700">
              {CATEGORY_LABELS[c.category as Category] ?? c.category}
            </span>
            <div className="relative h-7 overflow-hidden rounded-md bg-zinc-100">
              <div
                className="h-full rounded-md transition-all"
                style={{ width: `${widthPct}%`, background: colors.accent }}
              />
            </div>
            <span className="flex items-center gap-2 text-xs tabular-nums">
              <span className="text-zinc-700">{c.count}</span>
              <span style={{ color: sentimentColor }}>
                {c.avgSentiment >= 0 ? "+" : ""}
                {c.avgSentiment.toFixed(2)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// fix unused var warning when only one chart imported elsewhere
void BarChart;
