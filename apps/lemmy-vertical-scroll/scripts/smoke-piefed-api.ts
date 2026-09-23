// PieFed API smoke: alpha endpoints, post/community mapping, search, site.
import {
    fetchPiefedCommunities,
    fetchPiefedCommunity,
    fetchPiefedCommunityPosts,
    fetchPiefedCommunitySearch,
    fetchPiefedPosts,
    fetchPiefedSite,
} from '../src/services/piefed';
import { assert, capturingAuthFetchImpl, capturingFetchImpl, query, request } from './smoke-helpers';

// ---- piefed provider ----

export async function runPiefedTests(): Promise<void> {
    const piefedPost = {
        post: {
            id: 101,
            title: 'Hello piefed',
            body: 'body text',
            url: null,
            thumbnail_url: null,
            small_thumbnail_url: null,
            nsfw: true,
            sticky: false,
            instance_sticky: true,
            published: '2026-01-01T00:00:00Z',
            community_id: 7,
        },
        community: {
            id: 7,
            name: 'nsfw',
            title: 'NSFW',
            actor_id: 'https://fedinsfw.app/c/nsfw',
            local: true,
            icon: null,
            banner: null,
            description: null,
            published: '2026-01-01T00:00:00Z',
        },
        creator: { user_name: 'bob', title: 'Bob', avatar: null, actor_id: 'https://fedinsfw.app/u/bob' },
        counts: { score: 42, upvotes: 50, downvotes: 8, comments: 3 },
        my_vote: 0,
    };

    const pp = await fetchPiefedPosts(
        { instance: 'fedinsfw.app', feedType: 'All', sort: 'Hot', page: 2, limit: 20 },
        capturingFetchImpl({ posts: [piefedPost] }),
    );
    assert(request().pathname === '/api/alpha/post/list', 'piefed posts hit alpha post/list');
    assert(
        query().get('type_') === 'All' && query().get('sort') === 'Hot' && query().get('page') === '2',
        'piefed post params',
    );
    assert(query().get('nsfw') === 'Include', 'piefed posts default to including nsfw');
    await fetchPiefedPosts(
        { instance: 'fedinsfw.app', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude' },
        capturingAuthFetchImpl({ posts: [] }),
    );
    assert(query().get('nsfw') === 'Exclude', 'piefed posts forward nsfwFilter');
    assert(pp.posts[0]!.communityTitle === 'NSFW' && pp.posts[0]!.score === 42, 'piefed post mapped');
    assert(pp.posts[0]!.creatorDisplayName === 'Bob' && pp.posts[0]!.pinnedLocal, 'piefed creator/sticky mapped');
    assert(pp.posts[0]!.nsfw === true, 'piefed nsfw mapped');

    await fetchPiefedCommunityPosts(
        { instance: 'fedinsfw.app', communityId: 7, sort: 'New', page: 1, limit: 20 },
        capturingFetchImpl({ posts: [piefedPost] }),
    );
    assert(query().get('community_id') === '7', 'piefed community posts send community_id');

    const pc = await fetchPiefedCommunities(
        { instance: 'fedinsfw.app', type: 'All', sort: 'Hot', page: 1, limit: 20 },
        capturingFetchImpl({
            communities: [
                {
                    community: {
                        id: 1,
                        name: 'main',
                        title: 'Main',
                        actor_id: 'https://fedinsfw.app/c/main',
                        local: true,
                        icon: null,
                        banner: null,
                        description: null,
                        published: '2026-01-01T00:00:00Z',
                    },
                    counts: {
                        subscriptions_count: 10,
                        post_count: 5,
                        post_reply_count: 2,
                        published: '2026-01-01T00:00:00Z',
                    },
                    subscribed: 'NotSubscribed',
                    blocked: false,
                },
            ],
        }),
    );
    assert(request().pathname === '/api/alpha/community/list', 'piefed communities hit alpha community/list');
    assert(query().get('type_') === 'All', 'piefed community list defaults to All');
    await fetchPiefedCommunities(
        { instance: 'fedinsfw.app', type: 'Local', sort: 'Hot', page: 1, limit: 20 },
        capturingFetchImpl({ communities: [] }),
    );
    assert(query().get('type_') === 'Local', 'piefed community listing type forwarded');
    assert(query().get('show_nsfw') === 'true', 'piefed community list shows nsfw by default');
    await fetchPiefedCommunities(
        { instance: 'fedinsfw.app', type: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude' },
        capturingFetchImpl({ communities: [] }),
    );
    assert(query().get('show_nsfw') === 'false', 'piefed community list hides nsfw in Exclude mode');
    await fetchPiefedCommunities(
        { instance: 'fedinsfw.app', type: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Only' },
        capturingFetchImpl({ communities: [] }),
    );
    assert(query().get('show_nsfw') === 'true', 'piefed Only degrades to showing nsfw (boolean API)');
    assert(
        pc.communities[0]!.subscribers === 10 && pc.communities[0]!.posts === 5 && pc.communities[0]!.comments === 2,
        'piefed community counts mapped',
    );

    const searchHits = await fetchPiefedCommunitySearch(
        'fedinsfw.app',
        'nsfw',
        20,
        capturingFetchImpl({
            communities: [
                {
                    community: {
                        id: 2,
                        name: 'nsfw2',
                        title: 'NSFW2',
                        actor_id: 'https://fedinsfw.app/c/nsfw2',
                        local: true,
                        icon: null,
                        banner: null,
                        description: null,
                        published: '2026-01-01T00:00:00Z',
                    },
                    counts: {
                        subscriptions_count: 1,
                        post_count: 1,
                        post_reply_count: 1,
                        published: '2026-01-01T00:00:00Z',
                    },
                    subscribed: 'NotSubscribed',
                    blocked: false,
                },
            ],
        }),
    );
    assert(
        request().pathname === '/api/alpha/search' && query().get('type_') === 'Communities',
        'piefed search hits alpha search',
    );
    assert(query().get('listing_type') === 'All', 'piefed search defaults to All listing');
    await fetchPiefedCommunitySearch(
        'fedinsfw.app',
        'nsfw',
        20,
        capturingFetchImpl({ communities: [] }),
        'Include',
        'Local',
    );
    assert(query().get('listing_type') === 'Local', 'piefed search forwards Local listing');
    assert(searchHits.length === 1 && searchHits[0]!.name === 'nsfw2', 'piefed search mapped');

    const single = await fetchPiefedCommunity(
        'fedinsfw.app',
        7,
        capturingFetchImpl({
            community_view: {
                community: {
                    id: 7,
                    name: 'x',
                    title: 'X',
                    actor_id: 'https://fedinsfw.app/c/x',
                    local: true,
                    icon: null,
                    banner: null,
                    description: null,
                    published: '2026-01-01T00:00:00Z',
                },
                counts: {
                    subscriptions_count: 3,
                    post_count: 2,
                    post_reply_count: 1,
                    published: '2026-01-01T00:00:00Z',
                },
                subscribed: 'Subscribed',
                blocked: false,
            },
        }),
    );
    assert(single.subscribed === true && single.id === 7, 'piefed community by id mapped');

    const alphaSite = await fetchPiefedSite(
        'fedinsfw.app',
        capturingFetchImpl({
            site: { name: 'FediNSFW', actor_id: 'https://fedinsfw.app/', icon: null, description: null },
            version: '1.7.8',
        }),
    );
    assert(alphaSite.software === 'piefed' && alphaSite.site.version === '1.7.8', 'piefed site mapped');
}
