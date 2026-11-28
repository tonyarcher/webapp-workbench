// B3 client-first quality labels. These are conservative markers, not a verdict
// about the publisher: they tell the reader a row may not be finishable before
// spending time on it. Server fetch classification can refine these later.

import type { Article } from '../types';
import { stripTags } from '../util';

export type ContentQualityKind = 'paywall' | 'truncated' | 'error';

export interface ContentQuality {
    kind: ContentQualityKind;
    label: string;
}

const PAYWALL =
    /(?:subscribe (?:to )?(?:continue|read)|unlock (?:full )?access|become a member|subscriber[- ]only|sign in to (?:read|continue)|for subscribers only)/i;
const ERROR = /(?:\b404\b|\b403\b|page not found|access denied|forbidden)/i;
const TRUNCATED = /(?:\[truncated\]|(?:article|content|text) truncated)/i;

/** One conservative label per row, or null when the text carries no marker. */
export function contentQuality(article: Article): ContentQuality | null {
    const text = stripTags(article.content ?? '') || article.summary || '';
    if (ERROR.test(text)) return { kind: 'error', label: 'Fetch error' };
    if (PAYWALL.test(text)) return { kind: 'paywall', label: 'Paywall likely' };
    if (TRUNCATED.test(text)) return { kind: 'truncated', label: 'Truncated' };
    return null;
}
