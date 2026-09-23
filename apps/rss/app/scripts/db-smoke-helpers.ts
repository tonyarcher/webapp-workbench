// Shared fixtures for db-smoke.ts: assertion, reset, article factory.
import { getDb } from '../src/db/db';
import type { Article } from '../src/types';

export function assert(cond: boolean, msg: string) {
    if (!cond) {
        console.error(`FAIL: ${msg}`);
        process.exit(1);
    }
    console.log(`ok: ${msg}`);
}

export async function resetDb() {
    const db = await getDb();
    await Promise.all([db.clear('feeds'), db.clear('folders'), db.clear('articles'), db.clear('meta')]);
}

export function makeArticle(feedId: string, guid: string, published: number, read: 0 | 1 = 0): Article {
    return {
        id: `${feedId}:${guid}`,
        feedId,
        guid,
        title: `Article ${guid}`,
        link: `https://example.com/${guid}`,
        summary: 'summary',
        published,
        fetchedAt: Date.now(),
        read,
        starred: false,
        normLink: `example.com/${guid}`,
        comments: 0,
        popularity: 1,
        hot: published / 1000,
    };
}
