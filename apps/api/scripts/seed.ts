/**
 * Seeds the local D1 database with two demo analyses (InPost, Pyszne.pl).
 * Runs via `pnpm seed` (which calls `tsx scripts/seed.ts` per package.json).
 *
 * The seed script generates a SQL file and pipes it through `wrangler d1 execute`
 * so we don't need to bundle a D1 client into Node.
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface SeedAnalysis {
  id: string;
  businessName: string;
  competitors: string[];
  reviews: { content: string; rating: number; sentiment: string; category: string }[];
  summary: unknown;
}

const ANALYSES: SeedAnalysis[] = [
  {
    id: randomUUID(),
    businessName: "InPost",
    competitors: ["DPD", "DHL"],
    reviews: [
      { content: "Paczkomat zepsuty drugi raz w tym tygodniu.", rating: 1, sentiment: "negative", category: "delivery" },
      { content: "Polecam — zawsze na czas, kurier miły.", rating: 5, sentiment: "positive", category: "service" },
      { content: "Aplikacja mobilna ciągle się wylogowuje.", rating: 2, sentiment: "negative", category: "ux" },
      { content: "Wygodne, że paczkomat 24/7. Świetne rozwiązanie.", rating: 5, sentiment: "positive", category: "delivery" },
      { content: "Reklamacja idzie 3 tygodnie i nikt się nie odzywa.", rating: 1, sentiment: "negative", category: "service" },
    ],
    summary: {
      executiveSummary:
        "InPost utrzymuje silną pozycję dzięki dostępności paczkomatów 24/7. Kluczowe ryzyka: jakość obsługi reklamacji i niezawodność urządzeń.",
      sentimentTrend: [
        { month: "2025-02", score: 0.18 },
        { month: "2025-03", score: 0.05 },
        { month: "2025-04", score: 0.22 },
      ],
      categoryBreakdown: [
        { category: "delivery", count: 2, avgSentiment: 0.0 },
        { category: "service", count: 2, avgSentiment: -0.5 },
        { category: "ux", count: 1, avgSentiment: -0.5 },
      ],
      topComplaints: [
        { theme: "Długi czas reklamacji", count: 1, exampleQuotes: ["Reklamacja idzie 3 tygodnie i nikt się nie odzywa."] },
      ],
      topPraises: [
        { theme: "Dostępność 24/7", count: 1, exampleQuotes: ["Wygodne, że paczkomat 24/7. Świetne rozwiązanie."] },
      ],
      actionItems: [
        {
          title: "Skróć SLA reklamacji",
          description: "Twardy SLA 7 dni z eskalacją po 3.",
          impact: 5,
          effort: 3,
          evidence: ["Reklamacja idzie 3 tygodnie i nikt się nie odzywa."],
        },
      ],
    },
  },
  {
    id: randomUUID(),
    businessName: "Pyszne.pl",
    competitors: ["Glovo", "Uber Eats"],
    reviews: [
      { content: "Jedzenie wystygło, kurier się gubił 40 minut.", rating: 2, sentiment: "negative", category: "delivery" },
      { content: "Łatwe zamawianie, przejrzysta apka.", rating: 5, sentiment: "positive", category: "ux" },
      { content: "Drogo, opłata serwisowa to przesada.", rating: 2, sentiment: "negative", category: "price" },
      { content: "Promocje są spoko, często coś znajdę w okazji.", rating: 4, sentiment: "positive", category: "price" },
    ],
    summary: {
      executiveSummary:
        "Pyszne.pl ma mocny UX aplikacji, ale narastają sygnały o cenie i jakości dostawy. Inwestycja w kontrolę opłat dodatkowych zatrzyma odpływ klientów.",
      sentimentTrend: [
        { month: "2025-03", score: -0.1 },
        { month: "2025-04", score: 0.05 },
      ],
      categoryBreakdown: [
        { category: "delivery", count: 1, avgSentiment: -0.7 },
        { category: "ux", count: 1, avgSentiment: 0.7 },
        { category: "price", count: 2, avgSentiment: 0.0 },
      ],
      topComplaints: [
        { theme: "Opłaty dodatkowe", count: 1, exampleQuotes: ["Drogo, opłata serwisowa to przesada."] },
      ],
      topPraises: [{ theme: "UX aplikacji", count: 1, exampleQuotes: ["Łatwe zamawianie, przejrzysta apka."] }],
      actionItems: [
        {
          title: "Transparentność opłaty serwisowej",
          description: "Pokaż rozbicie opłat przed potwierdzeniem.",
          impact: 4,
          effort: 2,
          evidence: ["Drogo, opłata serwisowa to przesada."],
        },
      ],
    },
  },
];

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function buildSql(): string {
  const stmts: string[] = [];
  const now = Date.now();

  for (const a of ANALYSES) {
    stmts.push(
      `INSERT OR REPLACE INTO analyses (id, business_name, competitors, status, source_mode, created_at, completed_at, summary_json, tokens_used, cost_estimate_usd) VALUES ('${a.id}', '${sqlEscape(a.businessName)}', '${sqlEscape(JSON.stringify(a.competitors))}', 'completed', 'manual_paste', ${now - 60_000}, ${now - 30_000}, '${sqlEscape(JSON.stringify(a.summary))}', 4500, 0.0023);`,
    );
    for (const r of a.reviews) {
      const rid = randomUUID();
      stmts.push(
        `INSERT OR REPLACE INTO reviews (id, analysis_id, source, content, rating, sentiment, category, language) VALUES ('${rid}', '${a.id}', 'manual', '${sqlEscape(r.content)}', ${r.rating}, '${r.sentiment}', '${r.category}', 'pl');`,
      );
    }
    stmts.push(
      `INSERT OR REPLACE INTO events (id, analysis_id, step, status, message, created_at) VALUES ('${randomUUID()}', '${a.id}', 'report', 'completed', 'seeded', ${now});`,
    );
  }
  return stmts.join("\n");
}

function main() {
  const sql = buildSql();
  const dir = mkdtempSync(join(tmpdir(), "voc-seed-"));
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql, "utf8");

  try {
    console.log(`[seed] inserting ${ANALYSES.length} analyses into local D1…`);
    execSync(`wrangler d1 execute voc_db --local --file "${file}"`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    for (const a of ANALYSES) {
      console.log(`[seed] ✓ ${a.businessName} (${a.id})`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
