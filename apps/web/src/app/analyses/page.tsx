import { AnalysesList } from "./list";

export default async function AnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <AnalysesList demo={demo === "1"} />;
}
