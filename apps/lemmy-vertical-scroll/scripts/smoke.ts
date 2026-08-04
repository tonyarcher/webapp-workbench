import {
    ApiError,
    fetchCommunities,
    fetchCommunity,
    fetchCommunityPosts,
    fetchPosts,
    fetchSite,
    loginLemmy,
    normalizeInstanceUrl,
} from '../src/services/lemmy'
import {
    fetchPiefedCommunities,
    fetchPiefedCommunity,
    fetchPiefedCommunityPosts,
    fetchPiefedCommunitySearch,
    fetchPiefedPosts,
    fetchPiefedSite,
    loginPiefed,
} from '../src/services/piefed'
import {compactNumber, timeAgo} from '../src/services/format'
import {embedPosterFor, embedProviderForUrl, embedUrlFor} from '../src/services/embeds'
import {
    aspectRatioFromUrl,
    classifyPost,
    extractImageUrls,
    resolveVideoUrl,
    stripImageProxy,
} from '../src/services/post-media'
import {fetchRegistryPopular, mergePopular, parseRegistryCsv, POPULAR_SERVERS} from '../src/services/registry'
import {clientFilterPosts} from '../src/query'
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

let lastRequestDetails: {url: string; method: string; headers: Headers; body: string} | null = null
/** Records method/headers/body so auth behavior can be asserted; also feeds `request()`/`query()`. */
function capturingAuthFetchImpl(body: unknown, status = 200): typeof fetch {
    return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        lastRequest = {url: String(input)}
        lastRequestDetails = {
            url: String(input),
            method: init?.method ?? 'GET',
            headers: new Headers(init?.headers),
            body: init?.body ? String(init.body) : '',
        }
        return mockFetchImpl(body, status)(input, init)
    }) as unknown as typeof fetch
}

function lastBody(): Record<string, unknown> {
    if (!lastRequestDetails) throw new Error('FAIL: no request captured')
    return JSON.parse(lastRequestDetails.body) as Record<string, unknown>
}

function lastHeaders(): Headers {
    if (!lastRequestDetails) throw new Error('FAIL: no request captured')
    return lastRequestDetails.headers
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
        capturingAuthFetchImpl({posts: []}),
    )
    assert(query().get('nsfw') === 'Exclude', 'posts forward nsfwFilter Exclude')
    await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Only'},
        capturingAuthFetchImpl({posts: []}),
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
        {instance: 'lemmy.ml', type: 'All', sort: 'TopMonth', page: 1, limit: 20, search: 'rust'},
        capturingFetchImpl({communities: []}),
    )
    assert(request().pathname === '/api/v3/community/list', 'communities hit community/list')
    assert(query().get('search') === 'rust', 'search param forwarded')
    assert(query().get('sort') === 'TopMonth' && query().get('type_') === 'All', 'community sort params')

    await fetchCommunities(
        {instance: 'lemmy.ml', type: 'Local', sort: 'Hot', page: 1, limit: 20},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('type_') === 'Local', 'community listing type forwarded')

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

    // Modern Lemmy (0.19.19+) reports version at the top level, not on site_view.site
    const modernLemmy = await fetchSite('modern.example', fetchSequence([
        {site_view: {site: {name: 'Modern', actor_id: 'https://modern.example', version: '', icon: null, description: null}}, version: '0.19.19'},
        {},  // alpha probe returns nothing
    ]))
    assert(modernLemmy.software === 'lemmy', 'modern lemmy detected via top-level version prefix')
    assert(modernLemmy.site.version === '0.19.19', 'modern lemmy version read from top level')

    // PieFed compat /api/v3/site also has a top-level version; alpha probe takes precedence
    const piefedCompat = await fetchSite('piefed.example', fetchSequence([
        {site_view: {site: {name: 'Piefed', actor_id: 'https://piefed.example', version: '', icon: null, description: null}}, version: '1.7.9'},
        {version: '1.7.9'},
    ]))
    assert(piefedCompat.software === 'piefed', 'piefed detected via alpha probe despite compat top-level version')

    // PieFed top-level version alone (alpha probe failed) is still detected via 1.x prefix
    const piefedPrefix = await fetchSite('piefed2.example', fetchSequence([
        {site_view: {site: {name: 'Piefed2', actor_id: 'https://piefed2.example', version: '', icon: null, description: null}}, version: '1.7.9'},
        {},  // alpha probe returns nothing
    ]))
    assert(piefedPrefix.software === 'piefed', 'piefed detected via 1.x version prefix')

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
        capturingAuthFetchImpl({posts: []}),
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
        {instance: 'fedinsfw.app', type: 'All', sort: 'Hot', page: 1, limit: 20},
        capturingFetchImpl({communities: [{community: {id: 1, name: 'main', title: 'Main', actor_id: 'https://fedinsfw.app/c/main', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'}, counts: {subscriptions_count: 10, post_count: 5, post_reply_count: 2, published: '2026-01-01T00:00:00Z'}, subscribed: 'NotSubscribed', blocked: false}]}),
    )
    assert(request().pathname === '/api/alpha/community/list', 'piefed communities hit alpha community/list')
    assert(query().get('type_') === 'All', 'piefed community list defaults to All')
    await fetchPiefedCommunities(
        {instance: 'fedinsfw.app', type: 'Local', sort: 'Hot', page: 1, limit: 20},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('type_') === 'Local', 'piefed community listing type forwarded')
    assert(query().get('show_nsfw') === 'true', 'piefed community list shows nsfw by default')
    await fetchPiefedCommunities(
        {instance: 'fedinsfw.app', type: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude'},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('show_nsfw') === 'false', 'piefed community list hides nsfw in Exclude mode')
    await fetchPiefedCommunities(
        {instance: 'fedinsfw.app', type: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Only'},
        capturingFetchImpl({communities: []}),
    )
    assert(query().get('show_nsfw') === 'true', 'piefed Only degrades to showing nsfw (boolean API)')
    assert(pc.communities[0].subscribers === 10 && pc.communities[0].posts === 5 && pc.communities[0].comments === 2, 'piefed community counts mapped')

    const searchHits = await fetchPiefedCommunitySearch('fedinsfw.app', 'nsfw', 20, capturingFetchImpl({communities: [{community: {id: 2, name: 'nsfw2', title: 'NSFW2', actor_id: 'https://fedinsfw.app/c/nsfw2', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'}, counts: {subscriptions_count: 1, post_count: 1, post_reply_count: 1, published: '2026-01-01T00:00:00Z'}, subscribed: 'NotSubscribed', blocked: false}]}))
    assert(request().pathname === '/api/alpha/search' && query().get('type_') === 'Communities', 'piefed search hits alpha search')
    assert(query().get('listing_type') === 'All', 'piefed search defaults to All listing')
    await fetchPiefedCommunitySearch('fedinsfw.app', 'nsfw', 20, capturingFetchImpl({communities: []}), 'Include', 'Local')
    assert(query().get('listing_type') === 'Local', 'piefed search forwards Local listing')
    assert(searchHits.length === 1 && searchHits[0].name === 'nsfw2', 'piefed search mapped')

    const single = await fetchPiefedCommunity('fedinsfw.app', 7, capturingFetchImpl({community_view: {community: {id: 7, name: 'x', title: 'X', actor_id: 'https://fedinsfw.app/c/x', local: true, icon: null, banner: null, description: null, published: '2026-01-01T00:00:00Z'}, counts: {subscriptions_count: 3, post_count: 2, post_reply_count: 1, published: '2026-01-01T00:00:00Z'}, subscribed: 'Subscribed', blocked: false}}))
    assert(single.subscribed === true && single.id === 7, 'piefed community by id mapped')

    const alphaSite = await fetchPiefedSite('fedinsfw.app', capturingFetchImpl({site: {name: 'FediNSFW', actor_id: 'https://fedinsfw.app/', icon: null, description: null}, version: '1.7.8'}))
    assert(alphaSite.software === 'piefed' && alphaSite.site.version === '1.7.8', 'piefed site mapped')

    await fetchCommunity('lemmy.ml', 7, capturingFetchImpl({community_view: {community: rawPost.community, counts: {subscribers: 10, posts: 5, comments: 2}, subscribed: 'NotSubscribed', blocked: false}}))
    assert(request().pathname === '/api/v3/community' && query().get('id') === '7', 'community by id')

    // ---- auth headers on feed fetches ----

    await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, auth: 'tok123'},
        capturingAuthFetchImpl({posts: []}),
    )
    assert(lastHeaders().get('Authorization') === 'Bearer tok123', 'logged-in feed sends Authorization header')
    await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20},
        capturingAuthFetchImpl({posts: []}),
    )
    assert(lastHeaders().get('Authorization') === null, 'anonymous feed sends no Authorization header')
    await fetchPosts(
        {instance: 'lemmy.ml', feedType: 'Subscribed', sort: 'Hot', page: 1, limit: 20, auth: 'tok123'},
        capturingAuthFetchImpl({posts: []}),
    )
    assert(query().get('type_') === 'Subscribed', 'Subscribed listing forwarded as type_')

    // ---- login ----

    const lemmyLogin = await loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({jwt: 'jwtA'}))
    assert(lastRequestDetails!.method === 'POST', 'login uses POST')
    assert(new URL(lastRequestDetails!.url).pathname === '/api/v3/user/login', 'lemmy login hits user/login')
    assert(lastHeaders().get('Authorization') === null, 'login itself sends no auth header')
    const loginBody = lastBody()
    assert(
        loginBody.username_or_email === 'bob' && loginBody.password === 'secret',
        'login body carries username and password',
    )
    assert(loginBody.stay_logged_in === true, 'lemmy login stays logged in')
    assert(lemmyLogin.jwt === 'jwtA' && lemmyLogin.username === 'bob', 'lemmy login returns session')

    await loginLemmy('lemmy.ml', 'bob', 'secret', '123456', capturingAuthFetchImpl({jwt: 'jwtB'}))
    assert(lastBody().totp_2fa_token === '123456', 'totp token forwarded when provided')

    const objJwt = await loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({jwt: {jwt: 'jwtC', registration_created: false}}))
    assert(objJwt.jwt === 'jwtC', 'object-shaped jwt parsed')

    await assertRejects(
        () => loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({registration_created: true})),
        (e) => e instanceof ApiError && /approved/.test(e.message),
        'pending registration surfaces as an ApiError',
    )
    await assertRejects(
        () => loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({verify_email_sent: true})),
        (e) => e instanceof ApiError && /email/i.test(e.message),
        'unverified email surfaces as an ApiError',
    )
    await assertRejects(
        () => loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({})),
        (e) => e instanceof ApiError && e.status === 401 && /username and password/.test(e.message),
        'missing jwt maps to bad credentials',
    )
    await assertRejects(
        () => loginLemmy('lemmy.ml', 'bob', 'wrong', undefined, capturingAuthFetchImpl({error: 'incorrect_password'}, 401)),
        (e) => e instanceof ApiError && e.status === 401,
        'login 401 keeps the status',
    )

    const piefedLogin = await loginPiefed('piefed.social', 'bob', 'secret', capturingAuthFetchImpl({jwt: 'pjwt'}))
    assert(new URL(lastRequestDetails!.url).pathname === '/api/alpha/user/login', 'piefed login hits alpha user/login')
    assert(lastBody().username_or_email === 'bob', 'piefed login accepts username_or_email')
    assert(piefedLogin.jwt === 'pjwt' && piefedLogin.username === 'bob', 'piefed login returns session')

    // ---- popular server registry ----

    const csv = [
        'Instance,NU,NC,Fed,Adult,↓V,Users,BI,BB,UT,MO,Version',
        '[Lemmy.World](https://lemmy.world),Yes,Yes,Yes,Yes,Yes,18459,172,1,99%,12,0.19.3',
        '[Small](https://small.example),Yes,Yes,Yes,Yes,Yes,5,1,0,100%,3,0.19.3',
        '[NSFW Place](https://lemmynsfw.com),Yes,Yes,Yes,Yes,No,3577,177,26,99%,12,0.19.3',
        'malformed line without a markdown link',
        '[NoUsers](https://nousers.example),Yes,Yes,Yes,Yes,Yes,?,1,0,100%,3,0.19.3',
        '',
    ].join('\n')
    const parsed = parseRegistryCsv(csv)
    assert(parsed.length === 3, 'registry parse skips malformed and empty rows')
    assert(parsed[0].host === 'lemmy.world' && parsed[0].name === 'Lemmy.World', 'registry sorts by monthly users')
    assert(parsed[1].host === 'lemmynsfw.com' && parsed[1].nsfw === true, 'registry tags known NSFW hosts')
    assert(parsed[2].host === 'small.example', 'registry keeps smaller instances after the top')
    assert(!parsed.some((s) => s.host === 'nousers.example'), 'registry drops rows with invalid user counts')

    const failedRegistry = await fetchRegistryPopular(
        (async () => {
            throw new TypeError('network down')
        }) as typeof fetch,
    )
    assert(failedRegistry.length === 0, 'registry network failure yields an empty list')
    const nonOkRegistry = await fetchRegistryPopular(
        (async () => new Response('boom', {status: 500})) as typeof fetch,
    )
    assert(nonOkRegistry.length === 0, 'registry non-ok response yields an empty list')

    const merged = mergePopular(POPULAR_SERVERS, [
        {host: 'lemmy.world', name: 'Lemmy.World', nsfw: false},
        {host: 'brand.new', name: 'Brand New', nsfw: false},
    ])
    assert(merged[0].host === 'lemmy.world', 'registry entries rank before bundled duplicates')
    assert(merged.length === POPULAR_SERVERS.length + 1, 'merge dedupes overlapping hosts')
    assert(merged.some((s) => s.host === 'brand.new'), 'merge keeps registry-only hosts')
    assert(POPULAR_SERVERS.some((s) => s.host === 'lemmynsfw.com' && s.nsfw), 'bundled list flags NSFW instances')
    assert(POPULAR_SERVERS.some((s) => s.host === 'piefed.social'), 'bundled list covers PieFed')

    // ---- NSFW client-side filter ----

    const nsfwPost = makePost({nsfw: true})
    const sfwPost = makePost({nsfw: false})
    const mixed = [sfwPost, nsfwPost, sfwPost, nsfwPost, sfwPost]

    assert(clientFilterPosts(mixed, 'Include').length === 5, 'Include returns all')
    assert(clientFilterPosts(mixed, 'Exclude').length === 3, 'Exclude removes NSFW')
    assert(clientFilterPosts(mixed, 'Exclude').every((p: LemmyPost) => !p.nsfw), 'Exclude only has SFW')
    assert(clientFilterPosts(mixed, 'Only').length === 2, 'Only keeps NSFW')
    assert(clientFilterPosts(mixed, 'Only').every((p: LemmyPost) => p.nsfw), 'Only has NSFW')
    assert(clientFilterPosts([], 'Only').length === 0, 'filter handles empty')

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

    // ---- embed providers (redgifs, youtube) ----

    assert(embedProviderForUrl('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound')?.name === 'redgifs', 'redgifs watch provider')
    assert(embedProviderForUrl('https://redgifs.com/ifr/abc123')?.name === 'redgifs', 'redgifs ifr provider')
    assert(embedProviderForUrl('https://media.redgifs.com/SteelDeadlyItaliangreyhound-mobile.mp4') === null, 'media file is not a page id')
    assert(embedProviderForUrl('https://example.com/watch/xyz') === null, 'non-redgifs url rejected')
    assert(embedUrlFor('https://x.com/v.mp4') === null, 'no embed for direct file')
    assert(embedProviderForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.name === 'youtube', 'youtube watch provider')
    assert(embedProviderForUrl('https://youtu.be/dQw4w9WgXcQ')?.name === 'youtube', 'youtu.be provider')
    assert(embedProviderForUrl('https://example.com/watch?v=dQw4w9WgXcQ') === null, 'non-youtube host with watch param rejected')

    assert(
        classifyPost(makePost({postType: 'Link', url: 'https://www.redgifs.com/watch/steeldeadlyitaliangreyhound'})) === 'video',
        'lemmy redgifs link classifies video',
    )
    assert(
        classifyPost(makePost({url: 'https://redgifs.com/watch/abc'})) === 'video',
        'untyped redgifs url classifies video',
    )
    assert(
        classifyPost(makePost({postType: 'Link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})) === 'video',
        'lemmy youtube link classifies video',
    )
    assert(
        classifyPost(makePost({url: 'https://youtu.be/dQw4w9WgXcQ'})) === 'video',
        'untyped youtube url classifies video',
    )

    const direct = resolveVideoUrl('https://x.com/video.mp4')
    assert(direct.src === 'https://x.com/video.mp4' && direct.poster === null && direct.candidates.length === 0, 'direct video passes through')
    const unsafeVideo = resolveVideoUrl('javascript:alert(1)')
    assert(unsafeVideo.src === null, 'unsafe direct video url rejected')

    // embed sites play through the official embed player, not a <video> element
    assert(
        embedUrlFor('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound') ===
            'https://www.redgifs.com/ifr/steeldeadlyitaliangreyhound',
        'redgifs watch url maps to the embed player',
    )
    assert(
        embedUrlFor('https://redgifs.com/ifr/abc123') === 'https://www.redgifs.com/ifr/abc123',
        'redgifs ifr url maps to the embed player',
    )
    assert(embedUrlFor('https://media.redgifs.com/x-mobile.mp4') === null, 'media file gets no embed')
    assert(embedUrlFor('https://example.com/v.mp4') === null, 'non-redgifs url gets no embed')
    assert(embedUrlFor('javascript:alert(1)') === null, 'unsafe url gets no embed')
    assert(resolveVideoUrl('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound').src === null, 'resolveVideoUrl leaves redgifs to the embed player')

    // ---- youtube embeds ----

    assert(
        embedUrlFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube watch url maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://youtu.be/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtu.be url maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube shorts url maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://www.youtube.com/embed/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube embed url maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://www.youtube.com/live/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube live url maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://m.youtube.com/watch?v=dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'mobile youtube host maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://music.youtube.com/watch?v=dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'music youtube host maps to nocookie embed',
    )
    assert(
        embedUrlFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'playlist param ignored',
    )
    assert(embedUrlFor('https://www.youtube.com/watch?v=short') === null, 'too-short youtube id rejected')
    assert(embedUrlFor('https://notyoutube.com/watch?v=dQw4w9WgXcQ') === null, 'lookalike youtube host rejected')
    assert(embedUrlFor('javascript:alert(1)') === null, 'unsafe youtube url rejected')
    assert(resolveVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').src === null, 'resolveVideoUrl leaves youtube to the embed player')
    assert(
        embedProviderForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.iframeReferrerPolicy ===
            'strict-origin-when-cross-origin',
        'youtube iframe sends origin so the player can configure',
    )
    assert(
        embedProviderForUrl('https://www.redgifs.com/watch/xyz')?.iframeReferrerPolicy === undefined,
        'redgifs iframe keeps the no-referrer default',
    )

    assert(
        embedPosterFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        'youtube placeholder poster from thumbnail feed',
    )
    assert(embedPosterFor('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound') === null, 'redgifs has no placeholder poster')

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
        () => fetchCommunities({instance: 'lemmy.ml', type: 'All', sort: 'Hot', page: 1, limit: 20}, mockFetchImpl({posts: []}, 200)),
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
        {instance: 'lemmy.ml', type: 'All', sort: 'Hot', page: 1, limit: 20, nsfwFilter: 'Exclude'},
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
