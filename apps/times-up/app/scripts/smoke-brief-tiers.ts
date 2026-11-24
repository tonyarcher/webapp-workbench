// Three-tier briefing smoke: depth selection, link parity, and validation.
import { assert } from './smoke-assert';
import { BRIEF_TIERS, briefLinkParity, buildBriefTiers, isBriefTier } from '../src/services/brief-tiers';
import { normalizeEditionJson } from '../src/services/api';
import type { EditionSection } from '../src/types';

const section = (id: string, score: number, count: number): EditionSection => ({
    id,
    title: `Section ${id}`,
    articleIds: Array.from({ length: count }, (_, i) => `${id}-a${i}`),
    excerpts: Array.from({ length: count }, (_, i) => ({
        articleId: `${id}-a${i}`,
        title: `Source ${id}-a${i}`,
        text: `Excerpt ${id}-${i}`,
    })),
    scores: { worthy: score, interest: score, newness: 0, popularity: 0 },
});

const tiers = buildBriefTiers([section('low', 1, 6), section('top', 9, 6), section('mid', 5, 6)]);

assert(tiers.minute.length === 1, 'the minute tier is one compact card');
assert(tiers.minute[0]?.items.length === 5, 'the minute tier selects five excerpts');
assert(tiers.minute[0]?.items[0]?.articleId === 'top-a0', 'the minute tier leads with the top-ranked source');
assert(tiers.five.length === 3, 'the five-minute tier keeps every section');
assert(tiers.five[0]?.items.length === 3, 'the five-minute tier caps three excerpts per section');
assert(tiers.deep[0]?.items.length === 6, 'the deep tier keeps every cited excerpt');
assert(briefLinkParity(tiers), 'shallower source links are a subset of deeper tiers');
assert(isBriefTier('deep') && !isBriefTier('nope'), 'brief tier validation accepts only the three depths');
assert(BRIEF_TIERS.length === 3, 'the briefing has exactly three tiers');

const legacyTiers = buildBriefTiers([
    { id: 'old', title: 'Old story', summary: 'Old summary', articleIds: ['old-a1'] },
]);
assert(legacyTiers.minute[0]?.items[0]?.text === 'Old summary', 'editions without excerpts fall back to summaries');
assert(briefLinkParity(legacyTiers), 'legacy fallback keeps tier link parity');

const oneSection = buildBriefTiers([section('only', 9, 6)]);
assert(oneSection.minute[0]?.items.length === 3, 'a one-section minute never exceeds the deeper tier');
assert(briefLinkParity(oneSection), 'a one-section brief keeps link parity');

const empty = buildBriefTiers([]);
assert(empty.minute.length === 0 && empty.five.length === 0 && empty.deep.length === 0, 'empty briefs render no tiers');

const parsed = normalizeEditionJson({
    id: 'e1',
    status: 'ready',
    sections: [
        {
            id: 's1',
            title: 'T',
            articleIds: ['a1'],
            excerpts: [{ articleId: 'a1', title: 'Source', text: 'Cited text' }],
        },
    ],
});
assert(parsed.sections[0]?.excerpts?.[0]?.text === 'Cited text', 'edition JSON guard keeps cited excerpts');
