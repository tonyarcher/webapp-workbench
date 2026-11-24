import type { Edition, EditionExcerpt, EditionMeta, EditionSection, EditionStatus } from '../types';
import { ApiError, apiFetchWithStatus } from './api-domains';

const EDITION_STATUSES: readonly string[] = ['ready', 'building', 'failed'];

function editionStatusOf(value: unknown): EditionStatus {
    return typeof value === 'string' && EDITION_STATUSES.includes(value) ? (value as EditionStatus) : 'failed';
}

function stringArrayOf(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Shape guard for server edition JSON. Missing sections become [], unknown
 * statuses become 'failed', so a half-formed payload renders an empty paper
 * instead of crashing the view.
 */
export function normalizeEditionJson(json: unknown): Edition {
    const o = (json ?? {}) as Record<string, unknown>;
    const rawSections = Array.isArray(o['sections']) ? o['sections'] : [];
    return {
        id: typeof o['id'] === 'string' ? o['id'] : '',
        generatedAt: typeof o['generatedAt'] === 'number' ? o['generatedAt'] : 0,
        windowHours: typeof o['windowHours'] === 'number' ? o['windowHours'] : 0,
        status: editionStatusOf(o['status']),
        ...(typeof o['model'] === 'string' ? { model: o['model'] } : {}),
        ...(typeof o['opinion'] === 'string' ? { opinion: o['opinion'] } : {}),
        sections: rawSections.map(normalizeSectionJson),
    };
}

function sectionScores(scores: Record<string, unknown> | undefined): EditionSection['scores'] {
    const worthy = scores?.['worthy'];
    const interest = scores?.['interest'];
    if (typeof worthy !== 'number' || typeof interest !== 'number') return undefined;
    const newness = scores?.['newness'];
    const popularity = scores?.['popularity'];
    return {
        worthy,
        interest,
        ...(typeof newness === 'number' ? { newness } : {}),
        ...(typeof popularity === 'number' ? { popularity } : {}),
    };
}

function sectionTextFields(o: Record<string, unknown>): Pick<EditionSection, 'topic' | 'summary' | 'opinion'> {
    return {
        ...(typeof o['topic'] === 'string' ? { topic: o['topic'] } : {}),
        ...(typeof o['summary'] === 'string' ? { summary: o['summary'] } : {}),
        ...(typeof o['opinion'] === 'string' ? { opinion: o['opinion'] } : {}),
    };
}

function excerptArrayOf(value: unknown): EditionExcerpt[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        const o = item as Record<string, unknown>;
        const articleId = o['articleId'];
        const text = o['text'];
        if (typeof articleId !== 'string' || typeof text !== 'string' || !articleId || !text) return [];
        return [
            {
                articleId,
                text,
                title: typeof o['title'] === 'string' && o['title'] ? o['title'] : articleId,
            },
        ];
    });
}

function normalizeSectionJson(json: unknown): EditionSection {
    const o = (json ?? {}) as Record<string, unknown>;
    const scores = sectionScores(o['scores'] as Record<string, unknown> | undefined);
    return {
        id: typeof o['id'] === 'string' ? o['id'] : '',
        ...sectionTextFields(o),
        title: typeof o['title'] === 'string' ? o['title'] : '(untitled)',
        articleIds: stringArrayOf(o['articleIds']),
        excerpts: excerptArrayOf(o['excerpts']),
        ...(scores ? { scores } : {}),
        ...(typeof o['verified'] === 'boolean' ? { verified: o['verified'] } : {}),
        ...(o['delta'] === 'new' || o['delta'] === 'steady' ? { delta: o['delta'] as 'new' | 'steady' } : {}),
    };
}

export function normalizeEditionMeta(json: unknown): EditionMeta {
    const o = (json ?? {}) as Record<string, unknown>;
    return {
        id: typeof o['id'] === 'string' ? o['id'] : '',
        generatedAt: typeof o['generatedAt'] === 'number' ? o['generatedAt'] : 0,
        windowHours: typeof o['windowHours'] === 'number' ? o['windowHours'] : 0,
        status: editionStatusOf(o['status']),
    };
}

/** Latest generated edition, or null when none exists yet (404). */
export async function fetchLatestEdition(): Promise<Edition | null> {
    try {
        return normalizeEditionJson(await apiFetchWithStatus('/editions/latest'));
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
    }
}

/** One edition by id (used by the history switcher). */
export async function fetchEdition(id: string): Promise<Edition> {
    return normalizeEditionJson(await apiFetchWithStatus(`/editions/${encodeURIComponent(id)}`));
}

/** Recent edition metadata, newest first. */
export async function fetchEditions(limit = 10): Promise<EditionMeta[]> {
    const json = (await apiFetchWithStatus(`/editions?limit=${limit}`)) as { editions?: unknown } | unknown[];
    const list = Array.isArray(json) ? json : json.editions;
    if (!Array.isArray(list)) return [];
    return list.map(normalizeEditionMeta);
}
