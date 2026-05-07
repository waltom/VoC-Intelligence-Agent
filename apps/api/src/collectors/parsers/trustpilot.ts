import type { CollectedReview } from "../types.js";

/**
 * Streaming Trustpilot review extractor.
 *
 * Defensive: if no review cards are found we return [] and warn — never throw.
 * Trustpilot's stable selectors at time of writing:
 *   article[data-service-review-card-paper]   review boundary
 *   [data-service-review-rating]              rating in attribute
 *   [data-service-review-text-typography]     review body text
 *   [data-consumer-name-typography]           author
 *   time[datetime]                            posted_at
 */
export async function parseTrustpilot(html: string): Promise<CollectedReview[]> {
  const reviews: Partial<CollectedReview>[] = [];
  let current: Partial<CollectedReview> | null = null;

  const flush = () => {
    if (current && current.content && current.content.trim().length > 0) {
      reviews.push(current);
    }
    current = null;
  };

  const rewriter = new HTMLRewriter()
    .on("article[data-service-review-card-paper], div[data-service-review-card-paper]", {
      element(el) {
        flush();
        current = { source: "trustpilot" };
        el.onEndTag(() => flush());
      },
    })
    .on("[data-service-review-rating]", {
      element(el) {
        if (!current) return;
        const r = el.getAttribute("data-service-review-rating");
        if (r) {
          const n = Number.parseFloat(r);
          if (Number.isFinite(n)) current.rating = n;
        }
      },
    })
    .on("img[alt^='Rated']", {
      element(el) {
        if (!current || current.rating !== undefined) return;
        const alt = el.getAttribute("alt") ?? "";
        const m = alt.match(/Rated\s+(\d+(?:\.\d+)?)\s+out\s+of\s+\d+/i);
        if (m) current.rating = Number.parseFloat(m[1]!);
      },
    })
    .on("[data-service-review-text-typography], p[data-service-review-content]", {
      text(t) {
        if (!current) return;
        current.content = (current.content ?? "") + t.text;
      },
    })
    .on("[data-consumer-name-typography]", {
      text(t) {
        if (!current) return;
        current.author = (current.author ?? "") + t.text;
      },
    })
    .on("time[datetime]", {
      element(el) {
        if (!current || current.postedAt) return;
        const dt = el.getAttribute("datetime");
        if (dt) current.postedAt = dt;
      },
    });

  await rewriter.transform(new Response(html, { headers: { "content-type": "text/html" } })).text();
  flush();

  if (reviews.length === 0) {
    console.warn("[parseTrustpilot] no review cards matched — markup may have changed");
  }

  return reviews
    .filter((r) => r.content && r.content.trim().length > 0)
    .map((r) => ({
      source: "trustpilot",
      content: r.content!.trim(),
      ...(r.author?.trim() ? { author: r.author.trim() } : {}),
      ...(r.rating !== undefined ? { rating: r.rating } : {}),
      ...(r.postedAt ? { postedAt: r.postedAt } : {}),
    }));
}
