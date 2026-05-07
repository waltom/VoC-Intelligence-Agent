import { describe, expect, it } from "vitest";
import { normalizePastedReviews } from "../src/collectors/manual.js";

describe("normalizePastedReviews", () => {
  it("accepts a structured PastedReview array", () => {
    const input = [
      { content: "Świetny produkt", rating: 5, author: "Ola" },
      { content: "Słaba jakość, nie polecam", rating: 1 },
    ];
    const out = normalizePastedReviews(input);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      source: "manual",
      content: "Świetny produkt",
      rating: 5,
      author: "Ola",
    });
    expect(out[1]?.rating).toBe(1);
  });

  it("parses a JSON string array", () => {
    const json = JSON.stringify([
      { content: "Polecam", rating: 4 },
      { content: "Średnio", rating: 3, author: "X" },
    ]);
    const out = normalizePastedReviews(json);
    expect(out).toHaveLength(2);
    expect(out[1]?.author).toBe("X");
  });

  it("parses a single JSON object", () => {
    const out = normalizePastedReviews('{"content":"OK","rating":4}');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ content: "OK", rating: 4, source: "manual" });
  });

  it("parses a CSV with header row", () => {
    const csv =
      "content,rating,author,date\n" +
      '"Bardzo dobre, szybka dostawa",5,"Anna","2024-08-10"\n' +
      '"Coś nie tak z opakowaniem",2,"Piotr","2024-08-12"\n' +
      '"Polecam wszystkim, bez zastrzeżeń",5,"",""\n';
    const out = normalizePastedReviews(csv);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      content: "Bardzo dobre, szybka dostawa",
      rating: 5,
      author: "Anna",
      postedAt: "2024-08-10",
    });
    expect(out[1]?.rating).toBe(2);
    expect(out[2]?.content).toBe("Polecam wszystkim, bez zastrzeżeń");
  });

  it("parses CSV with Polish headers (treść/ocena)", () => {
    const csv = "treść,ocena,autor\nGenialne,5,Janek\nSłabe,1,Kasia\n";
    const out = normalizePastedReviews(csv);
    expect(out).toHaveLength(2);
    expect(out[0]?.rating).toBe(5);
    expect(out[1]?.author).toBe("Kasia");
  });

  it("parses plaintext: one review per line, optional [N] rating", () => {
    const text = [
      "[5] Bardzo zadowolony, polecam.",
      "Słaba jakość obsługi [2]",
      "Kurier zostawił paczkę u sąsiada bez pytania.",
      "",
      "  ",
    ].join("\n");
    const out = normalizePastedReviews(text);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      content: "Bardzo zadowolony, polecam.",
      rating: 5,
    });
    expect(out[1]).toMatchObject({
      content: "Słaba jakość obsługi",
      rating: 2,
    });
    expect(out[2]?.rating).toBeUndefined();
  });

  it("returns [] for empty / null / undefined input", () => {
    expect(normalizePastedReviews("")).toEqual([]);
    expect(normalizePastedReviews(null)).toEqual([]);
    expect(normalizePastedReviews(undefined)).toEqual([]);
    expect(normalizePastedReviews([])).toEqual([]);
  });

  it("filters out array entries without content", () => {
    const out = normalizePastedReviews([
      { content: "OK", rating: 4 },
      { content: "", rating: 5 },
      { content: "   ", rating: 1 },
    ]);
    expect(out).toHaveLength(1);
  });
});
