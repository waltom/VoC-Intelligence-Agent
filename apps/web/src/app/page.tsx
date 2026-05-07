export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">VoC Intelligence Agent</h1>
      <p className="mt-4 text-sm text-neutral-500">
        Skeleton — UI is implemented in a later phase.
      </p>
      <div className="mt-8 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        API health check:{" "}
        <code className="rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-900">
          GET http://localhost:8787/health
        </code>
      </div>
    </main>
  );
}
