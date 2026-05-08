import { AnalysisView } from "./view";

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ live?: string; demo?: string }>;
}) {
  const { id } = await params;
  const { live, demo } = await searchParams;
  return <AnalysisView analysisId={id} live={live === "1"} demo={demo === "1"} />;
}
