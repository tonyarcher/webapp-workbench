// Smoke phase: the Interesting model must seed from every liked title, not
// just the stars that happen to fall inside the open folder's recent batch.
// Split from smoke-interesting.ts to stay under the repo's 500-line file cap.
import { assert } from './smoke-assert';

// ---- likes outside the recent batch still seed the model ----
{
    const { createStarredLoader } = await import('../src/services/interesting-starred');
    const { interestingWordMapOf } = await import('../src/web-components/article-list/article-list-interesting');
    const { saveWordMap } = await import('../src/services/interesting-settings');

    let calls = 0;
    let clock = 1_000;
    // Read through a call so an earlier assert cannot narrow the count to a
    // literal, which would make later comparisons fail to compile.
    const callCount = (): number => calls;
    const loader = createStarredLoader(
        async () => {
            calls += 1;
            return [{ title: `Liked ${calls}` }];
        },
        100,
        () => clock,
    );
    assert((await loader.load())[0]?.title === 'Liked 1' && callCount() === 1, 'the likes loader fetches once');
    assert(
        (await loader.load())[0]?.title === 'Liked 1' && callCount() === 1,
        'the likes loader serves its cache inside the TTL',
    );
    clock += 101;
    assert(
        (await loader.load())[0]?.title === 'Liked 2' && callCount() === 2,
        'the likes loader refetches after the TTL',
    );
    loader.invalidate();
    assert((await loader.load())[0]?.title === 'Liked 3' && callCount() === 3, 'invalidate forces the next load');
    const offline = createStarredLoader(
        async () => {
            throw new Error('offline');
        },
        0,
        () => 0,
    );
    assert((await offline.load()).length === 0, 'a failed likes fetch yields no seeds instead of rejecting');

    let flakyFail = false;
    let flakyClock = 1_000;
    const flaky = createStarredLoader(
        async () => {
            if (flakyFail) throw new Error('offline');
            return [{ title: 'Known' }];
        },
        100,
        () => flakyClock,
    );
    assert((await flaky.load())[0]?.title === 'Known', 'a flaky likes loader serves its first success');
    flaky.invalidate();
    flakyFail = true;
    flakyClock += 101;
    assert(
        (await flaky.load()).length === 0,
        'invalidate drops the cached likes so a failed refresh cannot serve them',
    );

    let release: (seeds: Array<{ title: string }>) => void = () => {};
    const gated = createStarredLoader(
        () =>
            new Promise<Array<{ title: string }>>((resolve) => {
                release = resolve;
            }),
        100,
        () => 1,
    );
    const pending = gated.load();
    gated.invalidate();
    release([{ title: 'Previous Account' }]);
    assert((await pending).length === 0, 'a fetch that outlives invalidate does not repopulate the likes');

    const shims = globalThis as Record<string, unknown>;
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    saveWordMap({});
    const article = (i: number) => ({
        id: `b${i}`,
        feedId: 'feed1',
        guid: `b${i}`,
        title: `Rust Guide ${i}`,
        published: i,
        fetchedAt: 0,
        read: 0 as const,
        starred: false,
        popularity: 1,
        hot: 0,
    });
    const seeded = interestingWordMapOf([article(1)], [{ title: 'Older Rust Post' }]);
    assert(seeded['rust'] === 4, 'a like outside the batch seeds the model');
    assert(seeded['guide'] === undefined, 'an unliked batch title stays unknown');
    const seenTwice = interestingWordMapOf([{ ...article(2), starred: true }], [{ title: 'Rust Guide 2' }]);
    assert(seenTwice['rust'] === 4, 'a like seen in both the batch and the seed list counts once');
}
