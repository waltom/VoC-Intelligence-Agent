import type { PastedReview } from "@voc/shared";
import { parseCsv } from "../lib/csv.js";
import type { CollectedReview } from "./types.js";

const CONTENT_HEADERS = ["content", "review", "opinion", "tekst", "opinia", "treść", "tresc"];
const RATING_HEADERS = ["rating", "ocena", "score", "stars", "gwiazdki"];
const AUTHOR_HEADERS = ["author", "autor", "name", "imię", "imie", "user"];
const DATE_HEADERS = ["date", "data", "posted_at", "postedat", "datepublished"];
const SOURCE_HEADERS = ["source", "źródło", "zrodlo"];

function pickIndex(header: string[], names: readonly string[]): number {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

function fromObject(o: PastedReview): CollectedReview {
  return {
    source: o.source ?? "manual",
    content: o.content,
    ...(o.rating !== undefined && Number.isFinite(o.rating) ? { rating: o.rating } : {}),
    ...(o.author ? { author: o.author } : {}),
    ...(o.postedAt ? { postedAt: o.postedAt } : {}),
  };
}

function parseCsvReviews(text: string): CollectedReview[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());

  const ci = pickIndex(header, CONTENT_HEADERS);
  const ri = pickIndex(header, RATING_HEADERS);
  const ai = pickIndex(header, AUTHOR_HEADERS);
  const di = pickIndex(header, DATE_HEADERS);
  const si = pickIndex(header, SOURCE_HEADERS);

  const out: CollectedReview[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const content = (ci >= 0 ? row[ci] : row[0]) ?? "";
    if (!content.trim()) continue;
    const rating = ri >= 0 && row[ri] ? Number.parseFloat(row[ri]!) : NaN;
    out.push({
      source: si >= 0 && row[si] ? row[si]!.trim() : "manual",
      content: content.trim(),
      ...(Number.isFinite(rating) ? { rating } : {}),
      ...(ai >= 0 && row[ai]?.trim() ? { author: row[ai]!.trim() } : {}),
      ...(di >= 0 && row[di]?.trim() ? { postedAt: row[di]!.trim() } : {}),
    });
  }
  return out;
}

function parsePlaintextReviews(text: string): CollectedReview[] {
  const out: CollectedReview[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let content = line;
    let rating: number | undefined;

    const prefix = line.match(/^\[(\d+(?:\.\d+)?)\]\s*(.+)$/);
    const suffix = line.match(/^(.+?)\s*\[(\d+(?:\.\d+)?)\]\s*$/);
    if (prefix) {
      rating = Number.parseFloat(prefix[1]!);
      content = prefix[2]!;
    } else if (suffix) {
      content = suffix[1]!;
      rating = Number.parseFloat(suffix[2]!);
    }

    out.push({
      source: "manual",
      content,
      ...(rating !== undefined && Number.isFinite(rating) ? { rating } : {}),
    });
  }
  return out;
}

function looksLikeCsv(text: string): boolean {
  const firstLine = text.split("\n", 1)[0] ?? "";
  if (!firstLine.includes(",")) return false;
  const lower = firstLine.toLowerCase();
  return CONTENT_HEADERS.some((h) => lower.includes(h)) ||
    RATING_HEADERS.some((h) => lower.includes(h));
}

/**
 * Accepts:
 *   - PastedReview[]                  (already structured)
 *   - JSON string (object or array)
 *   - CSV string with a header row
 *   - plain text (one review per line, optional [N] rating prefix or suffix)
 */
export function normalizePastedReviews(
  input: PastedReview[] | string | undefined | null,
): CollectedReview[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.filter((o) => o?.content?.trim()).map(fromObject);
  }

  const text = String(input).trim();
  if (!text) return [];

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as PastedReview | PastedReview[];
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter((o) => o?.content?.trim()).map(fromObject);
    } catch {
      // fall through to CSV/plaintext
    }
  }

  if (looksLikeCsv(text)) return parseCsvReviews(text);
  return parsePlaintextReviews(text);
}
