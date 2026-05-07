import { describe, expect, it } from "vitest";
import { parseOpineo } from "../src/collectors/parsers/opineo.js";
import { parseTrustpilot } from "../src/collectors/parsers/trustpilot.js";
import opineoHtml from "./fixtures/opineo.html?raw";
import trustpilotHtml from "./fixtures/trustpilot.html?raw";

describe("parseTrustpilot", () => {
  it("extracts reviews with content and rating", async () => {
    const reviews = await parseTrustpilot(trustpilotHtml);
    expect(reviews.length).toBeGreaterThanOrEqual(1);

    const first = reviews[0]!;
    expect(first.source).toBe("trustpilot");
    expect(first.content).toMatch(/obsługa/i);
    expect(first.rating).toBe(5);
    expect(first.author).toBe("Jan Kowalski");
    expect(first.postedAt).toBe("2024-09-12T10:00:00Z");
  });

  it("extracts all three reviews from fixture", async () => {
    const reviews = await parseTrustpilot(trustpilotHtml);
    expect(reviews.length).toBe(3);
    expect(reviews.map((r) => r.rating)).toEqual([5, 2, 4]);
  });

  it("returns [] for HTML without review cards", async () => {
    const empty = await parseTrustpilot("<html><body><p>nothing here</p></body></html>");
    expect(empty).toEqual([]);
  });
});

describe("parseOpineo", () => {
  it("extracts reviews via schema.org microdata", async () => {
    const reviews = await parseOpineo(opineoHtml);
    expect(reviews.length).toBeGreaterThanOrEqual(1);

    const first = reviews[0]!;
    expect(first.source).toBe("opineo");
    expect(first.content).toMatch(/dostawa/i);
    expect(first.rating).toBe(4);
    expect(first.postedAt).toBe("2024-08-15");
  });

  it("extracts all three reviews from fixture", async () => {
    const reviews = await parseOpineo(opineoHtml);
    expect(reviews.length).toBe(3);
    expect(reviews.map((r) => r.rating)).toEqual([4, 5, 2]);
  });

  it("returns [] for HTML without review microdata", async () => {
    const empty = await parseOpineo("<html><body><p>brak opinii</p></body></html>");
    expect(empty).toEqual([]);
  });
});
