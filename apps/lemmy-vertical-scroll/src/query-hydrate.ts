import type { QueryKey } from '@tanstack/query-core';
import { CACHE_TTL_MS } from './types';
import type { CommunitySort, FeedType, NsfwFilter, PostFeedType, PostSort, Software } from './types';
import { getCommunitiesCache, getPostsCache } from './db/posts-cache';
import { queryClient } from './query-client';
import {
    communitiesCacheKey,
    communitiesKey,
    communityPostsCacheKey,
    communityPostsKey,
    postsCacheKey,
    postsKey,
} from './query-keys';

// ---- cold-start hydration from idb ----

const MAX_HYDRATE_PAGES = 5;

async function hydratePages(
    key: QueryKey,
    readCache: (page: number) => Promise<unknown[] | null>,
    pageField: 'posts' | 'communities',
): Promise<void> {
    if (queryClient.getQueryData(key)) return;
    const pages: unknown[][] = [];
    const pageParams: number[] = [];
    for (let page = 1; page <= MAX_HYDRATE_PAGES; page++) {
        const items = await readCache(page);
        if (!items) break;
        pages.push(items);
        pageParams.push(page);
    }
    if (pages.length) {
        queryClient.setQueryData(key, {
            pages: pages.map((items, i) => ({ [pageField]: items, page: pageParams[i] })),
            pageParams,
        });
    }
}

export function hydratePosts(
    instance: string,
    feedType: PostFeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): Promise<void> {
    return hydratePages(
        postsKey(instance, feedType, sort, nsfwFilter, software, auth),
        (page) =>
            getPostsCache(postsCacheKey(instance, feedType, sort, nsfwFilter, software, auth, page), CACHE_TTL_MS),
        'posts',
    );
}

export function hydrateCommunityPosts(
    instance: string,
    communityId: number,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): Promise<void> {
    return hydratePages(
        communityPostsKey(instance, communityId, sort, nsfwFilter, software, auth),
        (page) =>
            getPostsCache(
                communityPostsCacheKey(instance, communityId, sort, nsfwFilter, software, auth, page),
                CACHE_TTL_MS,
            ),
        'posts',
    );
}

export function hydrateCommunities(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): Promise<void> {
    if (search) return Promise.resolve();
    return hydratePages(
        communitiesKey(instance, type, sort, '', nsfwFilter, software, auth),
        (page) =>
            getCommunitiesCache(
                communitiesCacheKey(instance, type, sort, nsfwFilter, software, auth, page),
                CACHE_TTL_MS,
            ),
        'communities',
    );
}
