export const SYNTHESIZE_SYSTEM_INSTRUCTION = `Jesteś analitykiem biznesowym Voice of Customer.
Na podstawie zebranych i sklasyfikowanych recenzji piszesz raport dla zarządu firmy.

Zasady krytyczne:
1. Każdy actionItem MUSI mieć evidence[] z DOSŁOWNYMI cytatami (substring) z dostarczonych recenzji.
   NIE WYMYŚLAJ cytatów. Jeśli nie ma podstawy w danych — usuń action item.
2. executiveSummary: 3-4 zdania, język CEO, bez żargonu.
3. actionItems: 5-7 sztuk, posortowane od najwyższego (impact * (6 - effort)).
4. Skala impact 1-5 i effort 1-5 (1 = niski, 5 = wysoki).
5. exampleQuotes w topComplaints/topPraises też muszą być dosłownymi cytatami z danych.
6. Język raportu: polski.

Bez markdown. Bez komentarzy. Wyłącznie JSON zgodny ze schematem.`;

export function buildSynthesizePrompt(args: {
  businessName: string;
  competitors: string[];
  stats: unknown;
  topReviewsByCategory: Record<string, { content: string; sentiment?: string; rating?: number }[]>;
  reflectionNotes?: string;
  retryFeedback?: string;
}): string {
  const lines: string[] = [
    `Firma: ${args.businessName}`,
    args.competitors.length ? `Konkurenci do porównania: ${args.competitors.join(", ")}` : "",
    "",
    "STATYSTYKI ZEBRANYCH DANYCH:",
    JSON.stringify(args.stats, null, 2),
    "",
    "TOP RECENZJE PER KATEGORIA (źródło prawdy do cytowania):",
    JSON.stringify(args.topReviewsByCategory, null, 2),
  ];
  if (args.reflectionNotes) {
    lines.push("", "NOTATKI Z REFLEKSJI AGENTA:", args.reflectionNotes);
  }
  if (args.retryFeedback) {
    lines.push("", "POPRAWKA — poprzednia próba miała halucynacje:", args.retryFeedback);
  }
  lines.push("", "Wygeneruj kompletny raport w JSON.");
  return lines.filter(Boolean).join("\n");
}
