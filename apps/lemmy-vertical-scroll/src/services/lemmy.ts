import type {
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyCommunity,
    LemmyPost,
    LemmySite,
    NsfwFilter,
    PostFeedType,
    PostPage,
    PostSort,
    SiteResult,
    Software,
} from '../types'
import {classifyPost, extractImageUrls} from './post-media'

// ---- raw lemmy api shapes (snake_case wire format) ----

interface RawCommunity {
    id: number
    name: string
    title: string
    actor_id: string
    local: boolean
    icon: string | null
    banner: string | null
    description: string | null
    published: string
}

interface RawCreator {
    actor_id: string
    name: string
    display_name: string | null
    avatar: string | null
}

interface RawPost {
    id: number
    name: string
    url: string | null
    body: string | null
    thumbnail_url: string | null
    nsfw: boolean
    pinned_local: boolean
    pinned_community: boolean
    published: string
    community_id: number
    ap_id: string
    post_url_content_type?: 'Image' | 'Video' | 'Link' | null
}

interface RawCounts {
    score: number
    upvotes: number
    downvotes: number
    comments: number
}

interface RawPostView {
    post: RawPost
    community: RawCommunity
    creator: RawCreator
    counts: RawCounts
    my_vote: number | null
}

interface RawCommunityView {
    community: RawCommunity
    counts: {subscribers: number; posts: number; comments: number}
    subscribed: 'NotSubscribed' | 'Pending' | 'Subscribed'
    blocked: boolean
}

// ---- errors ----

export class ApiError extends Error {
    readonly status: number | null

    constructor(message: string, status: number | null = null) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

// ---- helpers ----

/** Normalizes user input like `https://lemmy.ml/` or `sh.itjust.works` to `lemmy.ml`; null when unparseable. */
export function normalizeInstanceUrl(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    try {
        const url = new URL(withProtocol)
        if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
        return url.host
    } catch {
        return null
    }
}

// ---- client ----

type FetchImpl = typeof fetch

const REQUEST_TIMEOUT_MS = 15_000

const LEMMY_404_HINT =
    'PieFed and other fediverse software only partially support the Lemmy API — try a Lemmy instance.'

/**
 * GET helper shared by the Lemmy and PieFed providers. Read endpoints accept
 * both POST (JSON body) and GET (query params); GET is used because
 * Cloudflare-fronted instances reject POST from non-browser clients.
 * An optional jwt adds the Authorization header for logged-in requests.
 */
function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, String(value))
    }
    return query.toString()
}

function isTimeout(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'TimeoutError'
}

function throwNetworkError(instance: string, error: unknown): never {
    throw new ApiError(isTimeout(error) ? `Could not reach ${instance} (request timed out)` : `Could not reach ${instance} (network error)`)
}

function throwGetError(instance: string, path: string, status: number, detail: string, hint404: string | null): never {
    if (status === 404 && hint404) throw new ApiError(`${instance} does not appear to run a Lemmy-compatible API (${path} returned 404). ${hint404}`, status)
    throw new ApiError(`Instance ${instance} rejected request to ${path}${detail}`, status)
}

export async function apiGet(
    instance: string,
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    fetchImpl: FetchImpl,
    hint404: string | null = LEMMY_404_HINT,
    auth?: string,
): Promise<unknown> {
    const query = buildQuery(params)
    let response: Awaited<ReturnType<FetchImpl>>
    try {
        const headers: Record<string, string> = {Accept: 'application/json'}
        if (auth) headers.Authorization = `Bearer ${auth}`
        response = await fetchImpl(`https://${instance}${path}?${query}`, {method: 'GET', headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)})
    } catch (error) {
        throwNetworkError(instance, error)
    }
    const data = (await response.json().catch(() => null)) as {error?: string} | null
    if (!response.ok) throwGetError(instance, path, response.status, data?.error ? `: ${data.error}` : '', hint404)
    return data
}

/**
 * POST helper for write-ish endpoints (login). Sends a JSON body and shares
 * the GET helper's timeout and error handling.
 */
export async function apiPost(
    instance: string,
    path: string,
    body: Record<string, unknown>,
    fetchImpl: FetchImpl,
    auth?: string,
): Promise<unknown> {
    let response: Awaited<ReturnType<FetchImpl>>
    try {
        const headers: Record<string, string> = {'Content-Type': 'application/json'}
        if (auth) headers.Authorization = `Bearer ${auth}`
        response = await fetchImpl(`https://${instance}${path}`, {method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)})
    } catch (error) {
        throwNetworkError(instance, error)
    }
    const data = (await response.json().catch(() => null)) as {error?: string} | null
    if (!response.ok) throw new ApiError(`Instance ${instance} rejected request to ${path}${data?.error ? `: ${data.error}` : ''}`, response.status)
    return data
}

/** Shared guard against 200 responses whose JSON does not match the endpoint shape. */
function unexpectedResponse(instance: string, path: string): ApiError {
    return new ApiError(`Unexpected response from ${instance} for ${path}`, 200)
}

function assertPosts(data: unknown, instance: string, path: string): {posts: RawPostView[]} {
    if (!data || !Array.isArray((data as {posts?: unknown}).posts)) {
        throw unexpectedResponse(instance, path)
    }
    return data as {posts: RawPostView[]}
}

function assertCommunities(data: unknown, instance: string, path: string): {communities: RawCommunityView[]} {
    if (!data || !Array.isArray((data as {communities?: unknown}).communities)) {
        throw unexpectedResponse(instance, path)
    }
    return data as {communities: RawCommunityView[]}
}

function assertSite(data: unknown, instance: string): {site_view: {site: RawLemmySite}; version?: string} {
    const siteView = (data as {site_view?: {site?: RawLemmySite}} | null)?.site_view
    if (!siteView?.site) throw unexpectedResponse(instance, '/api/v3/site')
    return data as {site_view: {site: RawLemmySite}; version?: string}
}

function assertCommunityView(data: unknown, instance: string, path: string): {community_view: RawCommunityView} {
    if (!data || !(data as {community_view?: unknown}).community_view) {
        throw unexpectedResponse(instance, path)
    }
    return data as {community_view: RawCommunityView}
}

function basePost(view: RawPostView): LemmyPost {
    const {post, community, creator, counts} = view
    return {id: post.id, name: post.name, url: post.url, body: post.body, thumbnailUrl: post.thumbnail_url, nsfw: post.nsfw, pinnedLocal: post.pinned_local, pinnedCommunity: post.pinned_community, published: post.published, communityId: community.id, communityName: community.name, communityActorId: community.actor_id, communityTitle: community.title, communityIcon: community.icon, creatorActorId: creator.actor_id, creatorName: creator.name, creatorDisplayName: creator.display_name, creatorAvatar: creator.avatar, score: counts.score, upvotes: counts.upvotes, downvotes: counts.downvotes, comments: counts.comments, myVote: view.my_vote ?? null, postUrl: post.ap_id, postType: post.post_url_content_type ?? null, imageUrls: [], videoUrl: null, linkUrl: null}
}

function enrichPost(base: LemmyPost): LemmyPost {
    const kind = classifyPost(base)
    return {...base, imageUrls: extractImageUrls(base), videoUrl: kind === 'video' ? base.url : null, linkUrl: kind === 'link' ? base.url : null}
}

function mapPostView(view: RawPostView): LemmyPost {
    return enrichPost(basePost(view))
}

function mapCommunityView(view: RawCommunityView): LemmyCommunity {
    return {
        id: view.community.id,
        name: view.community.name,
        title: view.community.title,
        actorId: view.community.actor_id,
        local: view.community.local,
        icon: view.community.icon,
        banner: view.community.banner,
        description: view.community.description,
        published: view.community.published,
        subscribers: view.counts.subscribers,
        posts: view.counts.posts,
        comments: view.counts.comments,
        subscribed: view.subscribed === 'Subscribed' || view.subscribed === 'Pending',
        blocked: view.blocked,
    }
}

// ---- auth ----

/** Result of a successful login; the jwt is the bearer credential for every later request. */
export interface LoginResult {
    jwt: string
    username: string
}

/**
 * POST /api/v3/user/login. Lemmy has returned the jwt both as a bare string
 * and (in some 0.19.x builds) as `{jwt, registration_created}`; both shapes
 * are accepted. `stay_logged_in` keeps the token from expiring after a week.
 */
export async function loginLemmy(
    instance: string,
    usernameOrEmail: string,
    password: string,
    totpToken?: string,
    fetchImpl: FetchImpl = fetch,
): Promise<LoginResult> {
    const body: Record<string, string | boolean> = {
        username_or_email: usernameOrEmail,
        password,
        stay_logged_in: true,
    }
    if (totpToken) body.totp_2fa_token = totpToken
    const data = (await apiPost(instance, '/api/v3/user/login', body, fetchImpl)) as {
        jwt?: string | {jwt: string} | null
        registration_created?: boolean
        verify_email_sent?: boolean
    } | null
    if (!data) throw unexpectedResponse(instance, '/api/v3/user/login')
    if (data.registration_created) {
        throw new ApiError('That account is registered but not yet approved by the instance.')
    }
    if (data.verify_email_sent) {
        throw new ApiError('Verify your email address before logging in.')
    }
    const jwt = typeof data.jwt === 'string' ? data.jwt : data.jwt?.jwt
    if (!jwt) throw new ApiError('Login failed — check your username and password.', 401)
    return {jwt, username: usernameOrEmail}
}

// ---- api calls ----

export async function fetchSite(instance: string, fetchImpl: FetchImpl = fetch): Promise<SiteResult> {
    const data = assertSite(await apiGet(instance, '/api/v3/site', {}, fetchImpl), instance)

    // Step 1: legacy Lemmy (≤0.19.18) puts the version on site_view.site
    const legacyVersion = data.site_view.site.version ?? ''
    if (legacyVersion) return {site: mapSite(data.site_view.site), software: 'lemmy'}

    // Step 2: PieFed's own API is the only definitive software probe
    const detected = await detectSoftware(instance, fetchImpl)
    if (detected.software === 'piefed') {
        return {site: {...mapSite(data.site_view.site), version: detected.version}, software: 'piefed'}
    }

    // Step 3: modern Lemmy (0.19.19+) and PieFed compat both expose the version
    // at the top level of the GetSite response; discriminate by version prefix
    // (Lemmy 0.x, PieFed 1.x).
    const topLevelVersion = typeof data.version === 'string' && data.version ? data.version : ''
    if (topLevelVersion.startsWith('0.')) {
        return {site: {...mapSite(data.site_view.site), version: topLevelVersion}, software: 'lemmy'}
    }
    if (topLevelVersion.startsWith('1.')) {
        return {site: {...mapSite(data.site_view.site), version: topLevelVersion}, software: 'piefed'}
    }

    return {site: {...mapSite(data.site_view.site), version: topLevelVersion}, software: 'unknown'}
}

/**
 * Probe PieFed's own API endpoint — the only definitive software check.
 * Modern Lemmy and PieFed compat both expose a top-level version at
 * /api/v3/site, so the caller discriminates by version prefix after
 * this probe returns "unknown".
 */
async function detectSoftware(
    instance: string,
    fetchImpl: FetchImpl,
): Promise<{software: Software; version: string}> {
    try {
        const data = (await apiGet(instance, '/api/alpha/site/version', {}, fetchImpl, null)) as
            | {version?: string}
            | null
        if (data && typeof data.version === 'string' && data.version) {
            return {software: 'piefed', version: data.version}
        }
    } catch {
        // fall through
    }
    return {software: 'unknown', version: ''}
}

interface RawLemmySite {
    name: string
    actor_id: string
    version: string
    icon: string | null
    description: string | null
}

function mapSite(site: RawLemmySite): LemmySite {
    return {
        name: site.name,
        actorId: site.actor_id,
        version: site.version,
        icon: site.icon,
        description: site.description,
    }
}

export interface PostsQuery {
    instance: string
    feedType: PostFeedType
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
    auth?: string
}

export async function fetchPosts(
    {instance, feedType, sort, page, limit, nsfwFilter = 'Include', auth}: PostsQuery,
    fetchImpl: FetchImpl = fetch,
): Promise<PostPage> {
    const data = assertPosts(
        await apiGet(instance, '/api/v3/post/list', {type_: feedType, sort, page, limit, nsfw: nsfwFilter}, fetchImpl, undefined, auth),
        instance,
        '/api/v3/post/list',
    )
    return {posts: data.posts.map(mapPostView), page}
}

export interface CommunitiesQuery {
    instance: string
    type: FeedType
    sort: CommunitySort
    page: number
    limit: number
    search?: string
    nsfwFilter?: NsfwFilter
    auth?: string
}

export async function fetchCommunities(
    {instance, type, sort, page, limit, search, nsfwFilter = 'Include', auth}: CommunitiesQuery,
    fetchImpl: FetchImpl = fetch,
): Promise<CommunityPage> {
    const data = assertCommunities(
        await apiGet(
            instance,
            '/api/v3/community/list',
            {type_: type, sort, page, limit, search, show_nsfw: nsfwFilter !== 'Exclude'},
            fetchImpl,
            undefined,
            auth,
        ),
        instance,
        '/api/v3/community/list',
    )
    return {communities: data.communities.map(mapCommunityView), page}
}

export async function fetchCommunity(
    instance: string,
    communityId: number,
    fetchImpl: FetchImpl = fetch,
): Promise<LemmyCommunity> {
    const data = assertCommunityView(
        await apiGet(instance, '/api/v3/community', {id: communityId}, fetchImpl),
        instance,
        '/api/v3/community',
    )
    return mapCommunityView(data.community_view)
}

export interface CommunityPostsQuery {
    instance: string
    communityId: number
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
    auth?: string
}

export async function fetchCommunityPosts(
    {instance, communityId, sort, page, limit, nsfwFilter = 'Include', auth}: CommunityPostsQuery,
    fetchImpl: FetchImpl = fetch,
): Promise<PostPage> {
    const data = assertPosts(
        await apiGet(
            instance,
            '/api/v3/post/list',
            {community_id: communityId, sort, page, limit, nsfw: nsfwFilter},
            fetchImpl,
            undefined,
            auth,
        ),
        instance,
        '/api/v3/post/list',
    )
    return {posts: data.posts.map(mapPostView), page}
}
