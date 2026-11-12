// Interesting-filter smoke: word maps, settings persistence, scoring, decision state, router.
import { assert } from './smoke-assert';

// ---- Interesting view: starred-word map, settings, ranking, decision state, router ----
{
    const { buildWordMap, extractWords, interestingScore, rankInteresting, topWords, toDecisionState } =
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
    const full = toDecisionState(candidates, wordMap, { 'aff:feed:fa': 3 }, 100_000);
    const parsedFull = JSON.parse(full) as {
        candidates: Array<{ id: string; title: string; feed: string; hot: number }>;
    };
    assert(parsedFull.candidates.length === 3, 'toDecisionState keeps all candidates when under budget');
    assert(
        parsedFull.candidates[0]!.feed === 'fa' && typeof parsedFull.candidates[0]!.hot === 'number',
        'toDecisionState candidates carry feed and hot',
    );
    const tight = toDecisionState(candidates, wordMap, { 'aff:feed:fa': 3 }, 200);
    assert(tight.length <= 200, 'toDecisionState never exceeds maxChars');
    const parsedTight = JSON.parse(tight) as {
        candidates: Array<{ id: string; title: string; feed: string; hot: number }>;
    };
    assert(
        parsedTight.candidates.length < parsedFull.candidates.length,
        'toDecisionState drops whole candidates over budget',
    );
    for (const c of parsedTight.candidates) {
        assert(
            typeof c.id === 'string' &&
                typeof c.title === 'string' &&
                typeof c.feed === 'string' &&
                typeof c.hot === 'number',
            'toDecisionState never truncates mid-article',
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
    assert(rankSrc[0]!.id === 'b', 'rankInteresting does not mutate the input');

    const { parsePath, viewToPath } = await import('../src/router');
    const parsed = parsePath('/interesting/f1');
    assert(
        parsed.kind === 'interesting' && parsed.id === 'f1',
        '#/interesting/:id parses to the Interesting view for that folder',
    );
    assert(viewToPath({ kind: 'interesting', id: 'f1' }) === '/interesting/f1', 'Interesting view round-trips to path');
    assert(
        parsePath('/folder/f1').kind === 'folder' && viewToPath({ kind: 'folder', id: 'f1' }) === '/folder/f1',
        'folder view still round-trips',
    );
}

// ---- engagement: read time, dwell, shares, summaries, originals ----
{
    const {
        BOUNCE_WEIGHT,
        DWELL_CAP,
        OPEN_READ_CAP,
        SHARE_WORD_CAP,
        SUMMARY_WORD_CAP,
        dwellWeight,
        expandedReadWeight,
    } = await import('../src/services/engagement');
    assert(expandedReadWeight(2, true) === BOUNCE_WEIGHT, 'a sub-three-second dismissed open counts as a bounce');
    assert(expandedReadWeight(2, false) === 0, 'moving on is never a bounce, no matter how fast');
    assert(expandedReadWeight(30, true) === 2, 'thirty seconds of expanded reading weighs one step');
    assert(expandedReadWeight(120, false) === 8, 'expanded reading caps instead of compounding');
    assert(expandedReadWeight(Number.NaN, true) === 0, 'expanded reading ignores non-finite input');
    assert(dwellWeight(29) === 0, 'dwell under a step accrues nothing');
    assert(dwellWeight(90) === 1, 'dwell accrues per minute');
    assert(dwellWeight(9_999) === DWELL_CAP, 'dwell caps instead of compounding');

    const shims = globalThis as Record<string, unknown>;
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    const { accrueEngagement, loadEngagementTotals, loadWordMap } =
        await import('../src/services/interesting-settings');
    accrueEngagement('Rust Performance', 4, 'a1', OPEN_READ_CAP, 'open');
    assert(loadWordMap()['rust'] === 4, 'accrual teaches the word map');
    assert(loadEngagementTotals()['a1:open'] === 4, 'accrual ledgers the lifetime total');
    accrueEngagement('Rust Performance', 8, 'a1', OPEN_READ_CAP, 'open');
    assert(loadEngagementTotals()['a1:open'] === OPEN_READ_CAP, 'accrual clamps the lifetime total at the cap');
    assert(loadWordMap()['rust'] === OPEN_READ_CAP, 'accrual only applies the unclamped slice');
    accrueEngagement('Rust Performance', 2, 'a1', OPEN_READ_CAP, 'open');
    assert(loadWordMap()['rust'] === OPEN_READ_CAP, 'accrual at the cap is a no-op');
    accrueEngagement('Zebra News', -1, 'z1', OPEN_READ_CAP, 'open');
    assert(loadEngagementTotals()['z1:open'] === BOUNCE_WEIGHT, 'bounces ledger negative');
    accrueEngagement('Zebra News', -99, 'z1', 2, 'open');
    assert(loadEngagementTotals()['z1:open'] === -2, 'accrual floors the lifetime total');
    accrueEngagement('Ignored', 0, 'i1', 4, 'open');
    assert(loadEngagementTotals()['i1:open'] === undefined, 'zero-weight accrual writes nothing');
    accrueEngagement('Mixed Signals', 8, 'm1', SHARE_WORD_CAP, 'share');
    accrueEngagement('Mixed Signals', 4, 'm1', SUMMARY_WORD_CAP, 'summary');
    assert(
        loadWordMap()['mixed'] === 12 && loadWordMap()['signals'] === 12,
        'a low-cap signal adds to weight a high-cap signal earned',
    );
    assert(
        loadEngagementTotals()['m1:share'] === 8 && loadEngagementTotals()['m1:summary'] === 4,
        'each signal ledgers under its own cap',
    );

    const { noteDerank, noteOriginal, noteShare, noteSummary } = await import('../src/mutations');
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void };
    store.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    const seen: Array<{ url: string; body: string | null }> = [];
    shims['fetch'] = async (url: unknown, init?: { body?: unknown }) => {
        seen.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : null });
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        noteShare('s1', 'Shared Rust Story');
        noteSummary('u1', 'Summarized Rust Guide');
        noteOriginal('o1', 'Original Rust Post');
        await new Promise((resolve) => setTimeout(resolve, 10));
        assert(loadWordMap()['shared'] === 8, 'a share teaches the word map two stars of weight');
        assert(loadWordMap()['summarized'] === 4, 'a summary teaches the word map a star of weight');
        assert(loadWordMap()['original'] === 2, 'opening the original teaches the word map');
        assert(loadEngagementTotals()['s1:share'] === SHARE_WORD_CAP - 8, 'a share ledgers under its own cap');
        const { isDeranked, loadDerankedIds } = await import('../src/services/interesting-settings');
        noteDerank('d1', 'Deranked Rust Story', true);
        assert(isDeranked('d1') === true, 'derank records the preference');
        assert(loadWordMap()['deranked'] === -4, 'derank counts the anti-star against the words');
        assert(loadEngagementTotals()['d1:derank'] === -4, 'derank ledgers the negative slice');
        noteDerank('d1', 'Deranked Rust Story', true);
        assert(loadWordMap()['deranked'] === -4, 'deranking twice does not double count');
        noteDerank('d1', 'Deranked Rust Story', false);
        assert(isDeranked('d1') === false, 'untoggling clears the preference');
        assert(loadWordMap()['deranked'] === undefined, 'untoggling pays the weight back');
        mem.set('rss-reader:deranked-ids', 'oops');
        assert(loadDerankedIds().length === 0, 'deranked ids fall back to [] on invalid JSON');
        const { decayLearnedIfDue } = await import('../src/services/interesting-settings');
        const { meetsInterestingBar } = await import('../src/services/interesting-words');
        assert(meetsInterestingBar(0.5) === true, 'positively scored articles make the Interesting view');
        assert(meetsInterestingBar(0) === false, 'unknown articles do not make the Interesting view');
        assert(meetsInterestingBar(-1) === false, 'deranked articles do not make the Interesting view');
        const many: Record<string, number> = { keep: 8, drop: 1, neg: -4 };
        for (let i = 0; i < 505; i++) many[`filler${i}`] = 1;
        mem.set('rss-reader:word-map', JSON.stringify(many));
        mem.set('rss-reader:engagement-totals', JSON.stringify({ 'x:open': 8, 'y:open': 0.1 }));
        mem.set('rss-reader:engagement-decayed-at', String(Date.now() - 25 * 3_600_000));
        decayLearnedIfDue(Date.now());
        const decayed = loadWordMap();
        assert(decayed['keep'] === 4, 'a stale map halves instead of flattening the ranking');
        assert(decayed['neg'] === -2, 'decay keeps the sign of deranked words');
        assert(Object.keys(decayed).length === 500, 'decay prunes the map to its strongest words');
        const decayedTotals = loadEngagementTotals();
        assert(decayedTotals['x:open'] === 4, 'lifetime totals decay with the map');
        assert(decayedTotals['y:open'] === undefined, 'decay forgets dust');
        decayLearnedIfDue(Date.now());
        assert(loadWordMap()['keep'] === 4, 'decay runs at most once a day');
        const affinityPosts = seen.filter((s) => s.url.includes('/api/affinity'));
        assert(
            affinityPosts.some((s) => (s.body ?? '').includes('"amount":8')),
            'a share posts the share affinity amount',
        );
        assert(
            affinityPosts.some((s) => (s.body ?? '').includes('"amount":4')),
            'a summary posts the summary affinity amount',
        );
    } finally {
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}
