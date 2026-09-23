// Interesting-filter smoke: word maps, settings persistence, scoring, Jev state, router.
import { assert } from './smoke-assert';

// ---- interesting filter: starred-word map, settings, ranking, jev state, router ----
{
    const { buildWordMap, extractWords, interestingScore, rankInteresting, topWords, toJevState } =
        await import('../src/services/interesting-words');
    const { adjustWordMap, isHideReadFolder, loadInterestingShadow, loadWordMap, saveInterestingShadow, saveWordMap } =
        await import('../src/services/interesting-settings');

    assert(
        extractWords('The Quick, Brown Fox!').join(',') === 'quick,brown,fox',
        'extractWords lowercases and drops stopwords',
    );
    assert(extractWords('Go to Mars').join(',') === 'mars', 'extractWords drops short tokens and stopwords');
    assert(extractWords('the and of').length === 0, 'extractWords empties glue-only titles');

    const starredTitles = [{ title: 'Kubernetes Rust Performance' }];
    const readTitles = [{ title: 'Kubernetes News Roundup' }];
    const wordMap = buildWordMap(starredTitles, readTitles);
    assert(wordMap['kubernetes'] === 5, 'buildWordMap adds star weight 4 and read weight 1');
    assert(wordMap['rust'] === 4, 'buildWordMap star-only word weighs 4');
    assert(wordMap['news'] === 1, 'buildWordMap read-only word weighs 1');

    assert(
        interestingScore({ title: 'Rust Kubernetes' }, wordMap) === 4.5,
        'interestingScore averages weights over tokens',
    );
    assert(interestingScore({ title: 'Unrelated Zebra' }, wordMap) === 0, 'interestingScore is 0 for unknown words');
    assert(interestingScore({ title: 'the!' }, wordMap) === 0, 'interestingScore is 0 for empty token lists');

    const top = topWords({ b: 2, a: 2, c: 1 }, 2);
    assert(top.map((w) => w.word).join(',') === 'a,b', 'topWords breaks ties alphabetically');
    assert(topWords({ a: 1 }, 0).length === 0, 'topWords with n=0 returns empty');

    const shims = globalThis as Record<string, unknown>;
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    saveInterestingShadow({ f1: true });
    assert(loadInterestingShadow()['f1'] === true, 'interesting shadow settings round-trip');
    mem.set('rss-reader:interesting-shadow', 'oops');
    assert(Object.keys(loadInterestingShadow()).length === 0, 'interesting shadow falls back to {} on invalid JSON');
    mem.set('rss-reader:interesting-shadow', JSON.stringify({ f1: 'yes', f2: 1 }));
    assert(Object.keys(loadInterestingShadow()).length === 0, 'interesting shadow keeps true-valued string keys only');

    saveWordMap({ rust: 4 });
    assert(loadWordMap()['rust'] === 4, 'word map settings round-trip');
    adjustWordMap('Rust Performance', 4);
    assert(loadWordMap()['rust'] === 8, 'adjustWordMap adds star weight to cached words');
    adjustWordMap('Rust Performance', -8);
    assert(loadWordMap()['rust'] === undefined, 'adjustWordMap clamps to zero and removes the entry');
    mem.set('rss-reader:word-map', JSON.stringify({ rust: 'lots' }));
    assert(loadWordMap()['rust'] === undefined, 'word map drops non-numeric entries');
    saveWordMap({});
    mem.delete('rss-reader:word-map-ids');
    adjustWordMap('Rust Performance', 4, 'a1');
    adjustWordMap('Rust Performance', 4, 'a1');
    assert(loadWordMap()['rust'] === 4, 'adjustWordMap counts one article once');
    adjustWordMap('Rust Performance', -4, 'a1');
    assert(loadWordMap()['rust'] === undefined, 'adjustWordMap unstar forgets the id');
    adjustWordMap('Rust Performance', 4, 'a1');
    assert(loadWordMap()['rust'] === 4, 'adjustWordMap re-star counts again');

    mem.set('rss-reader:hide-read-by-folder', JSON.stringify({ f1: true }));
    assert(isHideReadFolder('f1') === true, 'hide-read lookup follows the folder toggle');
    assert(isHideReadFolder('f2') === false, 'hide-read lookup defaults to false');

    const candidates = [
        { id: 'a1', title: 'Rust Kubernetes Guide', feedId: 'fa', hot: 10 },
        { id: 'a2', title: 'Zebra News', feedId: 'fb', hot: 5 },
        { id: 'a3', title: 'Rust Performance Tips', feedId: 'fa', hot: 8 },
    ];
    const full = toJevState(candidates, wordMap, { 'aff:feed:fa': 3 }, 100_000);
    const parsedFull = JSON.parse(full) as {
        candidates: Array<{ id: string; title: string; feed: string; hot: number }>;
    };
    assert(parsedFull.candidates.length === 3, 'toJevState keeps all candidates when under budget');
    assert(
        parsedFull.candidates[0].feed === 'fa' && typeof parsedFull.candidates[0].hot === 'number',
        'toJevState candidates carry feed and hot',
    );
    const tight = toJevState(candidates, wordMap, { 'aff:feed:fa': 3 }, 200);
    assert(tight.length <= 200, 'toJevState never exceeds maxChars');
    const parsedTight = JSON.parse(tight) as {
        candidates: Array<{ id: string; title: string; feed: string; hot: number }>;
    };
    assert(
        parsedTight.candidates.length < parsedFull.candidates.length,
        'toJevState drops whole candidates over budget',
    );
    for (const c of parsedTight.candidates) {
        assert(
            typeof c.id === 'string' &&
                typeof c.title === 'string' &&
                typeof c.feed === 'string' &&
                typeof c.hot === 'number',
            'toJevState never truncates mid-article',
        );
    }

    const rankMap = buildWordMap([{ title: 'Rust Performance' }], []);
    const ranked = rankInteresting(
        [
            { id: 'b', title: 'Zebra News' },
            { id: 'a', title: 'Rust Performance' },
        ],
        rankMap,
    );
    assert(ranked.map((a) => a.id).join(',') === 'a,b', 'rankInteresting orders by score desc');
    const tiedRank = rankInteresting(
        [
            { id: 'b', title: 'Rust Guide' },
            { id: 'a', title: 'Rust Guide' },
        ],
        rankMap,
    );
    assert(tiedRank.map((a) => a.id).join(',') === 'a,b', 'rankInteresting tiebreaks on id');
    assert(rankInteresting([], rankMap).length === 0, 'rankInteresting handles empty input');
    const rankSrc = [
        { id: 'b', title: 'Zebra News' },
        { id: 'a', title: 'Rust Performance' },
    ];
    rankInteresting(rankSrc, rankMap);
    assert(rankSrc[0].id === 'b', 'rankInteresting does not mutate the input');

    const { parsePath } = await import('../src/router');
    assert(
        parsePath('/interesting/f1').kind === 'all',
        '#/interesting/:id no longer parses to a view (falls back to all)',
    );
}
