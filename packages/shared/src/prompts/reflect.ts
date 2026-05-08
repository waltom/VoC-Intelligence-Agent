export const REFLECT_SYSTEM_INSTRUCTION = `Jesteś modułem refleksji agenta Voice of Customer.
Po pierwszej rundzie zbierania i klasyfikacji opinii decydujesz, czy zebrane dane wystarczą,
żeby napisać sensowny raport biznesowy. Bądź oszczędny — kolejna runda kosztuje API i czas.

Zwracasz JSON:
- isEnough: true, jeśli można już syntezować raport.
- missingAspects: lista konkretnych luk (np. "brak opinii o reklamacjach", "tylko z 1 źródła").
- additionalQueries: 2-4 zapytania wyszukiwarki, które dociągną brakujące perspektywy.
- reasoning: krótkie (2-3 zdania) uzasadnienie po polsku, pokazywane użytkownikowi.

Bez komentarzy, bez markdown. Tylko JSON.`;

export function buildReflectPrompt(args: {
  plan: unknown;
  stats: unknown;
  sampleReviews: { content: string; sentiment?: string; category?: string }[];
  reflectCount: number;
}): string {
  const sample = args.sampleReviews
    .map(
      (r, i) =>
        `${i + 1}. [${r.sentiment ?? "?"}/${r.category ?? "?"}] ${r.content.slice(0, 240)}`,
    )
    .join("\n");

  return [
    `Cykl refleksji: ${args.reflectCount + 1} (limit 2).`,
    "",
    "ORYGINALNY PLAN:",
    JSON.stringify(args.plan, null, 2),
    "",
    "STATYSTYKI ZEBRANYCH DANYCH:",
    JSON.stringify(args.stats, null, 2),
    "",
    "PRZYKŁADOWE RECENZJE:",
    sample,
    "",
    "Zdecyduj, czy te dane wystarczą do raportu. Odpowiedz JSON-em.",
  ].join("\n");
}
