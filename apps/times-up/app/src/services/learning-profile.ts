/**
 * Read-only view of everything the Interesting model has learned.
 *
 * Pure and testable: localStorage only, no DOM, no network. The privacy
 * dashboard renders this and the export serializes it, so the screen and the
 * downloaded profile always describe the same state. Article titles are not
 * part of the model; ids are, so a derank can be undone exactly.
 */
import {
    DECAY_INTERVAL_MS,
    loadDecayAt,
    loadDerankedIds,
    loadEngagementTotals,
    loadWordMap,
    type EngagementKind,
} from './interesting-settings';
import { loadSignalToggles, type LearningSignal } from './learning-signals';

export const PROFILE_EXPORT_VERSION = 1;

/** Engagement kinds in dashboard order; `decay` is not per-article. */
export const ENGAGEMENT_KINDS: readonly EngagementKind[] = ['share', 'summary', 'original', 'open', 'dwell', 'derank'];

const ENGAGEMENT_LABELS: Record<EngagementKind, string> = {
    share: 'Shares',
    summary: 'AI summaries',
    original: 'Visits to the original',
    open: 'Time in an article',
    dwell: 'Headline dwell',
    derank: 'Not interesting',
};

export function engagementLabel(kind: EngagementKind): string {
    return ENGAGEMENT_LABELS[kind];
}

export interface LearnedWord {
    word: string;
    weight: number;
}

export interface EngagementRecord {
    articleId: string;
    kind: EngagementKind;
    total: number;
}

export interface LearningProfile {
    /** Strongest words first, by absolute weight then alphabetically. */
    words: LearnedWord[];
    records: EngagementRecord[];
    totalsByKind: Record<EngagementKind, number>;
    recordCountByKind: Record<EngagementKind, number>;
    derankedIds: string[];
    decayAt: number | null;
    decayIntervalMs: number;
    toggles: Record<LearningSignal, boolean>;
}

/** True for one of the per-article kinds, so a corrupt ledger entry is skipped. */
export function isEngagementKind(value: string): value is EngagementKind {
    return (ENGAGEMENT_KINDS as readonly string[]).includes(value);
}

/**
 * Split `${articleId}:${kind}` from the ledger. Article ids are UUIDs and
 * never contain a colon, but the last colon is still the right split point
 * if a future id format does.
 */
export function parseEngagementKey(key: string): { articleId: string; kind: EngagementKind } | null {
    const at = key.lastIndexOf(':');
    if (at <= 0 || at === key.length - 1) return null;
    const kind = key.slice(at + 1);
    if (!isEngagementKind(kind)) return null;
    return { articleId: key.slice(0, at), kind };
}

function zeroByKind(): Record<EngagementKind, number> {
    return { share: 0, summary: 0, original: 0, open: 0, dwell: 0, derank: 0 };
}

/** Current profile, sorted deterministically so exports diff cleanly. */
export function loadLearningProfile(): LearningProfile {
    const wordMap = loadWordMap();
    const words = Object.entries(wordMap)
        .map(([word, weight]) => ({ word, weight }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight) || a.word.localeCompare(b.word));
    const totalsByKind = zeroByKind();
    const recordCountByKind = zeroByKind();
    const records: EngagementRecord[] = [];
    for (const [key, total] of Object.entries(loadEngagementTotals())) {
        const parsed = parseEngagementKey(key);
        if (!parsed) continue;
        records.push({ articleId: parsed.articleId, kind: parsed.kind, total });
        totalsByKind[parsed.kind] += total;
        recordCountByKind[parsed.kind] += 1;
    }
    records.sort((a, b) => a.articleId.localeCompare(b.articleId) || a.kind.localeCompare(b.kind));
    return {
        words,
        records,
        totalsByKind,
        recordCountByKind,
        derankedIds: loadDerankedIds(),
        decayAt: loadDecayAt(),
        decayIntervalMs: DECAY_INTERVAL_MS,
        toggles: loadSignalToggles(),
    };
}

export interface ProfileExport {
    version: number;
    exportedAt: string;
    signals: Record<LearningSignal, boolean>;
    words: LearnedWord[];
    engagements: EngagementRecord[];
    derankedArticleIds: string[];
    decay: { lastAt: string | null; intervalMs: number };
}

/** Stable JSON shape for the downloaded profile; ISO times, no `undefined`. */
export function buildProfileExport(profile: LearningProfile, now: number = Date.now()): ProfileExport {
    return {
        version: PROFILE_EXPORT_VERSION,
        exportedAt: new Date(now).toISOString(),
        signals: profile.toggles,
        words: profile.words,
        engagements: profile.records,
        derankedArticleIds: profile.derankedIds,
        decay: {
            lastAt: profile.decayAt === null ? null : new Date(profile.decayAt).toISOString(),
            intervalMs: profile.decayIntervalMs,
        },
    };
}

export function serializeLearningProfile(profile: LearningProfile, now: number = Date.now()): string {
    return JSON.stringify(buildProfileExport(profile, now), null, 2);
}

/** `times-up-learning-profile-2026-11-19.json`, dated in UTC like the export. */
export function profileFileName(now: number = Date.now()): string {
    return `times-up-learning-profile-${new Date(now).toISOString().slice(0, 10)}.json`;
}

/** Round for display without turning `8` into `8.00`. */
export function formatWeight(weight: number): string {
    const rounded = Math.round(weight * 100) / 100;
    return rounded > 0 ? `+${rounded}` : String(rounded);
}
