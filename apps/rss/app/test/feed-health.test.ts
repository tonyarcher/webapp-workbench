import './test-setup';
import { expect } from '@esm-bundle/chai';
import { deriveHealth, pruneSelection, removalMessage, viewHealth } from '../src/services/feed-health';
import type { Feed } from '../src/types';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_800_000_000_000;

function feed(over: Partial<Feed> = {}): Feed {
    return {
        id: 'f1',
        title: 'Example',
        url: 'https://example.com/feed',
        folderIds: [],
        unread: 0,
        addedAt: now - 30 * DAY,
        ...over,
    };
}

describe('feed health derivation', () => {
    it('ranks unreachable before stale before healthy', () => {
        const rows = deriveHealth(
            [
                feed({ id: 'ok', title: 'OK' }),
                feed({ id: 'stale', title: 'Stale', lastError: 'HTTP 500' }),
                feed({ id: 'bad', title: 'Bad', consecutiveFailures: 3 }),
            ],
            {},
            now,
        );

        expect(rows.map((r) => r.feed.id)).to.deep.equal(['bad', 'stale', 'ok']);
    });

    it('uses lastFetchedAt for age and suggests refresh on a failed fetch', () => {
        const rows = deriveHealth([feed({ lastFetchedAt: now - 9 * DAY, lastError: 'timeout' })], {}, now);

        expect(rows[0]?.kind).to.equal('stale');
        expect(rows[0]?.ageDays).to.equal(9);
        expect(rows[0]?.suggestion).to.contain('Refresh');
    });

    it('marks a never-fetched feed with null age', () => {
        const rows = deriveHealth([feed()], {}, now);

        expect(rows[0]?.kind).to.equal('ok');
        expect(rows[0]?.ageDays).to.equal(null);
    });

    it('filters low-volume feeds and sorts by recent count', () => {
        const rows = deriveHealth(
            [
                feed({ id: 'a', title: 'Alpha', lastFetchedAt: now }),
                feed({ id: 'b', title: 'Beta', lastFetchedAt: now }),
            ],
            { a: 2, b: 40 },
            now,
        );

        const low = viewHealth(rows, { kind: 'all', maxRecent: 5, sort: 'recent' });

        expect(low.map((r) => r.feed.id)).to.deep.equal(['a']);
    });
    it('prunes stale selection ids', () => {
        const kept = feed({ id: 'keep' });
        const pruned = pruneSelection(['keep', 'gone'], [kept]);

        expect([...pruned]).to.deep.equal(['keep']);
    });

    it('names the feeds in a bulk removal confirm', () => {
        const message = removalMessage(['Alpha', 'Beta', 'Gamma', 'Delta']);

        expect(message).to.contain('Remove 4 feeds');
        expect(message).to.contain('Alpha, Beta, Gamma and 1 more');
        expect(message).to.contain('cannot be undone');
    });

    it('never proposes removal', () => {
        const rows = deriveHealth([feed({ consecutiveFailures: 9 })], {}, now);

        expect(rows[0]?.suggestion).to.not.contain('Unfollow permanently');
        expect(rows[0]?.suggestion.toLowerCase()).to.not.contain('delete');
    });
});
