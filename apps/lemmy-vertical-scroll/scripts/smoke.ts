import {
    ApiError,
    fetchCommunities,
    fetchCommunity,
    fetchCommunityPosts,
    fetchPosts,
    fetchSite,
    normalizeInstanceUrl,
} from '../src/services/lemmy'
import {
    fetchPiefedCommunities,
    fetchPiefedCommunity,
    fetchPiefedCommunityPosts,
    fetchPiefedCommunitySearch,
    fetchPiefedPosts,
    fetchPiefedSite,
} from '../src/services/piefed'
import {compactNumber, timeAgo} from '../src/services/format'
import {
    aspectRatioFromUrl,
    classifyPost,
    extractImageUrls,
    isRedgifsUrl,
    redgifsId,
    resolveVideoUrl,
    stripImageProxy,
} from '../src/services/post-media'
import {safeUrl} from '../src/services/url'
import {parseView, viewToPath} from '../src/router'
import {POST_SORTS, PIEFED_POST_SORTS, postSortsFor} from '../src/types'
import type {LemmyPost} from '../src/types'

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`)
}

function mockFetchImpl(body: unknown, status = 200, throws = false): typeof fetch {
    const impl = async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        if (throws) throw new TypeError('network down')
        return new Response(status >= 400 ? JSON.stringify({error: 'invalid_sort'}) : JSON.stringify(body), {
            status,
            headers: {'Content-Type': 'application/json'},
        })
    }
    return impl as unknown as typeof fetch
}

let lastRequest: {url: string} | null = null
function capturingFetchImpl(body: unknown, status = 200): typeof fetch {
    return (async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        lastRequest = {url: String(input)}
        return mockFetchImpl(body, status)(input)
    }) as unknown as typeof fetch
}

function request(): URL {
    if (!lastRequest) throw new Error('FAIL: no request captured')
    return new URL(lastRequest.url)
}

function query(): URLSearchParams {
    return request().searchParams
}

/** Returns one response per request, in order, then repeats the last. */
function fetchSequence(bodies: unknown[], status = 200): typeof fetch {
    let index = 0
    return (async (input: string | URL | Request): Promise<Response> => {
        lastRequest = {url: String(input)}
        const body = bodies[Math.min(index, bodies.length - 1)]
        index++
        return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})
    }) as unknown as typeof fetch
}

// ---- normalizeInstanceUrl ----

assert(normalizeInstanceUrl('https://lemmy.ml/') === 'lemmy.ml', 'strips protocol and slash')
assert(normalizeInstanceUrl('sh.itjust.works') === 'sh.itjust.works', 'bare host passes through')
assert(normalizeInstanceUrl('  lemmy.world  ') === 'lemmy.world', 'trims whitespace')
assert(normalizeInstanceUrl('https://www.lemmy.ml/x') === 'www.lemmy.ml', 'keeps subdomain, drops path')
assert(normalizeInstanceUrl('http://localhost:8080') === 'localhost:8080', 'allows localhost with port')
assert(normalizeInstanceUrl('') === null, 'empty input rejected')
assert(normalizeInstanceUrl('not a url') === null, 'garbage rejected')
assert(normalizeInstanceUrl('lemmy') === null, 'single label rejected')

// ---- fetchPosts ----

const rawPost = {
    post: {
        id: 1,
        name: 'Hello world',
        url: 'https://example.com/hello',
        body: null,
        thumbnail_url: 'https://example.com/t.png',
        nsfw: false,
        pinned_local: false,
        pinned_community: false,
        published: '2026-01-01T00:00:00Z',
        community_id: 7,
        ap_id: 'https://lemmy.ca/post/12345',
        post_url_content_type: 'Link',
    },
    community: {
        id: 7,
        name: 'main',
        title: 'Main',
        actor_id: 'https://lemmy.ml/c/main',
        local: true,
        icon: null,
        banner: null,
        description: null,
        published: '2026-01-01T00:00:00Z',
    },
    creator: {actor_id: 'https://lemmy.ml/u/bob', name: 'bob', display_name: 'Bob', avatar: null},
    counts: {score: 42, upvotes: 50, downvotes: 8, comments: 3},
    my_vote: null,
}

void (async () => {
    const page = await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 2, limit: 20},
        capturingFetchImpl({posts: [rawPost]}),
    )
    assert(request().pathname === '/api/v3/post/list', 'posts hit post/list endpoint')
    assert(query().get('type_') === 'All' && query().get('sort') === 'Hot', 'posts send type_/sort')
    assert(query().get('page') === '2' && query().get('limit') === '20', 'posts send page/limit')
    assert(query().get('nsfw') === 'Include', 'posts default to including nsfw')

    await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude'},
        capturingFetchImpl({posts: []}),
    )
    assert(query().get('nsfw') === 'Exclude', 'posts forward nsfwFilter Exclude')
    await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Only'},
        capturingFetchImpl({posts: []}),
    )
    assert(query().get('nsfw') === 'Only', 'posts forward nsfwFilter Only')
    assert(page.posts.length === 1, 'posts mapped')
    assert(page.posts[0].communityTitle === 'Main', 'community title mapped')
    assert(page.posts[0].score === 42 && page.posts[0].comments === 3, 'counts mapped')
    assert(page.posts[0].creatorDisplayName === 'Bob', 'creator mapped')
    assert(page.posts[0].postUrl === 'https://lemmy.ca/post/12345', 'ap_id mapped to postUrl')
    assert(page.posts[0].postType === 'Link' && page.posts[0].linkUrl === 'https://example.com/hello', 'link post classified')

    await assertRejects(
        () => fetchPosts({instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20}, mockFetchImpl({}, 400)),
        (e) => e instanceof ApiError && e.status === 400 && e.message.includes('invalid_sort'),
        'non-ok response becomes ApiError with status',
    )
    await assertRejects(
        () => fetchPosts({instance: 'fedinsfw.app', feedType: 'All', sort: 'Hot', page: 1, limit: 20}, mockFetchImpl({}, 404)),
        (e) =>
            e instanceof ApiError &&
            e.status === 404 &&
            /does not appear to run a Lemmy-compatible API/.test(e.message) &&
            /PieFed/.test(e.message),
        '404 maps to a PieFed-style compatibility hint',
    )
    await assertRejects(
        () => fetchPosts({instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20}, mockFetchImpl({}, 200, true)),
        (e) => e instanceof ApiError && /Could not reach/.test(e.message),
        'network failure becomes ApiError',
    )
    await assertRejects(
        () =>
            fetchPosts(
                {instance: 'slow.instance', feedType: 'All', sort: 'Hot', page: 1, limit: 20},
                (async () => {
                    throw new DOMException('The operation was aborted.', 'TimeoutError')
                }) as typeof fetch,
            ),
        (e) => e instanceof ApiError && /timed out/.test(e.message),
        'hung requests surface as a timeout ApiError',
    )

    // ---- fetchCommunities / fetchCommunityPosts / fetchSite ----

    await fetchCommunities(
        {instance: 'lemmy.ml', sort: 'TopMonth', page: 1, limit: 20, search: 'rust'},
        capturingFetchImpl({communities: []}),
    )
    assert(request().pathname === '/api/v3/community/list', 'communities hit community/list')
    assert(query().get('search') === 'rust', 'search param forwarded')
    assert(query().get('sort') === 'TopMonth' && query().get('type_') === 'All', 'community sort params')

    await fetchCommunityPosts(
        {instance: 'lemmy.ml', communityId: 7, sort: 'New', page: 1, limit: 20},
        capturingFetchImpl({posts: [rawPost]}),
    )
    assert(query().get('community_id') === '7', 'community posts send community_id')

    await fetchSite('lemmy.ml', capturingFetchImpl({site_view: {site: {name: 'Lemmy', actor_id: 'https://lemmy.ml', version: '0.19.4', icon: null, description: null}}}))
    assert(request().pathname === '/api/v3/site', 'site hits site endpoint')

    const piefedSite = await fetchSite('fedinsfw.app', capturingFetchImpl({site_view: {site: {name: 'FediNSFW', actor_id: 'https://fedinsfw.app/', version: '', icon: null, description: null}}}))
    assert(piefedSite.site.version === '' && piefedSite.software === 'unknown', 'empty-version site stays unknown when alpha probe fails')

    const detectedSite = await fetchSite('fedinsfw.app', fetchSequence([
        {site_view: {site: {name: 'FediNSFW', actor_id: 'https://fedinsfw.app/', version: '', icon: null, description: null}}},
        {version: '1.7.8'},
    ]))
    assert(detectedSite.software === 'piefed' && detectedSite.site.version === '1.7.8', 'alpha version probe detects PieFed')

    const lemmySite = await fetchSite('lemmy.ml', capturingFetchImpl({site_view: {site: {name: 'Lemmy', actor_id: 'https://lemmy.ml', version: '0.19.4', icon: null, description: null}}}))
    assert(lemmySite.software === 'lemmy', 'versioned site is lemmy')

    // ---- piefed provider ----

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
        community: {id: 7, name: 'nsfw', title: 'NSFW', actor_id: 'https://fedinsfw.app/c/nsfw', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'},
        creator: {user_name: 'bob', title: 'Bob', avatar: null, actor_id: 'https://fedinsfw.app/u/bob'},
        counts: {score: 42, upvotes: 50, downvotes: 8, comments: 3},
        my_vote: 0,
    }

    const pp = await fetchPiefedPosts(
        {instance: 'fedinsfw.app', feedType: 'All', sort: 'Hot', page: 2, limit: 20},
        capturingFetchImpl({posts: [piefedPost]}),
    )
    assert(request().pathname === '/api/alpha/post/list', 'piefed posts hit alpha post/list')
    assert(
        query().get('type_') === 'All' && query().get('sort') === 'Hot' && query().get('page') === '2',
        'piefed post params',
    )
    assert(query().get('nsfw') === 'Include', 'piefed posts default to including nsfw')
    await fetchPiefedPosts(
        {instance: 'fedinsfw.app', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude'},
        capturingFetchImpl({posts: []}),
    )
    assert(query().get('nsfw') === 'Exclude', 'piefed posts forward nsfwFilter')
    assert(pp.posts[0].communityTitle === 'NSFW' && pp.posts[0].score === 42, 'piefed post mapped')
    assert(pp.posts[0].creatorDisplayName === 'Bob' && pp.posts[0].pinnedLocal, 'piefed creator/sticky mapped')
    assert(pp.posts[0].nsfw === true, 'piefed nsfw mapped')

    await fetchPiefedCommunityPosts(
        {instance: 'fedinsfw.app', communityId: 7, sort: 'New', page: 1, limit: 20},
        capturingFetchImpl({posts: [piefedPost]}),
    )
    assert(query().get('community_id') === '7', 'piefed community posts send community_id')

    const pc =     await fetchPiefedCommunities(
        {instance: 'fedinsfw.app', sort: 'Hot', page: 1, limit: 20},
        capturingFetchImpl({communities: [{community: {id: 1, name: 'main', title: 'Main', actor_id: 'https://fedinsfw.app/c/main', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'}, counts: {subscriptions_count: 10, post_count: 5, post_reply_count: 2, published: '2026-01-01T00:00:00Z'}, subscribed: 'NotSubscribed', blocked: false}]}),
    )
    assert(request().pathname === '/api/alpha/community/list', 'piefed communities hit alpha community/list')
    assert(query().get('show_nsfw') === 'true', 'piefed community list shows nsfw by default')
    await fetchPiefedCommunities(
        {instance: 'fedinsfw.app', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude'},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('show_nsfw') === 'false', 'piefed community list hides nsfw in Exclude mode')
    await fetchPiefedCommunities(
        {instance: 'fedinsfw.app', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Only'},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('show_nsfw') === 'true', 'piefed Only degrades to showing nsfw (boolean API)')
    assert(pc.communities[0].subscribers === 10 && pc.communities[0].posts === 5 && pc.communities[0].comments === 2, 'piefed community counts mapped')

    const searchHits = await fetchPiefedCommunitySearch('fedinsfw.app', 'nsfw', 20, capturingFetchImpl({communities: [{community: {id: 2, name: 'nsfw2', title: 'NSFW2', actor_id: 'https://fedinsfw.app/c/nsfw2', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'}, counts: {subscriptions_count: 1, post_count: 1, post_reply_count: 1, published: '2026-01-01T00:00:00Z'}, subscribed: 'NotSubscribed', blocked: false}]}))
    assert(request().pathname === '/api/alpha/search' && query().get('type_') === 'Communities', 'piefed search hits alpha search')
    assert(searchHits.length === 1 && searchHits[0].name === 'nsfw2', 'piefed search mapped')

    const single = await fetchPiefedCommunity('fedinsfw.app', 7, capturingFetchImpl({community_view: {community: {id: 7, name: 'x', title: 'X', actor_id: 'https://fedinsfw.app/c/x', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'}, counts: {subscriptions_count: 3, post_count: 2, post_reply_count: 1, published: '2026-01-01T00:00:00Z'}, subscribed: 'Subscribed', blocked: false}}))
    assert(single.subscribed === true && single.id === 7, 'piefed community by id mapped')

    const alphaSite = await fetchPiefedSite('fedinsfw.app', capturingFetchImpl({site: {name: 'FediNSFW', actor_id: 'https://fedinsfw.app/', icon: null, description: null}, version: '1.7.8'}))
    assert(alphaSite.software === 'piefed' && alphaSite.site.version === '1.7.8', 'piefed site mapped')

    await fetchCommunity('lemmy.ml', 7, capturingFetchImpl({community_view: {community: rawPost.community, counts: {subscribers: 10, posts: 5, comments: 2}, subscribed: 'NotSubscribed', blocked: false}}))
    assert(request().pathname === '/api/v3/community' && query().get('id') === '7', 'community by id')

    // ---- format ----

    const now = Date.parse('2026-01-02T00:00:00Z')
    assert(timeAgo('2026-01-01T00:00:00Z', now) === '1d', 'timeAgo days')
    assert(timeAgo('2026-01-01T23:00:00Z', now) === '1h', 'timeAgo hours')
    assert(timeAgo('2026-01-01T23:59:00Z', now) === '1m', 'timeAgo minutes')
    assert(timeAgo('2026-01-01T23:59:58Z', now) === 'just now', 'timeAgo seconds')
    assert(timeAgo('2027-01-01T00:00:00Z', now) === '', 'future timestamps render empty')
    assert(compactNumber(1234) === '1.2K', 'compact K')
    assert(compactNumber(3400000) === '3.4M', 'compact M')
    assert(compactNumber(42) === '42', 'compact plain')

    // ---- router ----

    assert(parseView('/').kind === 'feed', 'root parses to feed')
    assert(parseView('').kind === 'feed', 'empty path parses to feed')
    assert(parseView('/communities').kind === 'communities', 'communities view')
    const comm = parseView('/community/123')
    assert(comm.kind === 'community' && comm.communityId === 123, 'community view with id')
    assert(parseView('/community/abc').kind === 'communities', 'bad community id falls back')
    assert(parseView('/settings').kind === 'settings', 'settings view')
    assert(viewToPath(parseView('/community/5')) === '/community/5', 'view roundtrip')
    assert(viewToPath({kind: 'feed'}) === '/', 'feed path')

    // ---- post-media classification ----

    function makePost(overrides: Partial<LemmyPost>): LemmyPost {
        return {
            id: 1,
            name: 'p',
            url: null,
            body: null,
            thumbnailUrl: null,
            nsfw: false,
            pinnedLocal: false,
            pinnedCommunity: false,
            published: '2026-01-01T00:00:00Z',
            communityId: 1,
            communityName: 'c',
            communityActorId: 'https://x/c',
            communityTitle: 'C',
            communityIcon: null,
            creatorActorId: 'https://x/u',
            creatorName: 'u',
            creatorDisplayName: null,
            creatorAvatar: null,
            score: 0,
            upvotes: 0,
            downvotes: 0,
            comments: 0,
            myVote: null,
            postUrl: 'https://x/post/1',
            postType: null,
            imageUrls: [],
            videoUrl: null,
            linkUrl: null,
            ...overrides,
        }
    }

    assert(
        classifyPost(makePost({postType: 'Image', url: 'https://x/img.jpeg'})) === 'image',
        'piefed image type classifies image',
    )
    assert(
        classifyPost(makePost({postType: 'Video', url: 'https://x/vid.mp4'})) === 'video',
        'piefed video type classifies video',
    )
    assert(classifyPost(makePost({postType: 'Discussion', body: 'hi'})) === 'text', 'discussion classifies text')
    assert(
        classifyPost(makePost({postType: 'Link', url: 'https://x/article'})) === 'link',
        'link with plain url classifies link',
    )
    assert(
        classifyPost(makePost({url: 'https://lemmy.ml/api/v3/image_proxy?url=https%3A%2F%2Fx%2Fpic.png'})) === 'image',
        'image_proxy url decodes to image',
    )
    assert(classifyPost(makePost({url: 'https://x/movie.webm'})) === 'video', 'webm url classifies video')
    assert(classifyPost(makePost({url: 'https://x/a.jpeg?w=100'})) === 'image', 'query-string extension classifies image')
    assert(classifyPost(makePost({body: 'just text'})) === 'text', 'body-only post classifies text')

    assert(
        stripImageProxy('https://x/api/v3/image_proxy?url=https%3A%2F%2Freal.example%2Fpic.jpeg') ===
            'https://real.example/pic.jpeg',
        'image_proxy decodes',
    )
    assert(stripImageProxy('https://x/plain.jpeg') === 'https://x/plain.jpeg', 'non-proxy url unchanged')

    const gallery = makePost({
        url: 'https://x/main.png',
        body: 'see ![one](https://x/one.png) and ![two](https://x/two.webp) plus ![main](https://x/main.png)',
    })
    const galleryUrls = extractImageUrls(gallery)
    assert(galleryUrls.length === 3, 'primary + body images collected')
    assert(galleryUrls[0] === 'https://x/main.png' && galleryUrls.includes('https://x/one.png'), 'gallery order and dedupe')
    assert(
        extractImageUrls(makePost({body: '![link](https://x/doc.pdf)'})).length === 0,
        'non-image body links ignored',
    )
    assert(aspectRatioFromUrl('https://x/foo_1280x720.png') === 16 / 9, 'pictrs aspect ratio parsed')

    // ---- redgifs embeds ----

    assert(redgifsId('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound') === 'steeldeadlyitaliangreyhound', 'redgifs watch id')
    assert(redgifsId('https://redgifs.com/ifr/abc123') === 'abc123', 'redgifs ifr id')
    assert(redgifsId('https://media.redgifs.com/SteelDeadlyItaliangreyhound-mobile.mp4') === null, 'media file is not a page id')
    assert(redgifsId('https://example.com/watch/xyz') === null, 'non-redgifs url rejected')
    assert(isRedgifsUrl('https://www.redgifs.com/watch/xyz'), 'isRedgifsUrl true')
    assert(!isRedgifsUrl('https://x.com/v.mp4'), 'isRedgifsUrl false for direct file')

    assert(
        classifyPost(makePost({postType: 'Link', url: 'https://www.redgifs.com/watch/steeldeadlyitaliangreyhound'})) === 'video',
        'lemmy redgifs link classifies video',
    )
    assert(
        classifyPost(makePost({url: 'https://redgifs.com/watch/abc'})) === 'video',
        'untyped redgifs url classifies video',
    )

    const direct = await resolveVideoUrl('https://x.com/video.mp4')
    assert(direct.src === 'https://x.com/video.mp4' && direct.poster === null && direct.candidates.length === 0, 'direct video passes through')
    const unsafeVideo = await resolveVideoUrl('javascript:alert(1)')
    assert(unsafeVideo.src === null, 'unsafe direct video url rejected')

    // redgifs resolves exact-case media via the CORS-open oEmbed endpoint
    const oembedFetch = (thumbnail: string | null): typeof fetch =>
        (async (input: string | URL | Request): Promise<Response> => {
            if (!String(input).includes('/v1/oembed')) return new Response('bad', {status: 500})
            return new Response(JSON.stringify({thumbnail_url: thumbnail}), {
                status: thumbnail ? 200 : 404,
                headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            })
        }) as unknown as typeof fetch

    const rg = await resolveVideoUrl(
        'https://www.redgifs.com/watch/steeldeadlyitaliangreyhound',
        oembedFetch('https://media.redgifs.com/SteelDeadlyItaliangreyhound-poster.jpg'),
    )
    assert(
        rg.src === 'https://media.redgifs.com/SteelDeadlyItaliangreyhound-mobile.mp4' &&
            rg.poster === 'https://media.redgifs.com/SteelDeadlyItaliangreyhound-poster.jpg' &&
            rg.candidates.length === 3,
        'redgifs resolves exact-case mobile mp4 with poster via oEmbed',
    )
    assert(
        rg.candidates[1] === 'https://media.redgifs.com/SteelDeadlyItaliangreyhound.mp4' &&
            rg.candidates[2] === 'https://media.redgifs.com/SteelDeadlyItaliangreyhound-silent.mp4',
        'redgifs candidate order is mobile, plain, silent',
    )
    const rgIframe = await resolveVideoUrl(
        'https://redgifs.com/ifr/abc123',
        oembedFetch('https://media.redgifs.com/Abc123-poster.jpg'),
    )
    assert(rgIframe.src === 'https://media.redgifs.com/Abc123-mobile.mp4', 'redgifs ifr url resolves too')

    // oEmbed failure (removed/unknown gif) falls back to the lowercase slug
    const rgFallback = await resolveVideoUrl('https://www.redgifs.com/watch/azurejoyouskentrosaurus', oembedFetch(null))
    assert(rgFallback.src === 'https://media.redgifs.com/azurejoyouskentrosaurus-mobile.mp4', 'oEmbed failure uses lowercase slug')

    // memoized: same id resolves from cache without another oEmbed call
    let oembedCalls = 0
    const countingFetch = (async (input: string | URL | Request): Promise<Response> => {
        if (String(input).includes('/v1/oembed')) oembedCalls++
        return oembedFetch('https://media.redgifs.com/MemoCacheClip-poster.jpg')(input)
    }) as unknown as typeof fetch
    await resolveVideoUrl('https://www.redgifs.com/watch/memocacheclip', countingFetch)
    await resolveVideoUrl('https://www.redgifs.com/watch/memocacheclip', countingFetch)
    assert(oembedCalls === 1, 'redgifs oEmbed lookup memoized')

    // ---- url safety ----

    assert(safeUrl('https://example.com/post/1') === 'https://example.com/post/1', 'https url passes')
    assert(safeUrl('http://example.com/x') === 'http://example.com/x', 'http url passes')
    assert(safeUrl('javascript:alert(1)') === null, 'javascript url rejected')
    assert(safeUrl('data:text/html,<script>') === null, 'data url rejected')
    assert(safeUrl('vbscript:msgbox(1)') === null, 'vbscript url rejected')
    assert(safeUrl('not a url') === null, 'unparseable url rejected')
    assert(safeUrl(null) === null, 'null url rejected')

    // ---- response validation ----

    await assertRejects(
        () => fetchPosts({instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20}, mockFetchImpl({}, 200)),
        (e) => e instanceof ApiError && e.status === 200 && /Unexpected response/.test(e.message),
        'non-JSON 200 body becomes an ApiError',
    )
    await assertRejects(
        () => fetchSite('lemmy.ml', mockFetchImpl({some: 'html-ish json'}, 200)),
        (e) => e instanceof ApiError && /Unexpected response/.test(e.message),
        'malformed site response becomes an ApiError',
    )
    await assertRejects(
        () => fetchCommunities({instance: 'lemmy.ml', sort: 'Hot', page: 1, limit: 20}, mockFetchImpl({posts: []}, 200)),
        (e) => e instanceof ApiError && /Unexpected response/.test(e.message),
        'wrong-shaped community list becomes an ApiError',
    )

    // timeout vs network error messaging
    await assertRejects(
        () =>
            fetchPosts(
                {instance: 'slow.instance', feedType: 'All', sort: 'Hot', page: 1, limit: 20},
                (async () => {
                    throw new DOMException('The operation was aborted.', 'TimeoutError')
                }) as typeof fetch,
            ),
        (e) => e instanceof ApiError && /timed out/.test(e.message),
        'timeout keeps its message',
    )
    await assertRejects(
        () =>
            fetchPosts(
                {instance: 'down.instance', feedType: 'All', sort: 'Hot', page: 1, limit: 20},
                (async () => {
                    throw new TypeError('Failed to fetch')
                }) as typeof fetch,
            ),
        (e) => e instanceof ApiError && /network error/.test(e.message) && !/timed out/.test(e.message),
        'non-timeout network errors are labeled network errors',
    )

    // ---- lemmy community nsfw param ----

    await fetchCommunities(
        {instance: 'lemmy.ml', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude'},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('show_nsfw') === 'false', 'lemmy community list forwards Exclude as show_nsfw')

    // ---- sorts ----

    for (const sort of ['Active', 'Hot', 'New', 'TopDay', 'TopAll', 'Controversial', 'Scaled']) {
        assert(POST_SORTS.includes(sort as never), `sort ${sort} covered`)
    }
    assert(PIEFED_POST_SORTS.length === 16, 'piefed post sorts are a curated subset')
    assert(postSortsFor('piefed').includes('TopAll') && !postSortsFor('piefed').includes('Controversial'), 'piefed sort filtering')
    assert(postSortsFor('lemmy').length === POST_SORTS.length, 'lemmy keeps full sort list')

    console.log('smoke.ts: all assertions passed')
})().catch((e) => {
    console.error(e)
    throw e
})

async function assertRejects(
    fn: () => Promise<unknown>,
    predicate: (e: unknown) => boolean,
    msg: string,
): Promise<void> {
    try {
        await fn()
        throw new Error(`FAIL: ${msg} (did not reject)`)
    } catch (e) {
        if (!predicate(e)) throw new Error(`FAIL: ${msg}: ${e instanceof Error ? e.message : String(e)}`)
    }
}
