import type { InfiniteData, InfiniteQueryObserverOptions, QueryKey, QueryObserverOptions } from '@tanstack/query-core';
import { loadSettings } from './db/settings';
import { getAuth, listAuthSessions } from './db/auth';
import type { StoredAuthSession } from './db/auth';
import { getRegistryCache, putRegistryCache } from './db/registry';
import { listServers } from './db/servers';
import type {
    AuthSession,
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyCommunity,
    NsfwFilter,
    PopularServer,
    PostFeedType,
    PostPage,
    PostSort,
    ServerRecord,
    Settings,
    SiteResult,
    Software,
} from './types';
import {
    authKey,
    authSessionsKey,
    communitiesKey,
    communityKey,
    communityPostsKey,
    popularServersKey,
    postsKey,
    serversKey,
    settingsKey,
    siteKey,
} from './query-keys';
import { fetchCommunitiesPage, fetchCommunityPostsPage, fetchPostPage, nextPostPage } from './query-fetch';
import type { PostsQueryParams } from './query-fetch';
import { fetchRegistryPopular, mergePopular, POPULAR_SERVERS, REGISTRY_TTL_MS } from './services/registry';
import { fetchCommunity, fetchSite } from './services/lemmy';
import { fetchPiefedCommunity } from './services/piefed';

// ---- query options ----

export function settingsQuery(): QueryObserverOptions<Settings> {
    return { queryKey: settingsKey, queryFn: () => loadSettings(), staleTime: Infinity };
}

export function siteQuery(instance: string): QueryObserverOptions<SiteResult> {
    return { queryKey: siteKey(instance), queryFn: () => fetchSite(instance), staleTime: 5 * 60_000 };
}

/** Per-instance login session; null when anonymous. Sessions never expire in cache. */
export function authQuery(instance: string): QueryObserverOptions<AuthSession | null> {
    return { queryKey: authKey(instance), queryFn: () => getAuth(instance), staleTime: Infinity };
}

/** Every saved login session, keyed by host — used to mark which servers have accounts. */
export function authSessionsQuery(): QueryObserverOptions<StoredAuthSession[]> {
    return { queryKey: authSessionsKey, queryFn: () => listAuthSessions(), staleTime: Infinity };
}

/** Servers the user has connected to, most-recently-used first. */
export function serversQuery(): QueryObserverOptions<ServerRecord[]> {
    return {
        queryKey: serversKey,
        queryFn: async () => {
            const servers = await listServers();
            return [...servers].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
        },
        staleTime: Infinity,
    };
}

/** Popular servers = live lemmy registry (24h cached) merged over the bundled list. */
export function popularServersQuery(): QueryObserverOptions<PopularServer[]> {
    return {
        queryKey: popularServersKey,
        queryFn: async () => {
            const cached = await getRegistryCache(REGISTRY_TTL_MS);
            if (cached) return mergePopular(POPULAR_SERVERS, cached);
            const registry = await fetchRegistryPopular();
            if (registry.length) void putRegistryCache(registry).catch(() => {});
            return mergePopular(POPULAR_SERVERS, registry);
        },
        staleTime: REGISTRY_TTL_MS,
    };
}

export function communityQuery(
    instance: string,
    communityId: number,
    software: Software,
): QueryObserverOptions<LemmyCommunity> {
    return {
        queryKey: communityKey(instance, communityId, software),
        queryFn: () =>
            software === 'piefed' ? fetchPiefedCommunity(instance, communityId) : fetchCommunity(instance, communityId),
        staleTime: 60_000,
    };
}

type InfinitePostsOptions = InfiniteQueryObserverOptions<
    PostPage,
    Error,
    InfiniteData<PostPage, number>,
    QueryKey,
    number
>;

export function postsInfiniteQuery(
    instance: string,
    feedType: PostFeedType,
    sort: PostSort,
    software: Software,
    nsfwFilter: NsfwFilter,
    auth: string,
): InfinitePostsOptions {
    const params: PostsQueryParams = { instance, feedType, sort, software, nsfwFilter, auth };
    return {
        queryKey: postsKey(instance, feedType, sort, nsfwFilter, software, auth),
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => fetchPostPage(params, pageParam),
        // rawCount from the queryFn tracks the unfiltered page size;
        // fallback to posts.length for hydrated pages that lack it
        getNextPageParam: (lastPage) => nextPostPage(lastPage),
        staleTime: 30_000,
    };
}

export function communityPostsInfiniteQuery(
    instance: string,
    communityId: number,
    sort: PostSort,
    software: Software,
    nsfwFilter: NsfwFilter,
    auth: string,
): InfinitePostsOptions {
    return {
        queryKey: communityPostsKey(instance, communityId, sort, nsfwFilter, software, auth),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            fetchCommunityPostsPage(instance, communityId, sort, software, nsfwFilter, auth, pageParam),
        getNextPageParam: nextPostPage,
        staleTime: 30_000,
    };
}

type InfiniteCommunitiesOptions = InfiniteQueryObserverOptions<
    CommunityPage,
    Error,
    InfiniteData<CommunityPage, number>,
    QueryKey,
    number
>;

export function communitiesInfiniteQuery(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    software: Software,
    nsfwFilter: NsfwFilter,
    auth: string,
): InfiniteCommunitiesOptions {
    return {
        queryKey: communitiesKey(instance, type, sort, search, nsfwFilter, software, auth),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            fetchCommunitiesPage(instance, type, sort, search, software, nsfwFilter, auth, pageParam),
        getNextPageParam: (lastPage) => (lastPage.communities.length > 0 ? lastPage.page + 1 : undefined),
        staleTime: 30_000,
    };
}
