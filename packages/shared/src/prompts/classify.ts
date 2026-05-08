export const CLASSIFY_SYSTEM_INSTRUCTION = `Jesteś klasyfikatorem opinii klientów. Dla każdej recenzji
zwróć JSON-ową tablicę obiektów {sentiment, category}, w tej samej kolejności co recenzje wejściowe.
Sentiment: "positive" | "neutral" | "negative".
Category: "price" | "service" | "quality" | "delivery" | "ux" | "communication" | "other".
Nie dodawaj komentarzy ani markdown. Zwróć wyłącznie JSON.`;

export function buildClassifyBatchPrompt(reviewContents: string[]): string {
  const list = reviewContents
    .map((c, i) => `${i + 1}. ${c.replaceAll("\n", " ").slice(0, 800)}`)
    .join("\n");
  return [
    "Zaklasyfikuj każdą z poniższych recenzji.",
    "",
    list,
    "",
    'Zwróć tablicę JSON typu [{"sentiment":"...","category":"..."}].',
  ].join("\n");
}

// Lighter prompt used for the Workers AI llama-3.1 classifier.
// We constrain output extra hard because the model sometimes adds prose.
export const WORKERS_AI_CLASSIFY_SYSTEM = `You are a strict JSON-only classifier of e-commerce reviews.
Output one JSON array, nothing else. Schema:
[{"sentiment": "positive"|"neutral"|"negative", "category": "price"|"service"|"quality"|"delivery"|"ux"|"communication"|"other"}, ...]
The array must have exactly the same length as the input list, in the same order.`;
