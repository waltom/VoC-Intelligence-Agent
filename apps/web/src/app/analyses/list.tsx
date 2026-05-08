"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DemoBanner, ErrorBanner } from "@/components/banners";
import { api, type AnalysisListItem } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

export function AnalysesList({ demo }: { demo: boolean }) {
  const router = useRouter();

  // Demo mode redirects directly to the demo analysis page.
  useEffect(() => {
    if (demo) router.replace("/analyses/demo-inpost?demo=1");
  }, [demo, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analyses-list"],
    queryFn: () => api.list(),
    enabled: !demo,
  });

  return (
    <>
      {demo && <DemoBanner />}
      <div className="container-narrow py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="label-eyebrow mb-2">Twoje analizy</p>
            <h1 className="heading-1">Lista</h1>
          </div>
          <Link href="/analyses/new" className="button-primary h-10 px-4">
            <Plus className="h-4 w-4" /> Nowa analiza
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : error ? (
          <ErrorBanner message={(error as Error).message} />
        ) : !data || data.items.length === 0 ? (
          <Empty />
        ) : (
          <ul className="card divide-y divide-zinc-100 overflow-hidden">
            {data.items.map((it) => (
              <Row key={it.id} item={it} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Row({ item }: { item: AnalysisListItem }) {
  return (
    <li>
      <Link
        href={`/analyses/${item.id}`}
        className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50"
      >
        <div>
          <p className="font-medium text-zinc-900">{item.businessName}</p>
          <p className="text-xs text-zinc-500">
            {item.sourceMode === "manual_paste" ? "Wklejone" : "Auto"} ·{" "}
            {formatRelative(item.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={item.status} />
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        </div>
      </Link>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    completed: "bg-good-muted text-good",
    failed: "bg-bad-muted text-bad",
    queued: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
        tones[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {status}
    </span>
  );
}

function Empty() {
  return (
    <div className="card p-10 text-center">
      <p className="text-sm text-zinc-500">Nie masz jeszcze żadnej analizy.</p>
      <Link href="/analyses/new" className="button-primary mt-4 inline-flex h-10 px-4">
        Stwórz pierwszą
      </Link>
    </div>
  );
}
