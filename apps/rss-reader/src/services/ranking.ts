const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'yclid',
  'igshid',
  'ref',
  'ref_src',
  'mc_cid',
  'mc_eid',
]);

/**
 * Canonicalize a URL so the same story from different feeds maps to the same key.
 * Everything else in ranking is computed locally from this — no external services.
 */
export function normalizeLink(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '');
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.hostname}${path}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Engagement-independent popularity signal, derived locally:
 *   +1 base
 *   +3 per additional subscribed feed carrying the same story (syndication)
 *   +1 per comment reported by the feed (capped)
 */
export function popularityScore(syndicationCount: number, comments: number): number {
  return 1 + 3 * Math.max(0, syndicationCount - 1) + Math.min(Math.max(0, comments), 50);
}

const REDDIT_EPOCH = 1_134_028_003;

/**
 * Reddit-style hot ranking. Uses a fixed anchor epoch so the score of a story is
 * stable between syncs (no periodic recomputation needed): newer stories rank
 * higher, and a 10x popularity edge offsets roughly 12.5 hours of age.
 */
export function hotScore(popularity: number, publishedMs: number): number {
  const p = Math.max(popularity, 1);
  return Math.log10(p) + (publishedMs / 1000 - REDDIT_EPOCH) / 45_000;
}
