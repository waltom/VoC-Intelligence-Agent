"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Dashboard } from "@/components/dashboard";
import { DemoBanner, ErrorBanner, FreeQuotaBanner } from "@/components/banners";
import { LiveProgress } from "@/components/live-progress";
import { ApiError, api, loadDemoAnalysis, type AnalysisDetail } from "@/lib/api";

export function AnalysisView({
  analysisId,
  live,
  demo,
}: {
  analysisId: string;
  live: boolean;
  demo: boolean;
}) {
  const qc = useQueryClient();
  const [showProgress, setShowProgress] = useState(live);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(demo);

  const { data, isLoading, error } = useQuery<{ analysis: AnalysisDetail }>({
    queryKey: ["analysis", analysisId, demoMode],
    queryFn: async () => {
      if (demoMode) return { analysis: await loadDemoAnalysis() };
      try {
        return await api.get(analysisId);
      } catch (e) {
        if (e instanceof ApiError && e.status === 503) {
          const body = e.body as { error?: string } | null;
          if (body?.error) setQuotaMsg(body.error);
        }
        // If API is unreachable entirely, fall back to demo so the user still sees something.
        if (!(e instanceof ApiError)) {
          setDemoMode(true);
          return { analysis: await loadDemoAnalysis() };
        }
        throw e;
      }
    },
    enabled: !showProgress, // wait for live progress to finish before fetching
    refetchInterval: (q) => {
      const status = q.state.data?.analysis.status;
      return status && status !== "completed" && status !== "failed" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (!showProgress && data?.analysis.status === "queued") {
      // Edge case: opened without live=1 but analysis still running.
      setShowProgress(true);
    }
  }, [showProgress, data?.analysis.status]);

  const onComplete = () => {
    setShowProgress(false);
    qc.invalidateQueries({ queryKey: ["analysis", analysisId] });
  };

  return (
    <>
      {demoMode && <DemoBanner />}
      {quotaMsg && <FreeQuotaBanner message={quotaMsg} />}

      {showProgress ? (
        <div className="container-narrow py-10">
          <p className="label-eyebrow mb-2">W toku</p>
          <h1 className="heading-1">Agent pracuje…</h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Plan, zbieranie, klasyfikacja, refleksja, synteza. Możesz zostawić tę kartę otwartą.
          </p>
          <div className="mt-8">
            <LiveProgress analysisId={analysisId} onComplete={onComplete} />
          </div>
        </div>
      ) : isLoading ? (
        <div className="container-narrow py-12">
          <div className="skeleton h-10 w-48" />
          <div className="mt-4 skeleton h-6 w-72" />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="container-narrow py-10">
          <ErrorBanner message={(error as Error).message} />
        </div>
      ) : data ? (
        <Dashboard analysis={data.analysis} isDemo={demoMode} />
      ) : null}
    </>
  );
}
