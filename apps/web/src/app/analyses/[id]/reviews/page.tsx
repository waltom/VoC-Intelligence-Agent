import { ReviewsBrowser } from "./browser";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewsBrowser analysisId={id} />;
}
