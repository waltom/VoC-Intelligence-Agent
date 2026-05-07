const PL_STOPS = new Set([
  "i", "w", "na", "że", "się", "jest", "do", "to", "nie", "z", "a", "o", "po",
  "dla", "ale", "tak", "tylko", "bardzo", "byłem", "byłam", "było", "ten", "ta",
]);

const EN_STOPS = new Set([
  "the", "and", "of", "to", "in", "is", "that", "it", "for", "on", "with",
  "as", "this", "an", "was", "are", "be", "have", "has", "had", "but",
]);

export type Lang = "pl" | "en";

export function detectLanguage(text: string): Lang | undefined {
  if (!text) return undefined;
  const tokens = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (tokens.length === 0) return undefined;

  let pl = 0;
  let en = 0;
  for (const t of tokens) {
    if (PL_STOPS.has(t)) pl++;
    if (EN_STOPS.has(t)) en++;
  }
  if (/[ąćęłńóśźż]/i.test(text)) pl += 3;

  if (pl === 0 && en === 0) return undefined;
  return pl >= en ? "pl" : "en";
}
