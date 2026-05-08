import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  type Category,
  type Sentiment,
} from "@voc/shared";
import { cn } from "@/lib/utils";

export function SentimentBadge({
  sentiment,
  className,
}: {
  sentiment: Sentiment | string | null | undefined;
  className?: string;
}) {
  const s = (sentiment ?? "neutral") as Sentiment;
  const color = SENTIMENT_COLORS[s] ?? SENTIMENT_COLORS.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ borderColor: `${color}40`, color, backgroundColor: `${color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {SENTIMENT_LABELS[s] ?? s}
    </span>
  );
}

export function CategoryChip({
  category,
  className,
}: {
  category: Category | string | null | undefined;
  className?: string;
}) {
  const c = (category ?? "other") as Category;
  const colors = CATEGORY_COLORS[c] ?? CATEGORY_COLORS.other;
  const label = CATEGORY_LABELS[c] ?? c;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ background: colors.bg, color: colors.fg }}
    >
      {label}
    </span>
  );
}

export function CostHint({
  tokensUsed,
  costUsd,
}: {
  tokensUsed?: number;
  costUsd?: number;
}) {
  if (tokensUsed === undefined && costUsd === undefined) return null;
  return (
    <p className="text-xs text-zinc-500">
      {tokensUsed !== undefined && (
        <span className="tabular-nums">{tokensUsed.toLocaleString("pl-PL")} tokens</span>
      )}
      {tokensUsed !== undefined && costUsd !== undefined && <span> · </span>}
      {costUsd !== undefined && (
        <span className="tabular-nums">${costUsd.toFixed(4)}</span>
      )}
    </p>
  );
}
