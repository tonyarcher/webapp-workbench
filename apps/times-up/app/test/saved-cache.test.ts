import './test-setup';
import { expect } from '@esm-bundle/chai';
import { clearSavedArticles, getSavedArticles, putSavedArticle } from '../src/db/db';
import { fetchSavedArticlesList } from '../src/query';
import type { SavedArticleSnapshot } from '../src/types';

const serverItem: SavedArticleSnapshot = {
    id: 'server-1',
    articleId: 'a1',
    title: 'Server story',
    savedAt: 2,
};
const localItem: SavedArticleSnapshot = {
    id: 'local-1',
    title: 'Local link',
    savedAt: 3,
};

describe('saved article cache refresh', () => {
    const originalFetch = globalThis.fetch;

    afterEach(async () => {
        globalThis.fetch = originalFetch;
        localStorage.removeItem('times-up.auth.tokens');
        await clearSavedArticles();
    });

    it('replaces the cache atomically while preserving local-only snapshots', async () => {
        localStorage.setItem(
            'times-up.auth.tokens',
            JSON.stringify({ access: 'token', refresh: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 }),
        );
        globalThis.fetch = async () =>
            new Response(JSON.stringify({ items: [serverItem] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        await putSavedArticle(localItem);

        const merged = await fetchSavedArticlesList();

        expect(merged.map((item) => item.id)).to.deep.equal(['local-1', 'server-1']);
        expect((await getSavedArticles()).map((item) => item.id).sort()).to.deep.equal(['local-1', 'server-1']);
    });

    it('does not write a response from an older auth epoch', async () => {
        localStorage.setItem(
            'times-up.auth.tokens',
            JSON.stringify({ access: 'token', refresh: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 }),
        );
        globalThis.fetch = async () =>
            new Response(JSON.stringify({ items: [serverItem] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        await putSavedArticle(localItem);

        expect(await fetchSavedArticlesList(-1)).to.deep.equal([]);
        expect((await getSavedArticles()).map((item) => item.id)).to.deep.equal(['local-1']);
    });
});
