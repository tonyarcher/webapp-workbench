import type { EditionExcerpt, EditionSection } from '../types';

export type BriefTier = 'minute' | 'five' | 'deep';

export const BRIEF_TIERS: readonly BriefTier[] = ['minute', 'five', 'deep'];

export const BRIEF_TIER_LABELS: Record<BriefTier, string> = {
    minute: 'The minute',
    five: 'Five minutes',
    deep: 'Deep read',
};

export interface BriefTierSection {
    id: string;
    title: string;
    topic?: string | undefined;
    summary?: string | undefined;
    items: EditionExcerpt[];
}

export interface BriefTiers {
    minute: BriefTierSection[];
    five: BriefTierSection[];
    deep: BriefTierSection[];
}

const MINUTE_EXCERPTS = 5;
const FIVE_EXCERPTS = 3;

export function isBriefTier(value: unknown): value is BriefTier {
    return typeof value === 'string' && BRIEF_TIERS.includes(value as BriefTier);
}

function sectionScore(section: EditionSection): number {
    const scores = section.scores;
    if (!scores) return 0;
    return scores.worthy + scores.interest + (scores.newness ?? 0) + (scores.popularity ?? 0);
}

function withFallbackExcerpts(sections: EditionSection[]): EditionSection[] {
    return sections.map((section) => {
        if (section.excerpts?.length) return section;
        const text = section.summary?.trim() || section.title;
        if (!text) return section;
        return {
            ...section,
            excerpts: [
                {
                    articleId: section.articleIds[0] ?? section.id,
                    title: section.topic ?? section.title,
                    text,
                },
            ],
        };
    });
}

function rankedSections(sections: EditionSection[]): EditionSection[] {
    return [...sections].sort((a, b) => sectionScore(b) - sectionScore(a) || a.id.localeCompare(b.id));
}

function tierSection(section: EditionSection, take: number): BriefTierSection {
    return {
        id: section.id,
        title: section.title,
        ...(section.topic ? { topic: section.topic } : {}),
        ...(section.summary ? { summary: section.summary } : {}),
        items: (section.excerpts ?? []).slice(0, take),
    };
}

/**
 * Builds three depths from one cited corpus. Every excerpt in a shallower tier
 * also appears in the deeper tiers, so a source link never changes meaning
 * when the reader switches depth.
 */
export function buildBriefTiers(sections: EditionSection[]): BriefTiers {
    const ranked = rankedSections(withFallbackExcerpts(sections));
    const minuteItems: EditionExcerpt[] = [];
    for (let depth = 0; depth < FIVE_EXCERPTS && minuteItems.length < MINUTE_EXCERPTS; depth++) {
        for (const section of ranked) {
            const item = section.excerpts?.[depth];
            if (item) minuteItems.push(item);
            if (minuteItems.length === MINUTE_EXCERPTS) break;
        }
    }
    return {
        minute: minuteItems.length
            ? [
                  {
                      id: 'minute',
                      title: BRIEF_TIER_LABELS.minute,
                      items: minuteItems,
                  },
              ]
            : [],
        five: ranked.map((section) => tierSection(section, FIVE_EXCERPTS)),
        deep: ranked.map((section) => tierSection(section, Number.POSITIVE_INFINITY)),
    };
}

/** Test helper: shallower source links are a subset of every deeper tier. */
export function briefLinkParity(tiers: BriefTiers): boolean {
    const ids = (sections: BriefTierSection[]) =>
        new Set(sections.flatMap((section) => section.items.map((item) => item.articleId)));
    const minute = ids(tiers.minute);
    const five = ids(tiers.five);
    const deep = ids(tiers.deep);
    return [...minute].every((id) => five.has(id) && deep.has(id)) && [...five].every((id) => deep.has(id));
}
