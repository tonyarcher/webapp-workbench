import { PAGE_SIZE } from './types';
import type {
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyPost,
    NsfwFilter,
    PostFeedType,
    PostPage,
    PostSort,
    Software,
} from './types';
import { putCommunitiesCache, putPostsCache } from './db/posts-cache';
import { communitiesCacheKey, communityPostsCacheKey, postsCacheKey } from './query-keys';
import { fetchCommunities, fetchCommunityPosts, fetchPosts } from './services/lemmy';
import {
    fetchPiefedCommunities,
    fetchPiefedCommunityPosts,
    fetchPiefedCommunitySearch,
    fetchPiefedPosts,
} from './services/piefed';

/**
 * Modern Lemmy (0.19.19+) and PieFed silently ignore the `nsfw`/`show_nsfw`
 * query params — NSFW filtering was moved to per-user account settings.
 * We handle it client-side by filtering the raw page. Variable page sizes
 * (e.g. 18/20 for Exclude) are fine; the virtualizer adapts to item count.
 */
export function clientFilterPosts(posts: LemmyPost[], nsfwFilter: NsfwFilter): LemmyPost[] {
    if (nsfwFilter === 'Only') return posts.filter((p) => p.nsfw);
    if (nsfwFilter === 'Exclude') return posts.filter((p) => !p.nsfw);
    return posts;
}

/** Extended PostPage that carries the raw page size for pagination decisions. */
interface FilteredPostPage extends PostPage {
    rawCount: number;
}

export interface PostsQueryParams {
    instance: string;
    feedType: PostFeedType;
    sort: PostSort;
    software: Software;
    nsfwFilter: NsfwFilter;
    auth: string;
}

export async function fetchPostPage(params: PostsQueryParams, pageParam: number): Promise<FilteredPostPage> {
    const { instance, feedType, sort, software, nsfwFilter, auth } = params;
    const page =
        software === 'piefed'
            ? await fetchPiefedPosts({ instance, feedType, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter, auth })
            : await fetchPosts({ instance, feedType, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter, auth });
    const filtered = clientFilterPosts(page.posts, nsfwFilter);
    void putPostsCache(postsCacheKey(instance, feedType, sort, nsfwFilter, software, auth, pageParam), filtered).catch(
        () => {},
    );
    return { posts: filtered, page: page.page, rawCount: page.posts.length };
}

export async function fetchCommunityPostsPage(
    instance: string,
    communityId: number,
    sort: PostSort,
    software: Software,
    nsfwFilter: NsfwFilter,
    auth: string,
    pageParam: number,
): Promise<FilteredPostPage> {
    const page =
        software === 'piefed'
            ? await fetchPiefedCommunityPosts({
                  instance,
                  communityId,
                  sort,
                  page: pageParam,
                  limit: PAGE_SIZE,
                  nsfwFilter,
                  auth,
              })
            : await fetchCommunityPosts({
                  instance,
                  communityId,
                  sort,
                  page: pageParam,
                  limit: PAGE_SIZE,
                  nsfwFilter,
                  auth,
              });
    const filtered = clientFilterPosts(page.posts, nsfwFilter);
    void putPostsCache(
        communityPostsCacheKey(instance, communityId, sort, nsfwFilter, software, auth, pageParam),
        filtered,
    ).catch(() => {});
    return { posts: filtered, page: page.page, rawCount: page.posts.length };
}

export function nextPostPage(lastPage: PostPage): number | undefined {
    const rawCount = (lastPage as FilteredPostPage).rawCount ?? PAGE_SIZE;
    return rawCount > 0 ? lastPage.page + 1 : undefined;
}

export async function fetchCommunitiesPage(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    software: Software,
    nsfwFilter: NsfwFilter,
    auth: string,
    pageParam: number,
): Promise<CommunityPage> {
    if (software === 'piefed')
        return fetchPiefedCommunitiesPage(instance, type, sort, search, nsfwFilter, auth, pageParam);
    const page = await fetchCommunities({
        instance,
        type,
        sort,
        page: pageParam,
        limit: PAGE_SIZE,
        search: search || undefined,
        nsfwFilter,
        auth,
    });
    if (!search)
        void putCommunitiesCache(
            communitiesCacheKey(instance, type, sort, nsfwFilter, software, auth, pageParam),
            page.communities,
        ).catch(() => {});
    return page;
}

async function fetchPiefedCommunitiesPage(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    nsfwFilter: NsfwFilter,
    auth: string,
    pageParam: number,
): Promise<CommunityPage> {
    if (search) {
        const communities =
            pageParam === 1
                ? await fetchPiefedCommunitySearch(instance, search, PAGE_SIZE, fetch, nsfwFilter, type, auth)
                : [];
        return { communities, page: pageParam };
    }
    const page = await fetchPiefedCommunities({
        instance,
        type,
        sort,
        page: pageParam,
        limit: PAGE_SIZE,
        nsfwFilter,
        auth,
    });
    void putCommunitiesCache(
        communitiesCacheKey(instance, type, sort, nsfwFilter, 'piefed', auth, pageParam),
        page.communities,
    ).catch(() => {});
    return page;
}
