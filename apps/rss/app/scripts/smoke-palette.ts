// Command palette smoke: the pure fuzzy matcher and the command registry.
import { assert } from './smoke-assert';

const shims = globalThis as Record<string, unknown>;
const mem = new Map<string, string>();
shims['localStorage'] = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
};

// ---- fuzzy matcher ----
{
    const { fuzzyScore } = await import('../src/services/palette-match');
    assert(fuzzyScore('', 'anything')?.score === 0, 'an empty query matches everything');
    assert(fuzzyScore('cards', 'Cards view') !== null, 'matching is case-insensitive');
    assert(fuzzyScore('crdsvw', 'Cards view') !== null, 'a subsequence matches');
    assert(fuzzyScore('xyz', 'Cards view') === null, 'a non-subsequence does not match');
    const word = fuzzyScore('cv', 'Cards view')!;
    const noWord = fuzzyScore('cv', 'Detailed cards overview')!;
    assert(word.score > noWord.score, 'a word-start match scores higher');
    const early = fuzzyScore('cards', 'Cards view')!;
    const late = fuzzyScore('cards', 'A cards view')!;
    assert(early.score > late.score, 'an earlier match scores higher');
    assert(fuzzyScore('cards', 'Cards view')!.indices.join(',') === '0,1,2,3,4', 'matched indices are returned');
}

// ---- registry ----
{
    const { buildCommands } = await import('../src/services/commands');
    const calls: string[] = [];
    const ctx = {
        navigate: (view: {
            kind: string;
            q?: string | undefined;
            scope?: string | undefined;
            id?: string | undefined;
            savedId?: string | undefined;
        }) => calls.push(`navigate:${view.kind}${view.savedId ? `:${view.q ?? ''}` : ''}`),
        star: () => calls.push('star'),
        markShownRead: () => calls.push('mark-read'),
        refresh: () => calls.push('refresh'),
        setListView: (view: string) => calls.push(`list:${view}`),
        setSort: (sort: string) => calls.push(`sort:${sort}`),
        toggleUnread: () => calls.push('unread'),
        toggleSelect: () => calls.push('select'),
        openSettings: () => calls.push('settings'),
        openShortcuts: () => calls.push('shortcuts'),
    };
    mem.set('rss-reader:interesting-shadow', JSON.stringify({ f2: true }));
    mem.set('rss-reader:interesting-order', JSON.stringify(['f2']));
    const commands = buildCommands(
        {
            folders: [
                { id: 'f1', title: 'Tech' },
                { id: 'f2', title: 'Cars' },
            ],
            feeds: [{ id: 'fd1', title: 'Tesla Watch' }],
            savedSearches: [{ id: 'ss1', title: 'Tesla unread', query: 'tesla is:unread', scopeKind: 'all' }],
        },
        ctx,
    );
    const ids = commands.map((c) => c.id);
    for (const id of [
        'all',
        'frontpage',
        'brief',
        'today',
        'saved',
        'search',
        'settings-organize',
        'settings-mute-filters',
        'settings-privacy',
        'settings',
        'shortcuts',
        'folder:f1',
        'feed:fd1',
        'interesting:f2',
        'saved-search:ss1',
        'sort-hot',
        'sort-newest',
        'sort-oldest',
        'unread-only',
        'star',
        'mark-shown-read',
        'refresh',
        'view-detailed',
        'view-headline',
        'view-cards',
        'select',
    ]) {
        assert(ids.includes(id), `the palette registry has ${id}`);
    }
    const find = (id: string) => commands.find((c) => c.id === id)!;
    find('all').run();
    find('folder:f1').run();
    find('interesting:f2').run();
    find('saved-search:ss1').run();
    find('star').run();
    find('sort-newest').run();
    assert(calls.includes('navigate:all'), 'a go command navigates');
    assert(calls.includes('navigate:folder'), 'a folder go command navigates');
    assert(calls.includes('navigate:interesting'), 'an interesting go command navigates');
    assert(calls.includes('navigate:search:tesla is:unread'), 'a saved search go command carries its query');
    assert(calls.includes('star'), 'an act command runs');
    assert(calls.includes('sort:newest'), 'a filter command runs');
    assert(find('all').group === 'go' && find('star').group === 'act', 'commands carry their group');

    const nonList = buildCommands(
        {
            folders: [],
            feeds: [],
            savedSearches: [],
        },
        ctx,
        { listAvailable: false },
    );
    const nonListIds = nonList.map((c) => c.id);
    assert(!nonListIds.includes('star'), 'list act commands are omitted when no list is available');
    assert(!nonListIds.includes('sort-hot'), 'list filter commands are omitted when no list is available');
    assert(nonListIds.includes('settings'), 'global go commands remain available without a list');
}
