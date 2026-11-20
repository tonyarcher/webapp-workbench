// Privacy dashboard smoke: learned-profile reader, signal switches, decay,
// star-seeding gate, export shape, and one-tap forget.
import { assert } from './smoke-assert';
import type { Article } from '../src/types';

{
    const shims = globalThis as Record<string, unknown>;
    const realWindow = shims['window'];
    const realStorage = shims['localStorage'];
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as {
        getItem: (k: string) => string | null;
        setItem: (k: string, v: string) => void;
        removeItem: (k: string) => void;
    };

    try {
        const {
            PROFILE_EXPORT_VERSION,
            buildProfileExport,
            formatWeight,
            loadLearningProfile,
            parseEngagementKey,
            profileFileName,
            serializeLearningProfile,
        } = await import('../src/services/learning-profile');
        const { LEARNING_SIGNALS, isSignalEnabled, loadSignalToggles, setSignalEnabled } =
            await import('../src/services/learning-signals');
        const {
            accrueEngagement,
            decayLearnedIfDue,
            forgetLearning,
            loadDerankedIds,
            loadEngagementTotals,
            loadWordMap,
            saveWordMap,
        } = await import('../src/services/interesting-settings');

        // ---- switches default on and round-trip ----
        const defaults = loadSignalToggles();
        assert(
            LEARNING_SIGNALS.every((spec) => defaults[spec.kind] === true),
            'every learning signal defaults on',
        );
        setSignalEnabled('dwell', false);
        assert(isSignalEnabled('dwell') === false, 'a switched-off signal reads off');
        assert(isSignalEnabled('star') === true, 'switching one signal leaves the rest on');
        store.setItem('rss-reader:learning-signals', 'not json');
        assert(
            LEARNING_SIGNALS.every((spec) => loadSignalToggles()[spec.kind] === true),
            'malformed switches fall back to every signal on',
        );

        // ---- engagement ledger keys parse, corrupt entries drop ----
        const share = parseEngagementKey('a1:share');
        assert(share?.articleId === 'a1' && share.kind === 'share', 'engagement keys split article from kind');
        assert(parseEngagementKey('broken') === null, 'a key with no kind is ignored');
        assert(parseEngagementKey('a1:unknown') === null, 'an unknown kind is ignored');
        assert(parseEngagementKey('a:1:open')?.articleId === 'a:1', 'the last colon splits even a colon-bearing id');

        // ---- rigged profile: words, totals, deranks, decay ----
        mem.clear();
        saveWordMap({ rust: 8, kubernetes: 4, crypto: -6 });
        store.setItem(
            'rss-reader:engagement-totals',
            JSON.stringify({ 'a1:share': 8, 'a1:dwell': 3, 'b2:open': 1, broken: 9 }),
        );
        store.setItem('rss-reader:deranked-ids', JSON.stringify(['a9', 'b8']));
        store.setItem('rss-reader:engagement-decayed-at', '1700000000000');
        const profile = loadLearningProfile();
        assert(profile.words.map((w) => w.word).join(',') === 'rust,crypto,kubernetes', 'words sort by strength');
        assert(profile.records.length === 3, 'only well-formed ledger entries are counted');
        assert(profile.totalsByKind.share === 8 && profile.totalsByKind.dwell === 3, 'totals group by kind');
        assert(profile.recordCountByKind.share === 1 && profile.recordCountByKind.open === 1, 'records count by kind');
        assert(profile.derankedIds.join(',') === 'a9,b8', 'deranked ids reach the dashboard');
        assert(profile.decayAt === 1_700_000_000_000, 'the decay clock reaches the dashboard');
        assert(profile.decayIntervalMs === 86_400_000, 'decay interval is one day');
        assert(profile.toggles.star === true, 'the profile carries the signal switches');

        // ---- export shape is stable ----
        const exported = buildProfileExport(profile, 1_700_000_000_000);
        assert(exported.version === PROFILE_EXPORT_VERSION, 'export carries the schema version');
        assert(exported.exportedAt === '2023-11-14T22:13:20.000Z', 'export stamps an ISO time');
        assert(exported.decay.lastAt === '2023-11-14T22:13:20.000Z', 'export stamps decay as ISO');
        assert(exported.words.length === 3 && exported.derankedArticleIds.length === 2, 'export carries the profile');
        const reparsed = JSON.parse(serializeLearningProfile(profile, 1_700_000_000_000)) as {
            signals: Record<string, boolean>;
        };
        assert(reparsed.signals['star'] === true, 'serialized export keeps signal switches');
        assert(
            profileFileName(1_700_000_000_000) === 'rss-learning-profile-2023-11-14.json',
            'export filename is dated',
        );
        assert(formatWeight(8) === '+8' && formatWeight(-2.5) === '-2.5', 'weights show their sign');

        // ---- a switched-off signal accrues nothing ----
        mem.clear();
        setSignalEnabled('dwell', false);
        accrueEngagement('Rust Tools', 5, 'c3', 100, 'dwell');
        assert(Object.keys(loadWordMap()).length === 0, 'a switched-off signal teaches no words');
        assert(Object.keys(loadEngagementTotals()).length === 0, 'a switched-off signal writes no ledger');
        setSignalEnabled('dwell', true);
        accrueEngagement('Rust Tools', 5, 'c3', 100, 'dwell');
        assert(loadWordMap()['rust'] === 5 && loadWordMap()['tools'] === 5, 're-enabled dwell teaches again');
        assert(loadEngagementTotals()['c3:dwell'] === 5, 're-enabled dwell records the ledger entry');

        // ---- a switched-off decay freezes the map ----
        mem.clear();
        saveWordMap({ rust: 4 });
        store.setItem('rss-reader:engagement-decayed-at', '1');
        setSignalEnabled('decay', false);
        decayLearnedIfDue(Date.now());
        assert(loadWordMap()['rust'] === 4, 'decay off leaves weights alone');
        assert(store.getItem('rss-reader:engagement-decayed-at') === '1', 'decay off does not move the clock');
        setSignalEnabled('decay', true);
        decayLearnedIfDue(Date.now());
        assert(loadWordMap()['rust'] === 2, 'decay on halves the weight');
        assert(store.getItem('rss-reader:engagement-decayed-at') !== '1', 'decay on moves the clock');

        // ---- star learning off stops seeding from likes ----
        const { interestingWordMapOf } = await import('../src/web-components/article-list/article-list-interesting');
        const starredArticle = {
            id: 'z1',
            feedId: 'f1',
            guid: 'z1',
            title: 'Zebra Painting',
            published: 0,
            fetchedAt: 0,
            read: 0,
            starred: true,
            popularity: 0,
            hot: 0,
        } as Article;
        mem.clear();
        saveWordMap({ rust: 4 });
        setSignalEnabled('star', true);
        const withStars = interestingWordMapOf([starredArticle], [{ title: 'Kubernetes Notes' }]);
        assert(withStars['zebra'] === 4 && withStars['kubernetes'] === 4, 'star learning seeds likes');
        setSignalEnabled('star', false);
        const withoutStars = interestingWordMapOf([starredArticle], [{ title: 'Kubernetes Notes' }]);
        assert(
            withoutStars['rust'] === 4 && withoutStars['zebra'] === undefined,
            'star learning off leaves the cached map alone',
        );

        // ---- one-tap forget clears learned state, keeps choices ----
        mem.clear();
        saveWordMap({ rust: 4 });
        store.setItem('rss-reader:deranked-ids', JSON.stringify(['a9']));
        store.setItem('rss-reader:engagement-totals', JSON.stringify({ 'a9:share': 4 }));
        store.setItem('rss-reader:word-map-ids', JSON.stringify(['a9']));
        store.setItem('rss-reader:engagement-decayed-at', '5');
        store.setItem('rss-reader:interesting-counts', JSON.stringify({ f1: 3 }));
        store.setItem('rss-reader:interesting-shadow', JSON.stringify({ f1: true }));
        setSignalEnabled('dwell', false);
        forgetLearning();
        assert(Object.keys(loadWordMap()).length === 0, 'forget clears the word map');
        assert(Object.keys(loadEngagementTotals()).length === 0, 'forget clears the ledger');
        assert(loadDerankedIds().length === 0, 'forget clears deranks');
        assert(store.getItem('rss-reader:word-map-ids') === null, 'forget clears the counted ids');
        assert(store.getItem('rss-reader:engagement-decayed-at') === null, 'forget clears the decay clock');
        assert(store.getItem('rss-reader:interesting-counts') === null, 'forget clears the badge counts');
        assert(isSignalEnabled('dwell') === false, 'forget keeps the signal switches');
        assert(store.getItem('rss-reader:interesting-shadow') !== null, 'forget keeps folder settings');
    } finally {
        if (realWindow === undefined) delete shims['window'];
        else shims['window'] = realWindow;
        if (realStorage === undefined) delete shims['localStorage'];
        else shims['localStorage'] = realStorage;
    }
}
