import type { Category, Sentiment } from "./types.js";

export const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: "#16a34a",
  neutral: "#64748b",
  negative: "#dc2626",
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Pozytywny",
  neutral: "Neutralny",
  negative: "Negatywny",
};

export const CATEGORY_COLORS: Record<Category, { bg: string; fg: string; accent: string }> = {
  price:         { bg: "#fef3c7", fg: "#92400e", accent: "#f59e0b" },
  service:       { bg: "#dbeafe", fg: "#1e40af", accent: "#3b82f6" },
  quality:       { bg: "#f3e8ff", fg: "#6b21a8", accent: "#a855f7" },
  delivery:      { bg: "#ccfbf1", fg: "#115e59", accent: "#14b8a6" },
  ux:            { bg: "#fae8ff", fg: "#86198f", accent: "#d946ef" },
  communication: { bg: "#fee2e2", fg: "#991b1b", accent: "#ef4444" },
  other:         { bg: "#e2e8f0", fg: "#334155", accent: "#64748b" },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  price: "Cena",
  service: "Obsługa",
  quality: "Jakość",
  delivery: "Dostawa",
  ux: "UX",
  communication: "Komunikacja",
  other: "Inne",
};
