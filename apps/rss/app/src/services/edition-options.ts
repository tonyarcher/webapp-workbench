import type {EditionSection} from '../types';

/**
 * Front Page edition options. windowHours/sectionCount shape the next server
 * build; the four weights re-sort the served sections instantly on the
 * client (no rebuild). Weight defaults (0.3/0.3/0.25/0.15) match the server
 * ranker so the client order agrees with the build order by default.
 */
export interface EditionOptions {
    windowHours: number;
    sectionCount: number;
    weightGeneral: number;
    weightPersonal: number;
    weightNewness: number;
    weightPopularity: number;
    showOpinion: boolean;
    showFactCheck: boolean;
}

export const DEFAULT_EDITION_OPTIONS: EditionOptions = {
    windowHours: 24,
    sectionCount: 12,
    weightGeneral: 0.3,
    weightPersonal: 0.3,
    weightNewness: 0.25,
    weightPopularity: 0.15,
    showOpinion: true,
    showFactCheck: true,
};

export const EDITION_WINDOW_HOURS_OPTIONS = [24, 48, 168] as const;
export const EDITION_SECTION_COUNT_MIN = 1;
export const EDITION_SECTION_COUNT_MAX = 12;

const STORAGE_KEY = 'rss-reader:edition-options';

export function defaultEditionOptions(): EditionOptions {
    return {...DEFAULT_EDITION_OPTIONS};
}

function isOneOf(value: unknown, options: readonly number[]): value is number {
    return typeof value === 'number' && options.includes(value);
}

function weightOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

function sectionCountOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= EDITION_SECTION_COUNT_MIN && value <= EDITION_SECTION_COUNT_MAX
        ? value
        : fallback;
}

/**
 * Clamp out-of-range numerics back into shape (unknown windows/counts fall
 * back to defaults). Used by load so stored junk never reaches the view.
 */
export function pruneEditionOptions(options: EditionOptions): EditionOptions {
    return {
        windowHours: isOneOf(options.windowHours, EDITION_WINDOW_HOURS_OPTIONS)
            ? options.windowHours
            : DEFAULT_EDITION_OPTIONS.windowHours,
        sectionCount: sectionCountOr(options.sectionCount, DEFAULT_EDITION_OPTIONS.sectionCount),
        weightGeneral: weightOr(options.weightGeneral, DEFAULT_EDITION_OPTIONS.weightGeneral),
        weightPersonal: weightOr(options.weightPersonal, DEFAULT_EDITION_OPTIONS.weightPersonal),
        weightNewness: weightOr(options.weightNewness, DEFAULT_EDITION_OPTIONS.weightNewness),
        weightPopularity: weightOr(options.weightPopularity, DEFAULT_EDITION_OPTIONS.weightPopularity),
        showOpinion: options.showOpinion === true,
        showFactCheck: options.showFactCheck === true,
    };
}

export function loadEditionOptions(): EditionOptions {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultEditionOptions();
        const parsed = JSON.parse(raw) as Partial<EditionOptions>;
        return pruneEditionOptions({
            windowHours: typeof parsed.windowHours === 'number' ? parsed.windowHours : DEFAULT_EDITION_OPTIONS.windowHours,
            sectionCount: typeof parsed.sectionCount === 'number' ? parsed.sectionCount : DEFAULT_EDITION_OPTIONS.sectionCount,
            weightGeneral: typeof parsed.weightGeneral === 'number' ? parsed.weightGeneral : DEFAULT_EDITION_OPTIONS.weightGeneral,
            weightPersonal: typeof parsed.weightPersonal === 'number' ? parsed.weightPersonal : DEFAULT_EDITION_OPTIONS.weightPersonal,
            weightNewness: typeof parsed.weightNewness === 'number' ? parsed.weightNewness : DEFAULT_EDITION_OPTIONS.weightNewness,
            weightPopularity: typeof parsed.weightPopularity === 'number' ? parsed.weightPopularity : DEFAULT_EDITION_OPTIONS.weightPopularity,
            showOpinion: parsed.showOpinion === true,
            showFactCheck: parsed.showFactCheck === true,
        });
    } catch {
        return defaultEditionOptions();
    }
}

export function saveEditionOptions(options: EditionOptions): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
        // storage unavailable; options just won't persist
    }
}

/**
 * Re-sort served sections under the client weights for instant feedback
 * without a rebuild. Missing signals count as zero. Deterministic: ties
 * break on section id. Never mutates the input.
 */
export function applyWeights(sections: EditionSection[], options: EditionOptions): EditionSection[] {
    const score = (s: EditionSection): number =>
        options.weightGeneral * (s.scores?.worthy ?? 0) +
        options.weightPersonal * (s.scores?.interest ?? 0) +
        options.weightNewness * (s.scores?.newness ?? 0) +
        options.weightPopularity * (s.scores?.popularity ?? 0);
    return [...sections].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}
