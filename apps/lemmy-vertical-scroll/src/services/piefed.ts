import type {
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyCommunity,
    LemmyPost,
    NsfwFilter,
    PostPage,
    PostSort,
    SiteResult,
} from '../types'
import {apiGet, ApiError} from './lemmy'
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

function mapPostView(view: RawPiefedPostView): LemmyPost {
    const {post, community, creator, counts} = view
    const mappedType = post.post_type === 'Image' || post.post_type === 'Video' || post.post_type === 'Link'
        ? post.post_type
        : null
    const base: LemmyPost = {
        id: post.id,
        name: post.title,
        url: post.url,
        body: post.body,
        thumbnailUrl: post.thumbnail_url ?? post.small_thumbnail_url,
        nsfw: post.nsfw,
        pinnedLocal: post.instance_sticky,
        pinnedCommunity: post.sticky,
        published: post.published,
        communityId: community.id,
        communityName: community.name,
        communityActorId: community.actor_id,
        communityTitle: community.title,
        communityIcon: community.icon,
        creatorActorId: creator.actor_id,
        creatorName: creator.user_name,
        creatorDisplayName: creator.title,
        creatorAvatar: creator.avatar,
        score: counts.score,
        upvotes: counts.upvotes,
        downvotes: counts.downvotes,
        comments: counts.comments,
        myVote: view.my_vote ?? null,
        postUrl: post.ap_id,
        postType: mappedType,
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
    feedType: FeedType
    sort: PostSort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
}

export async function fetchPiefedPosts(
    {instance, feedType, sort, page, limit, nsfwFilter = 'Include'}: PiefedPostsQuery,
    fetchImpl: typeof fetch = fetch,
): Promise<PostPage> {
    const data = assertPosts(
        await apiGet(instance, '/api/alpha/post/list', {type_: feedType, sort, page, limit, nsfw: nsfwFilter}, fetchImpl, null),
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
}

export async function fetchPiefedCommunityPosts(
    {instance, communityId, sort, page, limit, nsfwFilter = 'Include'}: PiefedCommunityPostsQuery,
    fetchImpl: typeof fetch = fetch,
): Promise<PostPage> {
    const data = assertPosts(
        await apiGet(
            instance,
            '/api/alpha/post/list',
            {community_id: communityId, sort, page, limit, nsfw: nsfwFilter},
            fetchImpl,
            null,
        ),
        instance,
        '/api/alpha/post/list',
    )
    return {posts: data.posts.map(mapPostView), page}
}

export interface PiefedCommunitiesQuery {
    instance: string
    sort: CommunitySort
    page: number
    limit: number
    nsfwFilter?: NsfwFilter
}

export async function fetchPiefedCommunities(
    {instance, sort, page, limit, nsfwFilter = 'Include'}: PiefedCommunitiesQuery,
    fetchImpl: typeof fetch = fetch,
): Promise<CommunityPage> {
    // PieFed's community list only accepts a boolean; 'Only' cannot be
    // expressed, so it degrades to showing NSFW like 'Include'.
    const data = assertCommunities(
        await apiGet(
            instance,
            '/api/alpha/community/list',
            {type_: 'All', sort, page, limit, show_nsfw: nsfwFilter !== 'Exclude'},
            fetchImpl,
            null,
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
): Promise<LemmyCommunity[]> {
    const data = assertCommunities(
        await apiGet(
            instance,
            '/api/alpha/search',
            {q: search, type_: 'Communities', limit, nsfw: nsfwFilter},
            fetchImpl,
            null,
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
