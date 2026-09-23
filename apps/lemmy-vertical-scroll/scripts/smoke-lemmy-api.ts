// Lemmy API smoke: instance URL normalization, post list, communities, site
// detection, community-by-id, nsfw param, error mapping.
import {
    ApiError,
    fetchCommunities,
    fetchCommunity,
    fetchCommunityPosts,
    fetchPosts,
    fetchSite,
    normalizeInstanceUrl,
} from '../src/services/lemmy';
import {
    assert,
    assertRejects,
    capturingAuthFetchImpl,
    capturingFetchImpl,
    fetchSequence,
    mockFetchImpl,
    query,
    rawPost,
    request,
} from './smoke-helpers';

// ---- normalizeInstanceUrl ----

export function runInstanceUrlTests(): void {
    assert(normalizeInstanceUrl('https://lemmy.ml/') === 'lemmy.ml', 'strips protocol and slash');
    assert(normalizeInstanceUrl('sh.itjust.works') === 'sh.itjust.works', 'bare host passes through');
    assert(normalizeInstanceUrl('  lemmy.world  ') === 'lemmy.world', 'trims whitespace');
    assert(normalizeInstanceUrl('https://www.lemmy.ml/x') === 'www.lemmy.ml', 'keeps subdomain, drops path');
    assert(normalizeInstanceUrl('http://localhost:8080') === 'localhost:8080', 'allows localhost with port');
    assert(normalizeInstanceUrl('') === null, 'empty input rejected');
    assert(normalizeInstanceUrl('not a url') === null, 'garbage rejected');
    assert(normalizeInstanceUrl('lemmy') === null, 'single label rejected');
}

// ---- fetchPosts ----

export async function runPostsTests(): Promise<void> {
    const page = await fetchPosts(
        { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 2, limit: 20 },
        capturingFetchImpl({ posts: [rawPost] }),
    );
    assert(request().pathname === '/api/v3/post/list', 'posts hit post/list endpoint');
    assert(query().get('type_') === 'All' && query().get('sort') === 'Hot', 'posts send type_/sort');
    assert(query().get('page') === '2' && query().get('limit') === '20', 'posts send page/limit');
    assert(query().get('nsfw') === 'Include', 'posts default to including nsfw');

    await fetchPosts(
        { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude' },
        capturingAuthFetchImpl({ posts: [] }),
    );
    assert(query().get('nsfw') === 'Exclude', 'posts forward nsfwFilter Exclude');
    await fetchPosts(
        { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Only' },
        capturingAuthFetchImpl({ posts: [] }),
    );
    assert(query().get('nsfw') === 'Only', 'posts forward nsfwFilter Only');
    assert(page.posts.length === 1, 'posts mapped');
    assert(page.posts[0]!.communityTitle === 'Main', 'community title mapped');
    assert(page.posts[0]!.score === 42 && page.posts[0]!.comments === 3, 'counts mapped');
    assert(page.posts[0]!.creatorDisplayName === 'Bob', 'creator mapped');
    assert(page.posts[0]!.postUrl === 'https://lemmy.ca/post/12345', 'ap_id mapped to postUrl');
    assert(
        page.posts[0]!.postType === 'Link' && page.posts[0]!.linkUrl === 'https://example.com/hello',
        'link post classified',
    );

    await assertRejects(
        () =>
            fetchPosts(
                { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20 },
                mockFetchImpl({}, 400),
            ),
        (e) => e instanceof ApiError && e.status === 400 && e.message.includes('invalid_sort'),
        'non-ok response becomes ApiError with status',
    );
    await assertRejects(
        () =>
            fetchPosts(
                { instance: 'fedinsfw.app', feedType: 'All', sort: 'Hot', page: 1, limit: 20 },
                mockFetchImpl({}, 404),
            ),
        (e) =>
            e instanceof ApiError &&
            e.status === 404 &&
            /does not appear to run a Lemmy-compatible API/.test(e.message) &&
            /PieFed/.test(e.message),
        '404 maps to a PieFed-style compatibility hint',
    );
    await assertRejects(
        () =>
            fetchPosts(
                { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20 },
                mockFetchImpl({}, 200, true),
            ),
        (e) => e instanceof ApiError && /Could not reach/.test(e.message),
        'network failure becomes ApiError',
    );
    await assertRejects(
        () =>
            fetchPosts({ instance: 'slow.instance', feedType: 'All', sort: 'Hot', page: 1, limit: 20 }, (async () => {
                throw new DOMException('The operation was aborted.', 'TimeoutError');
            }) as typeof fetch),
        (e) => e instanceof ApiError && /timed out/.test(e.message),
        'hung requests surface as a timeout ApiError',
    );
}

// ---- fetchCommunities / fetchCommunityPosts / fetchSite ----

export async function runSiteCommunityTests(): Promise<void> {
    await fetchCommunities(
        { instance: 'lemmy.ml', type: 'All', sort: 'TopMonth', page: 1, limit: 20, search: 'rust' },
        capturingFetchImpl({ communities: [] }),
    );
    assert(request().pathname === '/api/v3/community/list', 'communities hit community/list');
    assert(query().get('search') === 'rust', 'search param forwarded');
    assert(query().get('sort') === 'TopMonth' && query().get('type_') === 'All', 'community sort params');

    await fetchCommunities(
        { instance: 'lemmy.ml', type: 'Local', sort: 'Hot', page: 1, limit: 20 },
        capturingFetchImpl({ communities: [] }),
    );
    assert(query().get('type_') === 'Local', 'community listing type forwarded');

    await fetchCommunityPosts(
        { instance: 'lemmy.ml', communityId: 7, sort: 'New', page: 1, limit: 20 },
        capturingFetchImpl({ posts: [rawPost] }),
    );
    assert(query().get('community_id') === '7', 'community posts send community_id');

    await fetchSite(
        'lemmy.ml',
        capturingFetchImpl({
            site_view: {
                site: { name: 'Lemmy', actor_id: 'https://lemmy.ml', version: '0.19.4', icon: null, description: null },
            },
        }),
    );
    assert(request().pathname === '/api/v3/site', 'site hits site endpoint');

    const piefedSite = await fetchSite(
        'fedinsfw.app',
        capturingFetchImpl({
            site_view: {
                site: {
                    name: 'FediNSFW',
                    actor_id: 'https://fedinsfw.app/',
                    version: '',
                    icon: null,
                    description: null,
                },
            },
        }),
    );
    assert(
        piefedSite.site.version === '' && piefedSite.software === 'unknown',
        'empty-version site stays unknown when alpha probe fails',
    );

    const detectedSite = await fetchSite(
        'fedinsfw.app',
        fetchSequence([
            {
                site_view: {
                    site: {
                        name: 'FediNSFW',
                        actor_id: 'https://fedinsfw.app/',
                        version: '',
                        icon: null,
                        description: null,
                    },
                },
            },
            { version: '1.7.8' },
        ]),
    );
    assert(
        detectedSite.software === 'piefed' && detectedSite.site.version === '1.7.8',
        'alpha version probe detects PieFed',
    );

    const lemmySite = await fetchSite(
        'lemmy.ml',
        capturingFetchImpl({
            site_view: {
                site: { name: 'Lemmy', actor_id: 'https://lemmy.ml', version: '0.19.4', icon: null, description: null },
            },
        }),
    );
    assert(lemmySite.software === 'lemmy', 'versioned site is lemmy');

    // Modern Lemmy (0.19.19+) reports version at the top level, not on site_view.site
    const modernLemmy = await fetchSite(
        'modern.example',
        fetchSequence([
            {
                site_view: {
                    site: {
                        name: 'Modern',
                        actor_id: 'https://modern.example',
                        version: '',
                        icon: null,
                        description: null,
                    },
                },
                version: '0.19.19',
            },
            {}, // alpha probe returns nothing
        ]),
    );
    assert(modernLemmy.software === 'lemmy', 'modern lemmy detected via top-level version prefix');
    assert(modernLemmy.site.version === '0.19.19', 'modern lemmy version read from top level');

    // PieFed compat /api/v3/site also has a top-level version; alpha probe takes precedence
    const piefedCompat = await fetchSite(
        'piefed.example',
        fetchSequence([
            {
                site_view: {
                    site: {
                        name: 'Piefed',
                        actor_id: 'https://piefed.example',
                        version: '',
                        icon: null,
                        description: null,
                    },
                },
                version: '1.7.9',
            },
            { version: '1.7.9' },
        ]),
    );
    assert(piefedCompat.software === 'piefed', 'piefed detected via alpha probe despite compat top-level version');

    // PieFed top-level version alone (alpha probe failed) is still detected via 1.x prefix
    const piefedPrefix = await fetchSite(
        'piefed2.example',
        fetchSequence([
            {
                site_view: {
                    site: {
                        name: 'Piefed2',
                        actor_id: 'https://piefed2.example',
                        version: '',
                        icon: null,
                        description: null,
                    },
                },
                version: '1.7.9',
            },
            {}, // alpha probe returns nothing
        ]),
    );
    assert(piefedPrefix.software === 'piefed', 'piefed detected via 1.x version prefix');
}

// ---- community by id ----

export async function runCommunityByIdTests(): Promise<void> {
    await fetchCommunity(
        'lemmy.ml',
        7,
        capturingFetchImpl({
            community_view: {
                community: rawPost.community,
                counts: { subscribers: 10, posts: 5, comments: 2 },
                subscribed: 'NotSubscribed',
                blocked: false,
            },
        }),
    );
    assert(request().pathname === '/api/v3/community' && query().get('id') === '7', 'community by id');
}

// ---- response validation ----

export async function runErrorMappingTests(): Promise<void> {
    await assertRejects(
        () =>
            fetchPosts(
                { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20 },
                mockFetchImpl({}, 200),
            ),
        (e) => e instanceof ApiError && e.status === 200 && /Unexpected response/.test(e.message),
        'non-JSON 200 body becomes an ApiError',
    );
    await assertRejects(
        () => fetchSite('lemmy.ml', mockFetchImpl({ some: 'html-ish json' }, 200)),
        (e) => e instanceof ApiError && /Unexpected response/.test(e.message),
        'malformed site response becomes an ApiError',
    );
    await assertRejects(
        () =>
            fetchCommunities(
                { instance: 'lemmy.ml', type: 'All', sort: 'Hot', page: 1, limit: 20 },
                mockFetchImpl({ posts: [] }, 200),
            ),
        (e) => e instanceof ApiError && /Unexpected response/.test(e.message),
        'wrong-shaped community list becomes an ApiError',
    );

    // timeout vs network error messaging
    await assertRejects(
        () =>
            fetchPosts({ instance: 'slow.instance', feedType: 'All', sort: 'Hot', page: 1, limit: 20 }, (async () => {
                throw new DOMException('The operation was aborted.', 'TimeoutError');
            }) as typeof fetch),
        (e) => e instanceof ApiError && /timed out/.test(e.message),
        'timeout keeps its message',
    );
    await assertRejects(
        () =>
            fetchPosts({ instance: 'down.instance', feedType: 'All', sort: 'Hot', page: 1, limit: 20 }, (async () => {
                throw new TypeError('Failed to fetch');
            }) as typeof fetch),
        (e) => e instanceof ApiError && /network error/.test(e.message) && !/timed out/.test(e.message),
        'non-timeout network errors are labeled network errors',
    );
}

// ---- lemmy community nsfw param ----

export async function runCommunityNsfwTests(): Promise<void> {
    await fetchCommunities(
        { instance: 'lemmy.ml', type: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude' },
        capturingFetchImpl({ communities: [] }),
    );
    assert(query().get('show_nsfw') === 'false', 'lemmy community list forwards Exclude as show_nsfw');
}
