/**
 * Best-effort date normalization. Returns ISO string or undefined.
 * Handles: ISO, "YYYY-MM-DD", "DD.MM.YYYY", "DD/MM/YYYY", "DD-MM-YYYY".
 */
export function parsePostedAt(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = String(input).trim();
  if (!trimmed) return undefined;

  // Try native Date.parse first (covers ISO and many natural formats).
  const native = Date.parse(trimmed);
  if (!Number.isNaN(native)) return new Date(native).toISOString();

  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  return undefined;
}

export function postedAtToEpochMs(input?: string | null): number | null {
  const iso = parsePostedAt(input);
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}
