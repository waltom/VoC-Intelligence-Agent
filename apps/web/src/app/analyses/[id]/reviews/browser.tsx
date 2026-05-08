"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, Search, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CATEGORIES, SENTIMENTS } from "@voc/shared";
import { CategoryChip, SentimentBadge } from "@/components/badges";
import { ErrorBanner } from "@/components/banners";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

const PAGE = 50;

export function ReviewsBrowser({ analysisId }: { analysisId: string }) {
  const [sentiment, setSentiment] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reviews", analysisId, sentiment, category, q, offset],
    queryFn: () =>
      api.reviews(analysisId, {
        sentiment: sentiment || undefined,
        category: category || undefined,
        q: q || undefined,
        limit: PAGE,
        offset,
      }),
  });

  return (
    <div className="container-narrow py-10">
      <Link href={`/analyses/${analysisId}`} className="button-ghost mb-4">
        <ChevronLeft className="h-4 w-4" /> Wróć do dashboardu
      </Link>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="label-eyebrow mb-2">Recenzje</p>
          <h1 className="heading-1">Przeglądarka</h1>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            className="input pl-9"
            placeholder="Szukaj w treści…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
        </div>
        <FilterSelect
          value={sentiment}
          onChange={(v) => {
            setSentiment(v);
            setOffset(0);
          }}
          options={[
            { value: "", label: "Sentiment: wszystkie" },
            ...SENTIMENTS.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          value={category}
          onChange={(v) => {
            setCategory(v);
            setOffset(0);
          }}
          options={[
            { value: "", label: "Kategoria: wszystkie" },
            ...CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorBanner message={(error as Error).message} />
      ) : !data || data.items.length === 0 ? (
        <p className="card p-10 text-center text-sm text-zinc-500">
          Brak recenzji pasujących do filtrów.
        </p>
      ) : (
        <>
          <div className="card divide-y divide-zinc-100 overflow-hidden">
            {data.items.map((r) => {
              const open = openId === r.id;
              return (
                <div key={r.id}>
                  <button
                    onClick={() => setOpenId(open ? null : r.id)}
                    className="flex w-full items-start gap-4 px-5 py-3 text-left hover:bg-zinc-50"
                  >
                    <div className="flex w-20 shrink-0 items-center gap-1 text-sm text-zinc-700">
                      {typeof r.rating === "number" ? (
                        <>
                          <Star className="h-3.5 w-3.5 fill-warn text-warn" />
                          <span className="tabular-nums">{r.rating.toFixed(1)}</span>
                        </>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-sm text-zinc-800", !open && "line-clamp-2")}>
                        {r.content}
                      </p>
                      {open && (r.author || r.posted_at) && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {r.author && <span>{r.author}</span>}
                          {r.author && r.posted_at && <span> · </span>}
                          {r.posted_at && <span>{formatDate(r.posted_at)}</span>}
                          {r.source_url && (
                            <a
                              href={r.source_url}
                              target="_blank"
                              rel="noopener"
                              className="ml-2 inline-flex items-center gap-0.5 text-zinc-700 hover:underline"
                            >
                              oryginał <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex w-44 shrink-0 flex-wrap justify-end gap-1">
                      <SentimentBadge sentiment={r.sentiment} />
                      <CategoryChip category={r.category} />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
            <p>
              {offset + 1}–{Math.min(offset + PAGE, data.total)} z{" "}
              <span className="tabular-nums">{data.total}</span>
            </p>
            <div className="flex gap-2">
              <button
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
                className="button-secondary"
              >
                Poprzednia
              </button>
              <button
                disabled={offset + PAGE >= data.total}
                onClick={() => setOffset((o) => o + PAGE)}
                className="button-secondary"
              >
                Następna
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input w-auto cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
