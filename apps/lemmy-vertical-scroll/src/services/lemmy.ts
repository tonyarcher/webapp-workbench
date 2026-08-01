import type {
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyCommunity,
    LemmyPost,
    LemmySite,
    NsfwFilter,
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
 */
export async function apiGet(
    instance: string,
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    fetchImpl: FetchImpl,
    hint404: string | null = LEMMY_404_HINT,
): Promise<unknown> {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, String(value))
    }
    let response: Awaited<ReturnType<FetchImpl>>
    try {
        // AbortSignal.timeout converts proxies that stall requests into a catchable error
        response = await fetchImpl(`https://${instance}${path}?${query.toString()}`, {
            method: 'GET',
            headers: {Accept: 'application/json'},
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
    } catch {
        throw new ApiError(`Could not reach ${instance} (request timed out)`)
    }
    const data = (await response.json().catch(() => null)) as {error?: string} | null
    if (!response.ok) {
        const detail = data?.error ? `: ${data.error}` : ''
        if (response.status === 404 && hint404) {
            throw new ApiError(
                `${instance} does not appear to run a Lemmy-compatible API (${path} returned 404). ${hint404}`,
                response.status,
            )
        }
        throw new ApiError(`Instance ${instance} rejected request to ${path}${detail}`, response.status)
    }
    return data
}

function mapPostView(view: RawPostView): LemmyPost {
    const {post, community, creator, counts} = view
    const base: LemmyPost = {
        id: post.id,
        name: post.name,
        url: post.url,
        body: post.body,
        thumbnailUrl: post.thumbnail_url,
        nsfw: post.nsfw,
        pinnedLocal: post.pinned_local,
        pinnedCommunity: post.pinned_community,
        published: post.published,
        communityId: community.id,
        communityName: community.name,
        communityActorId: community.actor_id,
        communityTitle: community.title,
        communityIcon: community.icon,
        creatorActorId: creator.actor_id,
        creatorName: creator.name,
        creatorDisplayName: creator.display_name,
        creatorAvatar: creator.avatar,
        score: counts.score,
        upvotes: counts.upvotes,
        downvotes: counts.downvotes,
        comments: counts.comments,
        myVote: view.my_vote ?? null,
        postUrl: post.ap_id,
        postType: post.post_url_content_type ?? null,
        imageUrls: [],
        videoUrl: null,
        linkUrl: null,
    }
    const kind = classifyPost(base)
    return {
        ...base,
        imageUrls: extractImageUrls(base),
        videoUrl: kind === 'video' ? base.url : null,
        linkUrl: kind === 'link' ? base.url : null,
    }
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

// ---- api calls ----

export async function fetchSite(instance: string, fetchImpl: FetchImpl = fetch): Promise<SiteResult> {
    const data = (await apiGet(instance, '/api/v3/site', {}, fetchImpl)) as {site_view: {site: RawLemmySite}}
    const version = data.site_view.site.version ?? ''
    if (version) return {site: mapSite(data.site_view.site), software: 'lemmy'}
    const detected = await detectSoftware(instance, fetchImpl)
    return {
        site: {...mapSite(data.site_view.site), version: detected.version},
        software: detected.software,
    }
}

/**
 * A Lemmy site response without a version string means the instance is not
 * Lemmy (PieFed exposes `/api/v3/site` for compatibility but nothing else).
 * Probe PieFed's own API; anything else stays unknown.
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
    feedType: FeedType
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
}

export async function fetchPosts(
    {instance, feedType, sort, page, limit, nsfwFilter = 'Include'}: PostsQuery,
    fetchImpl: FetchImpl = fetch,
): Promise<PostPage> {
    const data = (await apiGet(
        instance,
        '/api/v3/post/list',
        {type_: feedType, sort, page, limit, nsfw: nsfwFilter},
        fetchImpl,
    )) as {posts: RawPostView[]}
    return {posts: data.posts.map(mapPostView), page}
}

export interface CommunitiesQuery {
    instance: string
    sort: CommunitySort
    page: number
    limit: number
    search?: string
}

export async function fetchCommunities(
    {instance, sort, page, limit, search}: CommunitiesQuery,
    fetchImpl: FetchImpl = fetch,
): Promise<CommunityPage> {
    const data = (await apiGet(
        instance,
        '/api/v3/community/list',
        {type_: 'All', sort, page, limit, search},
        fetchImpl,
    )) as {communities: RawCommunityView[]}
    return {communities: data.communities.map(mapCommunityView), page}
}

export async function fetchCommunity(
    instance: string,
    communityId: number,
    fetchImpl: FetchImpl = fetch,
): Promise<LemmyCommunity> {
    const data = (await apiGet(instance, '/api/v3/community', {id: communityId}, fetchImpl)) as {
        community_view: RawCommunityView
    }
    return mapCommunityView(data.community_view)
}

export interface CommunityPostsQuery {
    instance: string
    communityId: number
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
}

export async function fetchCommunityPosts(
    {instance, communityId, sort, page, limit, nsfwFilter = 'Include'}: CommunityPostsQuery,
    fetchImpl: FetchImpl = fetch,
): Promise<PostPage> {
    const data = (await apiGet(
        instance,
        '/api/v3/post/list',
        {community_id: communityId, sort, page, limit, nsfw: nsfwFilter},
        fetchImpl,
    )) as {posts: RawPostView[]}
    return {posts: data.posts.map(mapPostView), page}
}
