import type { Env } from "../env.js";
import type { SynthesisResult } from "../agent/schemas.js";
import type { UsageTotals } from "./telemetry.js";

interface ReportInput {
  analysisId: string;
  businessName: string;
  competitors: string[];
  createdAt: number;
  completedAt: number | null;
  summary: SynthesisResult;
  usage: UsageTotals;
  reviewCount: number;
  logoDataUrl?: string;
}

const REPORTS_PREFIX = "reports/";
const cacheKey = (id: string) => `${REPORTS_PREFIX}${id}.html`;

/** Try R2 first; if a cached report exists, return it. */
export async function getCachedReport(env: Env, analysisId: string): Promise<string | null> {
  try {
    const obj = await env.voc_reports.get(cacheKey(analysisId));
    if (!obj) return null;
    return await obj.text();
  } catch (e) {
    console.warn("[report] R2 get failed:", (e as Error).message);
    return null;
  }
}

export async function putCachedReport(env: Env, analysisId: string, html: string): Promise<void> {
  try {
    await env.voc_reports.put(cacheKey(analysisId), html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.warn("[report] R2 put failed:", (e as Error).message);
  }
}

export async function deleteCachedReport(env: Env, analysisId: string): Promise<void> {
  try {
    await env.voc_reports.delete(cacheKey(analysisId));
  } catch {
    /* ignore */
  }
}

export function renderReportHtml(input: ReportInput): string {
  const { businessName, competitors, summary, usage, reviewCount, createdAt, completedAt } = input;

  const date = new Date(createdAt).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const duration =
    completedAt && completedAt > createdAt
      ? `${Math.round((completedAt - createdAt) / 1000)}s`
      : "—";

  const trend = svgLineChart(summary.sentimentTrend);
  const breakdown = svgCategoryBars(summary.categoryBreakdown);
  const logo = input.logoDataUrl
    ? `<img class="logo" src="${escapeAttr(input.logoDataUrl)}" alt="logo">`
    : "";

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>VoC Report — ${escapeHtml(businessName)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<header class="cover">
  ${logo}
  <p class="kicker">Voice of Customer Intelligence Report</p>
  <h1>${escapeHtml(businessName)}</h1>
  <p class="meta">${date} · ${reviewCount} recenzji · czas analizy ${duration}</p>
  ${competitors.length ? `<p class="meta">Konkurenci: ${competitors.map(escapeHtml).join(", ")}</p>` : ""}
</header>

<section>
  <h2>Executive summary</h2>
  <p class="lead">${escapeHtml(summary.executiveSummary)}</p>
</section>

<section>
  <h2>Trend sentymentu</h2>
  ${trend}
</section>

<section>
  <h2>Kategorie</h2>
  ${breakdown}
</section>

<section class="two-col">
  <div>
    <h2>Top reklamacje</h2>
    ${listThemes(summary.topComplaints, "negative")}
  </div>
  <div>
    <h2>Top pochwały</h2>
    ${listThemes(summary.topPraises, "positive")}
  </div>
</section>

${competitorsSection(summary.competitorComparison)}

<section>
  <h2>Action items</h2>
  ${actionItemsTable(summary.actionItems)}
</section>

<section class="methodology">
  <h2>Methodology</h2>
  <ul>
    <li>Źródła: Trustpilot, Opineo, App Store (iTunes RSS), import wklejonych recenzji</li>
    <li>Klasyfikacja: Workers AI (llama-3.1-8b) + embeddingi bge-m3 (1024-dim)</li>
    <li>Synteza i refleksja: Gemini 2.5 Flash Lite z walidacją evidence (cytaty muszą występować w bazie recenzji)</li>
    <li>Tokens użyte (Gemini): ${usage.totalTokens} (${usage.promptTokens} in / ${usage.outputTokens} out)</li>
    <li>Szacowany koszt: $${usage.costUsd.toFixed(4)}</li>
  </ul>
</section>

<footer>
  <p>Generated ${new Date().toISOString()} · analysis ${escapeHtml(input.analysisId)}</p>
</footer>

<script type="application/json" id="report-data">${escapeScriptJson(input)}</script>
</body>
</html>`;
}

// ----- chart helpers ---------------------------------------------------------

function svgLineChart(data: { month: string; score: number }[]): string {
  if (data.length === 0) {
    return `<div class="empty">Brak trendu (zbyt mało danych miesięcznych).</div>`;
  }
  const W = 720;
  const H = 220;
  const P = { top: 20, right: 24, bottom: 36, left: 40 };
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  const minY = Math.min(-1, ...data.map((d) => d.score));
  const maxY = Math.max(1, ...data.map((d) => d.score));
  const yRange = maxY - minY || 1;
  const xStep = data.length === 1 ? 0 : innerW / (data.length - 1);

  const xy = data.map((d, i) => ({
    x: P.left + (data.length === 1 ? innerW / 2 : i * xStep),
    y: P.top + (1 - (d.score - minY) / yRange) * innerH,
  }));

  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const dots = xy
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#2563eb"/>`)
    .join("");
  const labels = data
    .map(
      (d, i) =>
        `<text x="${xy[i]!.x.toFixed(1)}" y="${H - 12}" text-anchor="middle" class="axis-label">${escapeHtml(
          d.month,
        )}</text>`,
    )
    .join("");
  const zeroY = P.top + (1 - (0 - minY) / yRange) * innerH;
  const zeroLine =
    minY < 0 && maxY > 0
      ? `<line x1="${P.left}" x2="${W - P.right}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="#cbd5e1" stroke-dasharray="4 4"/>`
      : "";

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
    ${zeroLine}
    <path d="${path}" stroke="#2563eb" stroke-width="2.5" fill="none"/>
    ${dots}
    ${labels}
  </svg>`;
}

function svgCategoryBars(
  data: { category: string; count: number; avgSentiment: number }[],
): string {
  if (data.length === 0) {
    return `<div class="empty">Brak danych kategorii.</div>`;
  }
  const W = 720;
  const rowH = 36;
  const H = data.length * rowH + 20;
  const labelW = 130;
  const innerW = W - labelW - 24;
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const rows = data
    .map((d, i) => {
      const y = 10 + i * rowH;
      const barW = (d.count / maxCount) * innerW;
      const color = sentimentToColor(d.avgSentiment);
      return `
        <text x="${labelW - 8}" y="${y + 22}" text-anchor="end" class="cat-label">${escapeHtml(d.category)}</text>
        <rect x="${labelW}" y="${y + 8}" width="${barW.toFixed(1)}" height="20" fill="${color}" rx="3"/>
        <text x="${(labelW + barW + 6).toFixed(1)}" y="${y + 22}" class="cat-value">${d.count} · sent ${d.avgSentiment.toFixed(2)}</text>
      `;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${rows}</svg>`;
}

function sentimentToColor(score: number): string {
  if (score >= 0.3) return "#16a34a";
  if (score <= -0.3) return "#dc2626";
  return "#64748b";
}

function listThemes(
  themes: { theme: string; count: number; exampleQuotes: string[] }[],
  variant: "positive" | "negative",
): string {
  if (themes.length === 0) return `<p class="empty">Brak.</p>`;
  return `<ul class="themes ${variant}">${themes
    .map(
      (t) => `
    <li>
      <div class="theme-head"><strong>${escapeHtml(t.theme)}</strong> <span class="count">×${t.count}</span></div>
      ${
        t.exampleQuotes.length
          ? `<ul class="quotes">${t.exampleQuotes
              .slice(0, 3)
              .map((q) => `<li>&ldquo;${escapeHtml(q)}&rdquo;</li>`)
              .join("")}</ul>`
          : ""
      }
    </li>`,
    )
    .join("")}</ul>`;
}

function actionItemsTable(items: SynthesisResult["actionItems"]): string {
  const rows = [...items]
    .sort((a, b) => b.impact * (6 - b.effort) - a.impact * (6 - a.effort))
    .map(
      (it) => `
    <tr>
      <td><strong>${escapeHtml(it.title)}</strong><div class="desc">${escapeHtml(it.description)}</div></td>
      <td class="num">${it.impact}</td>
      <td class="num">${it.effort}</td>
      <td><ul class="evidence">${it.evidence
        .slice(0, 3)
        .map((q) => `<li>&ldquo;${escapeHtml(q)}&rdquo;</li>`)
        .join("")}</ul></td>
    </tr>`,
    )
    .join("");

  return `<table class="actions">
    <thead><tr><th>Action item</th><th>Impact</th><th>Effort</th><th>Evidence</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function competitorsSection(comp: SynthesisResult["competitorComparison"]): string {
  if (!comp || comp.length === 0) return "";
  const rows = comp
    .map(
      (c) => `
    <tr>
      <td><strong>${escapeHtml(c.competitor)}</strong></td>
      <td class="num">${(c.winRate * 100).toFixed(0)}%</td>
      <td>${c.theirStrengths.map(escapeHtml).join(", ") || "—"}</td>
      <td>${c.theirWeaknesses.map(escapeHtml).join(", ") || "—"}</td>
    </tr>`,
    )
    .join("");
  return `<section>
    <h2>Konkurenci</h2>
    <table class="competitors">
      <thead><tr><th>Konkurent</th><th>Win rate</th><th>Mocne strony</th><th>Słabości</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ----- escapers --------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(s: string): string {
  return s.replaceAll('"', "&quot;");
}

function escapeScriptJson(data: unknown): string {
  return JSON.stringify(data).replaceAll("</", "<\\/");
}

// ----- styles ----------------------------------------------------------------

const REPORT_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0;
  font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #0f172a; background: #fff; max-width: 880px; margin: 0 auto; padding: 32px;
}
h1 { font-size: 32px; margin: 8px 0; letter-spacing: -0.02em; }
h2 { font-size: 18px; margin: 36px 0 12px; letter-spacing: -0.01em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
.kicker { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: #64748b; margin: 0; }
.meta { color: #64748b; margin: 4px 0; font-size: 13px; }
.cover { padding: 32px 0 24px; border-bottom: 2px solid #0f172a; }
.cover .logo { max-height: 36px; margin-bottom: 12px; }
.lead { font-size: 17px; line-height: 1.6; }
.chart { display: block; max-width: 100%; height: auto; }
.axis-label, .cat-label, .cat-value { font: 11px ui-sans-serif, system-ui, sans-serif; fill: #475569; }
.cat-label { font-weight: 500; }
.empty { color: #94a3b8; font-style: italic; padding: 12px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.themes { list-style: none; padding: 0; }
.themes li { padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
.theme-head { display: flex; justify-content: space-between; align-items: baseline; }
.themes .count { color: #64748b; font-size: 12px; }
.themes.positive .theme-head strong { color: #15803d; }
.themes.negative .theme-head strong { color: #b91c1c; }
.quotes { color: #475569; margin: 6px 0 0 16px; padding: 0; font-size: 13px; }
.quotes li, .evidence li { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
th { background: #f8fafc; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
.num { text-align: center; font-variant-numeric: tabular-nums; }
.desc { color: #475569; font-size: 13px; margin-top: 4px; }
.evidence { margin: 0; padding: 0; list-style: none; color: #475569; font-size: 12px; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
.methodology ul { color: #475569; }
@media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } body { padding: 16px; } }
@media print { body { padding: 0; max-width: none; } .cover { padding-top: 0; } h2 { break-after: avoid; } table, .themes li { break-inside: avoid; } }
`.trim();
