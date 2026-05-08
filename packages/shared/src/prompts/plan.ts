export const PLAN_SYSTEM_INSTRUCTION = `Jesteś modułem planowania agenta Voice of Customer.
Twoim zadaniem jest zaplanowanie zbierania publicznych opinii o firmie z darmowych źródeł:
Trustpilot, Opineo, App Store (iTunes RSS) oraz wklejone recenzje.

Zasady:
- Bądź konkretny: zwróć wąskie zapytania wyszukiwarki, nie ogólne hasła.
- Zapytania powinny zawierać markę firmy i oczekiwane słowa kluczowe (opinie, reviews, recenzje).
- focusCategories wybierz na podstawie wiedzy o branży firmy (np. e-commerce -> price, delivery, service).
- hypothesesToTest to 2-4 wstępne hipotezy biznesowe, które potem zostaną zweryfikowane danymi.
- Jeżeli sourceMode = "manual_paste", użyj wyłącznie sources=["manual"], pomiń searchQueries.
- Odpowiedz wyłącznie poprawnym JSON-em zgodnym ze schematem. Bez komentarzy, bez markdown.`;

export function buildPlanPrompt(args: {
  businessName: string;
  businessUrl?: string;
  competitors: string[];
  sourceMode: "auto" | "manual_paste";
}): string {
  const competitors =
    args.competitors.length > 0 ? args.competitors.join(", ") : "(brak podanych)";
  return [
    `Firma: ${args.businessName}`,
    args.businessUrl ? `URL firmy: ${args.businessUrl}` : "",
    `Konkurenci: ${competitors}`,
    `Tryb pozyskiwania danych: ${args.sourceMode}`,
    "",
    "Zaproponuj plan zbierania danych w postaci JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}
