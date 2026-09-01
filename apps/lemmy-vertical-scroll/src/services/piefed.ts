import type {
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyCommunity,
    LemmyPost,
    NsfwFilter,
    PostFeedType,
    PostPage,
    PostSort,
    SiteResult,
} from '../types'
import {apiGet, apiPost, ApiError} from './lemmy'
import type {LoginResult} from './lemmy'
import {classifyPost, extractImageUrls} from './post-media'

// ---- raw piefed alpha api shapes (snake_case wire format) ----

interface RawPiefedCommunity {
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

interface RawPiefedCreator {
    user_name: string
    title: string | null
    avatar: string | null
    actor_id: string
}

interface RawPiefedPost {
    id: number
    title: string
    body: string | null
    url: string | null
    thumbnail_url: string | null
    small_thumbnail_url: string | null
    nsfw: boolean
    sticky: boolean
    instance_sticky: boolean
    published: string
    community_id: number
    ap_id: string
    post_type: string
}

interface RawPiefedCounts {
    score: number
    upvotes: number
    downvotes: number
    comments: number
}

interface RawPiefedPostView {
    post: RawPiefedPost
    community: RawPiefedCommunity
    creator: RawPiefedCreator
    counts: RawPiefedCounts
    my_vote: number | null
}

interface RawPiefedCommunityCounts {
    subscriptions_count: number
    post_count: number
    post_reply_count: number
    published: string
}

interface RawPiefedCommunityView {
    community: RawPiefedCommunity
    counts: RawPiefedCommunityCounts
    subscribed: 'NotSubscribed' | 'Pending' | 'Subscribed'
    blocked: boolean
}

interface RawPiefedSite {
    name: string
    actor_id: string
    icon: string | null
    description: string | null
}

// ---- mapping ----

function postTypeOf(raw: string): LemmyPost['postType'] {
    return raw === 'Image' || raw === 'Video' || raw === 'Link' ? raw : null
}

function basePiefedPost(view: RawPiefedPostView): LemmyPost {
    const {post, community, creator, counts} = view
    return {id: post.id, name: post.title, url: post.url, body: post.body, thumbnailUrl: post.thumbnail_url ?? post.small_thumbnail_url, nsfw: post.nsfw, pinnedLocal: post.instance_sticky, pinnedCommunity: post.sticky, published: post.published, communityId: community.id, communityName: community.name, communityActorId: community.actor_id, communityTitle: community.title, communityIcon: community.icon, creatorActorId: creator.actor_id, creatorName: creator.user_name, creatorDisplayName: creator.title, creatorAvatar: creator.avatar, score: counts.score, upvotes: counts.upvotes, downvotes: counts.downvotes, comments: counts.comments, myVote: view.my_vote ?? null, postUrl: post.ap_id, postType: postTypeOf(post.post_type), imageUrls: [], videoUrl: null, linkUrl: null}
}

function enrichPiefedPost(base: LemmyPost): LemmyPost {
    const kind = classifyPost(base)
    return {...base, imageUrls: extractImageUrls(base), videoUrl: kind === 'video' ? base.url : null, linkUrl: kind === 'link' ? base.url : null}
}

function mapPostView(view: RawPiefedPostView): LemmyPost {
    return enrichPiefedPost(basePiefedPost(view))
}

function mapCommunityView(view: RawPiefedCommunityView): LemmyCommunity {
    return {
        id: view.community.id,
        name: view.community.name,
        title: view.community.title,
        actorId: view.community.actor_id,
        local: view.community.local,
        icon: view.community.icon,
        banner: view.community.banner,
        description: view.community.description,
        published: view.counts.published ?? view.community.published,
        subscribers: view.counts.subscriptions_count,
        posts: view.counts.post_count,
        comments: view.counts.post_reply_count,
        subscribed: view.subscribed === 'Subscribed' || view.subscribed === 'Pending',
        blocked: view.blocked,
    }
}

// ---- api calls ----

function unexpectedResponse(instance: string, path: string): ApiError {
    return new ApiError(`Unexpected response from ${instance} for ${path}`, 200)
}

function assertPosts(data: unknown, instance: string, path: string): {posts: RawPiefedPostView[]} {
    if (!data || !Array.isArray((data as {posts?: unknown}).posts)) throw unexpectedResponse(instance, path)
    return data as {posts: RawPiefedPostView[]}
}

function assertCommunities(data: unknown, instance: string, path: string): {communities: RawPiefedCommunityView[]} {
    if (!data || !Array.isArray((data as {communities?: unknown}).communities)) {
        throw unexpectedResponse(instance, path)
    }
    return data as {communities: RawPiefedCommunityView[]}
}

function assertCommunityView(data: unknown, instance: string, path: string): {community_view: RawPiefedCommunityView} {
    if (!data || !(data as {community_view?: unknown}).community_view) {
        throw unexpectedResponse(instance, path)
    }
    return data as {community_view: RawPiefedCommunityView}
}

export async function fetchPiefedSite(instance: string, fetchImpl: typeof fetch = fetch): Promise<SiteResult> {
    const data = (await apiGet(instance, '/api/alpha/site', {}, fetchImpl, null)) as {
        site?: RawPiefedSite
        version?: string
    }
    if (!data?.site) throw unexpectedResponse(instance, '/api/alpha/site')
    return {
        site: {
            name: data.site.name,
            actorId: data.site.actor_id,
            version: data.version ?? '',
            icon: data.site.icon,
            description: data.site.description,
        },
        software: 'piefed',
    }
}

export interface PiefedPostsQuery {
    instance: string
    feedType: PostFeedType
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
    auth?: string
}

export async function fetchPiefedPosts(
    {instance, feedType, sort, page, limit, nsfwFilter = 'Include', auth}: PiefedPostsQuery,
    fetchImpl: typeof fetch = fetch,
): Promise<PostPage> {
    const data = assertPosts(
        await apiGet(instance, '/api/alpha/post/list', {type_: feedType, sort, page, limit, nsfw: nsfwFilter}, fetchImpl, null, auth),
        instance,
        '/api/alpha/post/list',
    )
    return {posts: data.posts.map(mapPostView), page}
}

export interface PiefedCommunityPostsQuery {
    instance: string
    communityId: number
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
    auth?: string
}

export async function fetchPiefedCommunityPosts(
    {instance, communityId, sort, page, limit, nsfwFilter = 'Include', auth}: PiefedCommunityPostsQuery,
    fetchImpl: typeof fetch = fetch,
): Promise<PostPage> {
    const data = assertPosts(
        await apiGet(
            instance,
            '/api/alpha/post/list',
            {community_id: communityId, sort, page, limit, nsfw: nsfwFilter},
            fetchImpl,
            null,
            auth,
        ),
        instance,
        '/api/alpha/post/list',
    )
    return {posts: data.posts.map(mapPostView), page}
}

export interface PiefedCommunitiesQuery {
    instance: string
    type: FeedType
    sort: CommunitySort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
    auth?: string
}

export async function fetchPiefedCommunities(
    {instance, type, sort, page, limit, nsfwFilter = 'Include', auth}: PiefedCommunitiesQuery,
    fetchImpl: typeof fetch = fetch,
): Promise<CommunityPage> {
    // PieFed's community list only accepts a boolean; 'Only' cannot be
    // expressed, so it degrades to showing NSFW like 'Include'.
    const data = assertCommunities(
        await apiGet(
            instance,
            '/api/alpha/community/list',
            {type_: type, sort, page, limit, show_nsfw: nsfwFilter !== 'Exclude'},
            fetchImpl,
            null,
            auth,
        ),
        instance,
        '/api/alpha/community/list',
    )
    return {communities: data.communities.map(mapCommunityView), page}
}

/** PieFed's community/list has no search param; search goes through /search. */
export async function fetchPiefedCommunitySearch(
    instance: string,
    search: string,
    limit: number,
    fetchImpl: typeof fetch = fetch,
    nsfwFilter: NsfwFilter = 'Include',
    type: FeedType = 'All',
    auth?: string,
): Promise<LemmyCommunity[]> {
    const data = assertCommunities(
        await apiGet(
            instance,
            '/api/alpha/search',
            {q: search, type_: 'Communities', listing_type: type, limit, nsfw: nsfwFilter},
            fetchImpl,
            null,
            auth,
        ),
        instance,
        '/api/alpha/search',
    )
    return data.communities.map(mapCommunityView)
}

export async function fetchPiefedCommunity(
    instance: string,
    communityId: number,
    fetchImpl: typeof fetch = fetch,
): Promise<LemmyCommunity> {
    const data = assertCommunityView(
        await apiGet(instance, '/api/alpha/community', {id: communityId}, fetchImpl, null),
        instance,
        '/api/alpha/community',
    )
    return mapCommunityView(data.community_view)
}

// ---- auth ----

/**
 * PieFed mirrors the Lemmy login contract: POST the alpha route with a
 * username/email and password, get back a jwt used as a bearer credential.
 */
export async function loginPiefed(
    instance: string,
    username: string,
    password: string,
    fetchImpl: typeof fetch = fetch,
): Promise<LoginResult> {
    const data = (await apiPost(instance, '/api/alpha/user/login', {username_or_email: username, password}, fetchImpl)) as {
        jwt?: string | {jwt: string} | null
        registration_created?: boolean
    } | null
    if (!data) throw unexpectedResponse(instance, '/api/alpha/user/login')
    if (data.registration_created) {
        throw new ApiError('That account is registered but not yet approved by the instance.')
    }
    const jwt = typeof data.jwt === 'string' ? data.jwt : data.jwt?.jwt
    if (!jwt) throw new ApiError('Login failed — check your username and password.', 401)
    return {jwt, username}
}
