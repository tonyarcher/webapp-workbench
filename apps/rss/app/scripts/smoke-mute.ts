// Mute-rules smoke: matching, preview (test drive), and undo snapshots.
import { assert } from './smoke-assert';
import {
    clearMuteUndo,
    consumeMuteUndo,
    filterMutedArticles,
    isMutedArticle,
    loadMuteRules,
    parseMuteTerms,
    peekMuteUndo,
    previewMutedArticles,
    rememberMuteUndo,
    restoreMuteUndo,
    saveMuteRules,
    type MuteRule,
} from '../src/services/mute-rules';
import type { Article } from '../src/types';

if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>)['localStorage'] = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => void store.clear(),
    };
}

function article(id: string, feedId: string, title: string, summary = '', content = ''): Article {
    return {
        id,
        feedId,
        guid: id,
        title,
        summary,
        content,
        link: `https://example.com/${id}`,
        published: 1,
        fetchedAt: 1,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
    };
}

{
    assert(
        parseMuteTerms('foo, bar\nbaz, foo').join('|') === 'foo|bar|baz',
        'parseMuteTerms trims, splits, and dedupes',
    );

    const rules: MuteRule[] = [
        { id: 'r1', terms: ['sponsor'], match: 'title', enabled: true, scope: { kind: 'all' } },
        { id: 'r2', terms: ['crypto'], match: 'body', enabled: true, scope: { kind: 'folders', folderIds: ['fold1'] } },
        { id: 'r3', terms: ['ignore'], match: 'either', enabled: false, scope: { kind: 'all' } },
    ];
    const lookup = { f1: ['fold1'], f2: ['fold2'] };
    assert(
        isMutedArticle(article('a1', 'f2', 'Sponsor update'), rules, lookup) === true,
        'title mute matches globally',
    );
    assert(
        isMutedArticle(article('a2', 'f2', 'News', 'crypto dip'), rules, lookup) === false,
        'folder-scoped body mute does not apply outside folder',
    );
    assert(
        isMutedArticle(article('a3', 'f1', 'News', 'crypto dip'), rules, lookup) === true,
        'folder-scoped body mute applies in folder',
    );
    assert(
        isMutedArticle(article('a4', 'f1', 'Please ignore this'), rules, lookup) === false,
        'disabled rule does not mute',
    );
    const filtered = filterMutedArticles(
        [article('a1', 'f2', 'Sponsor update'), article('a5', 'f2', 'Clean')],
        rules,
        lookup,
    );
    assert(filtered.length === 1 && filtered[0]!.id === 'a5', 'filterMutedArticles removes muted rows only');
}

{
    // Test drive preview: counts/samples without persistence
    localStorage.removeItem('rss-reader:mute-rules');
    saveMuteRules([]);
    const draft: MuteRule = { id: 'draft', terms: ['grid'], match: 'either', enabled: true, scope: { kind: 'all' } };
    const batch = [
        article('p1', 'f1', 'Grid outage'),
        article('p2', 'f1', 'Sunny day'),
        article('p3', 'f1', 'Power grid update'),
    ];
    const preview = previewMutedArticles(batch, draft);
    assert(preview.total === 3 && preview.hidden === 2, 'preview counts hidden articles in batch');
    assert(preview.samples.length === 2 && preview.samples[0] === 'Grid outage', 'preview returns sample titles');
    assert(loadMuteRules().length === 0, 'preview does not persist rules');
}

{
    // Undo snapshot: remember/consume/restore
    clearMuteUndo();
    const before: MuteRule[] = [{ id: 'u1', terms: ['old'], match: 'either', enabled: true, scope: { kind: 'all' } }];
    const after: MuteRule[] = [
        { id: 'u2', terms: ['new'], match: 'title', enabled: true, scope: { kind: 'folders', folderIds: ['x'] } },
    ];
    saveMuteRules(after);
    rememberMuteUndo(before);
    assert(peekMuteUndo() !== null, 'peekMuteUndo sees remembered snapshot');
    assert(restoreMuteUndo() === true, 'restoreMuteUndo restores snapshot');
    const restored = loadMuteRules();
    assert(
        restored.length === 1 && restored[0]!.id === 'u1' && restored[0]!.terms[0] === 'old',
        'restoreMuteUndo persists previous rules',
    );
    assert(peekMuteUndo() === null, 'restoreMuteUndo consumes snapshot');
    assert(restoreMuteUndo() === false, 'restoreMuteUndo is one-shot');
    rememberMuteUndo(before);
    const consumed = consumeMuteUndo();
    assert(consumed?.[0]?.id === 'u1', 'consumeMuteUndo returns snapshot');
    assert(consumeMuteUndo() === null, 'consumeMuteUndo clears snapshot');
}

console.log('smoke-mute: ok');
