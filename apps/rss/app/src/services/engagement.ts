/**
 * Engagement weights that teach Interesting (and, through affinity, the
 * front page and editions). Pure and testable: no DOM, no network. Factors
 * are deliberately coarse and documented, so a weird ranking is traceable
 * to a number here rather than to a black box.
 *
 * Stars stay the strongest explicit signal (STAR_WORD_WEIGHT 4). A share is
 * two stars: the reader vouches for the story in public. A summary request
 * equals a star: the reader spends model time on this story. Expanded
 * reading accrues slowly with a cap, headline dwell slower with a lower
 * cap, and a sub-three-second open (a bounce) counts slightly against.
 *
 * Server affinity mirrors only the sparse, deliberate actions (share,
 * summarize) through the existing POST /affinity endpoint: every touch
 * decays there, so a stream of dwell ticks would melt into noise. Global
 * Hot stays global on purpose — per-user engagement must not heat
 * everybody's hot list. Personal heat flows through affinity into the
 * front-page and edition signals, and through the word map into Interesting.
 */

export const SHARE_WORD_WEIGHT = 8;
export const SHARE_WORD_CAP = 16;
export const SHARE_AFFINITY = 8;

export const SUMMARY_WORD_WEIGHT = 4;
export const SUMMARY_WORD_CAP = 8;
export const SUMMARY_AFFINITY = 4;

export const ORIGINAL_WORD_WEIGHT = 2;
export const ORIGINAL_WORD_CAP = 4;

export const OPEN_READ_SECONDS_PER_STEP = 30;
export const OPEN_READ_WEIGHT_PER_STEP = 2;
export const OPEN_READ_CAP = 8;
export const BOUNCE_SECONDS = 3;
export const BOUNCE_WEIGHT = -1;

export const DWELL_SECONDS_PER_STEP = 30;
export const DWELL_WEIGHT_PER_STEP = 1;
export const DWELL_CAP = 4;

/**
 * Explicit "not interesting": the anti-star. Same magnitude as a star, so
 * one derank cancels one star on the same words. Local only — a derank
 * names a topic, not a feed, and server affinity only speaks feed, domain
 * and author. Ranking (not hiding) carries it: deranked stories sink.
 */
export const DERANK_WORD_WEIGHT = 4;
export const DERANK_WORD_CAP = 8;

/** Dwell sampling cadence: credit hovered rows this often while input is recent. */
export const DWELL_TICK_MS = 5_000;
/** Flush dwell to the word map every sixth tick (30s). */
export const DWELL_TICKS_PER_FLUSH = 6;
/** Input older than this counts as idle: the reader walked away. */
export const INPUT_IDLE_MS = 30_000;

/** Weight for an expanded (overlay) read of `seconds`. Bounces go negative. */
export function expandedReadWeight(seconds: number): number {
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    if (seconds < BOUNCE_SECONDS) return BOUNCE_WEIGHT;
    return Math.min(OPEN_READ_CAP, OPEN_READ_WEIGHT_PER_STEP * Math.floor(seconds / OPEN_READ_SECONDS_PER_STEP));
}

/** Weight for `seconds` of headline dwell with an active mouse. Never negative. */
export function dwellWeight(seconds: number): number {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.min(DWELL_CAP, DWELL_WEIGHT_PER_STEP * Math.floor(seconds / DWELL_SECONDS_PER_STEP));
}
