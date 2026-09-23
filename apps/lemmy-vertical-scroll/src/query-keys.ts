import type { QueryKey } from '@tanstack/query-core';
import type { CommunitySort, FeedType, NsfwFilter, PostFeedType, PostSort, Software } from './types';

// ---- query keys ----

export const settingsKey = ['settings'] as const;
export const siteKey = (instance: string): QueryKey => ['site', instance];
export const authKey = (instance: string): QueryKey => ['auth', instance];
export const serversKey = ['servers'] as const;
export const authSessionsKey = ['authSessions'] as const;
export const popularServersKey = ['popularServers'] as const;
export const postsKey = (
    instance: string,
    feedType: PostFeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): QueryKey => ['posts', instance, feedType, sort, nsfwFilter, software, auth];
export const communitiesKey = (
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): QueryKey => ['communities', instance, type, sort, search, nsfwFilter, software, auth];
export const communityKey = (instance: string, communityId: number, software: Software): QueryKey => [
    'community',
    instance,
    communityId,
    software,
];
export const communityPostsKey = (
    instance: string,
    communityId: number,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): QueryKey => ['communityPosts', instance, communityId, sort, nsfwFilter, software, auth];

// ---- idb cache keys ----

export function postsCacheKey(
    instance: string,
    feedType: PostFeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
    page: number,
): string {
    return `posts:${instance}:${feedType}:${sort}:${nsfwFilter}:${software}:${auth}:${page}`;
}

export function communitiesCacheKey(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
    page: number,
): string {
    return `communities:${instance}:${type}:${sort}:${nsfwFilter}:${software}:${auth}:${page}`;
}

export function communityPostsCacheKey(
    instance: string,
    communityId: number,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
    page: number,
): string {
    return `communityPosts:${instance}:${communityId}:${sort}:${nsfwFilter}:${software}:${auth}:${page}`;
}
