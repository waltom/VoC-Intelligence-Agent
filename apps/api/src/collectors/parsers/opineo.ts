import type { CollectedReview } from "../types.js";

/**
 * Streaming Opineo review extractor.
 *
 * Opineo exposes review microdata via schema.org itemprop attributes, which
 * are far more stable than CSS classes. We use those as the primary path:
 *   [itemprop="review"]                  review boundary (nested itemscope)
 *   [itemprop="reviewBody"]              review body text
 *   [itemprop="ratingValue"]             rating (in `content` attr or text)
 *   [itemprop="author"]                  author
 *   [itemprop="datePublished"]           posted_at (in `content` or text)
 */
export async function parseOpineo(html: string): Promise<CollectedReview[]> {
  const reviews: Partial<CollectedReview>[] = [];
  let current: Partial<CollectedReview> | null = null;

  const flush = () => {
    if (current && current.content && current.content.trim().length > 0) {
      reviews.push(current);
    }
    current = null;
  };

  const rewriter = new HTMLRewriter()
    .on('[itemprop="review"]', {
      element(el) {
        flush();
        current = { source: "opineo" };
        el.onEndTag(() => flush());
      },
    })
    .on('[itemprop="reviewBody"]', {
      text(t) {
        if (!current) return;
        current.content = (current.content ?? "") + t.text;
      },
    })
    .on('[itemprop="author"]', {
      text(t) {
        if (!current) return;
        current.author = (current.author ?? "") + t.text;
      },
    })
    .on('[itemprop="ratingValue"]', {
      element(el) {
        if (!current) return;
        const c = el.getAttribute("content");
        if (c) {
          const n = Number.parseFloat(c);
          if (Number.isFinite(n)) current.rating = n;
        }
      },
      text(t) {
        if (!current || current.rating !== undefined) return;
        const n = Number.parseFloat(t.text.trim());
        if (Number.isFinite(n)) current.rating = n;
      },
    })
    .on('[itemprop="datePublished"]', {
      element(el) {
        if (!current || current.postedAt) return;
        const c = el.getAttribute("content") ?? el.getAttribute("datetime");
        if (c) current.postedAt = c;
      },
      text(t) {
        if (!current || current.postedAt) return;
        const trimmed = t.text.trim();
        if (trimmed) current.postedAt = trimmed;
      },
    });

  await rewriter.transform(new Response(html, { headers: { "content-type": "text/html" } })).text();
  flush();

  if (reviews.length === 0) {
    console.warn("[parseOpineo] no review microdata matched — markup may have changed");
  }

  return reviews
    .filter((r) => r.content && r.content.trim().length > 0)
    .map((r) => ({
      source: "opineo",
      content: r.content!.trim(),
      ...(r.author?.trim() ? { author: r.author.trim() } : {}),
      ...(r.rating !== undefined ? { rating: r.rating } : {}),
      ...(r.postedAt ? { postedAt: r.postedAt } : {}),
    }));
}
