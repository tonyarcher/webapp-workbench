import {InfiniteQueryObserver, QueryClient, QueryObserver} from '@tanstack/query-core'
import type {
    InfiniteData,
    InfiniteQueryObserverOptions,
    InfiniteQueryObserverResult,
    QueryKey,
    QueryObserverOptions,
    QueryObserverResult,
} from '@tanstack/query-core'
import type {ReactiveController, ReactiveControllerHost} from 'lit'
import {
    CACHE_TTL_MS,
    PAGE_SIZE,
} from './types'
import type {
    CommunityPage,
    CommunitySort,
    FeedType,
    LemmyCommunity,
    NsfwFilter,
    PostPage,
    PostSort,
    Settings,
    SiteResult,
    Software,
} from './types'
import {
    getCommunitiesCache,
    getPostsCache,
    putCommunitiesCache,
    putPostsCache,
} from './db/posts-cache'
import {loadSettings} from './db/settings'
import {fetchCommunities, fetchCommunity, fetchCommunityPosts, fetchPosts, fetchSite} from './services/lemmy'
import {
    fetchPiefedCommunities,
    fetchPiefedCommunity,
    fetchPiefedCommunityPosts,
    fetchPiefedCommunitySearch,
    fetchPiefedPosts,
} from './services/piefed'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {retry: 1, refetchOnWindowFocus: false},
    },
})

// ---- query keys ----

export const settingsKey = ['settings'] as const
export const siteKey = (instance: string): QueryKey => ['site', instance]
export const postsKey = (
    instance: string,
    feedType: FeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
): QueryKey => ['posts', instance, feedType, sort, nsfwFilter, software]
export const communitiesKey = (
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    nsfwFilter: NsfwFilter,
    software: Software,
): QueryKey => ['communities', instance, type, sort, search, nsfwFilter, software]
export const communityKey = (
    instance: string,
    communityId: number,
    software: Software,
): QueryKey => ['community', instance, communityId, software]
export const communityPostsKey = (
    instance: string,
    communityId: number,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
): QueryKey => ['communityPosts', instance, communityId, sort, nsfwFilter, software]

// ---- idb cache keys ----

export function postsCacheKey(
    instance: string,
    feedType: FeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    page: number,
): string {
    return `posts:${instance}:${feedType}:${sort}:${nsfwFilter}:${software}:${page}`
}

export function communitiesCacheKey(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    nsfwFilter: NsfwFilter,
    software: Software,
    page: number,
): string {
    return `communities:${instance}:${type}:${sort}:${nsfwFilter}:${software}:${page}`
}

export function communityPostsCacheKey(
    instance: string,
    communityId: number,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    page: number,
): string {
    return `communityPosts:${instance}:${communityId}:${sort}:${nsfwFilter}:${software}:${page}`
}

// ---- query options ----

export function settingsQuery(): QueryObserverOptions<Settings> {
    return {queryKey: settingsKey, queryFn: () => loadSettings(), staleTime: Infinity}
}

export function siteQuery(instance: string): QueryObserverOptions<SiteResult> {
    return {queryKey: siteKey(instance), queryFn: () => fetchSite(instance), staleTime: 5 * 60_000}
}

export function communityQuery(
    instance: string,
    communityId: number,
    software: Software,
): QueryObserverOptions<LemmyCommunity> {
    return {
        queryKey: communityKey(instance, communityId, software),
        queryFn: () =>
            software === 'piefed'
                ? fetchPiefedCommunity(instance, communityId)
                : fetchCommunity(instance, communityId),
        staleTime: 60_000,
    }
}

type InfinitePostsOptions = InfiniteQueryObserverOptions<PostPage, Error, InfiniteData<PostPage, number>, QueryKey, number>

export function postsInfiniteQuery(
    instance: string,
    feedType: FeedType,
    sort: PostSort,
    software: Software,
    nsfwFilter: NsfwFilter,
): InfinitePostsOptions {
    return {
        queryKey: postsKey(instance, feedType, sort, nsfwFilter, software),
        initialPageParam: 1,
        queryFn: async ({pageParam}) => {
            const page =
                software === 'piefed'
                    ? await fetchPiefedPosts({instance, feedType, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter})
                    : await fetchPosts({instance, feedType, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter})
            void putPostsCache(postsCacheKey(instance, feedType, sort, nsfwFilter, software, pageParam), page.posts).catch(() => {})
            return page
        },
        getNextPageParam: (lastPage) => (lastPage.posts.length > 0 ? lastPage.page + 1 : undefined),
        staleTime: 30_000,
    }
}

export function communityPostsInfiniteQuery(
    instance: string,
    communityId: number,
    sort: PostSort,
    software: Software,
    nsfwFilter: NsfwFilter,
): InfinitePostsOptions {
    return {
        queryKey: communityPostsKey(instance, communityId, sort, nsfwFilter, software),
        initialPageParam: 1,
        queryFn: async ({pageParam}) => {
            const page =
                software === 'piefed'
                    ? await fetchPiefedCommunityPosts({
                          instance,
                          communityId,
                          sort,
                          page: pageParam,
                          limit: PAGE_SIZE,
                          nsfwFilter,
                      })
                    : await fetchCommunityPosts({
                          instance,
                          communityId,
                          sort,
                          page: pageParam,
                          limit: PAGE_SIZE,
                          nsfwFilter,
                      })
            void putPostsCache(communityPostsCacheKey(instance, communityId, sort, nsfwFilter, software, pageParam), page.posts).catch(() => {})
            return page
        },
        getNextPageParam: (lastPage) => (lastPage.posts.length > 0 ? lastPage.page + 1 : undefined),
        staleTime: 30_000,
    }
}

type InfiniteCommunitiesOptions = InfiniteQueryObserverOptions<
    CommunityPage,
    Error,
    InfiniteData<CommunityPage, number>,
    QueryKey,
    number
>

export function communitiesInfiniteQuery(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    software: Software,
    nsfwFilter: NsfwFilter,
): InfiniteCommunitiesOptions {
    return {
        queryKey: communitiesKey(instance, type, sort, search, nsfwFilter, software),
        initialPageParam: 1,
        queryFn: async ({pageParam}) => {
            if (software === 'piefed') {
                if (search) {
                    // PieFed community search is one-shot (no reliable pagination)
                    const communities =
                        pageParam === 1
                            ? await fetchPiefedCommunitySearch(instance, search, PAGE_SIZE, fetch, nsfwFilter)
                            : []
                    return {communities, page: pageParam}
                }
                const page = await fetchPiefedCommunities({instance, type, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter})
                void putCommunitiesCache(communitiesCacheKey(instance, type, sort, nsfwFilter, software, pageParam), page.communities).catch(() => {})
                return page
            }
            const page = await fetchCommunities({
                instance,
                type,
                sort,
                page: pageParam,
                limit: PAGE_SIZE,
                search: search || undefined,
                nsfwFilter,
            })
            if (!search) {
                void putCommunitiesCache(communitiesCacheKey(instance, type, sort, nsfwFilter, software, pageParam), page.communities).catch(() => {})
            }
            return page
        },
        getNextPageParam: (lastPage) => (lastPage.communities.length > 0 ? lastPage.page + 1 : undefined),
        staleTime: 30_000,
    }
}

// ---- cold-start hydration from idb ----

const MAX_HYDRATE_PAGES = 5

async function hydratePages(
    key: QueryKey,
    readCache: (page: number) => Promise<unknown[] | null>,
    pageField: 'posts' | 'communities',
): Promise<void> {
    if (queryClient.getQueryData(key)) return
    const pages: unknown[][] = []
    const pageParams: number[] = []
    for (let page = 1; page <= MAX_HYDRATE_PAGES; page++) {
        const items = await readCache(page)
        if (!items) break
        pages.push(items)
        pageParams.push(page)
    }
    if (pages.length) {
        queryClient.setQueryData(key, {
            pages: pages.map((items, i) => ({[pageField]: items, page: pageParams[i]})),
            pageParams,
        })
    }
}

export function hydratePosts(
    instance: string,
    feedType: FeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
): Promise<void> {
    return hydratePages(
        postsKey(instance, feedType, sort, nsfwFilter, software),
        (page) => getPostsCache(postsCacheKey(instance, feedType, sort, nsfwFilter, software, page), CACHE_TTL_MS),
        'posts',
    )
}

export function hydrateCommunityPosts(
    instance: string,
    communityId: number,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
): Promise<void> {
    return hydratePages(
        communityPostsKey(instance, communityId, sort, nsfwFilter, software),
        (page) =>
            getPostsCache(communityPostsCacheKey(instance, communityId, sort, nsfwFilter, software, page), CACHE_TTL_MS),
        'posts',
    )
}

export function hydrateCommunities(
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    nsfwFilter: NsfwFilter,
    software: Software,
): Promise<void> {
    if (search) return Promise.resolve()
    return hydratePages(
        communitiesKey(instance, type, sort, '', nsfwFilter, software),
        (page) => getCommunitiesCache(communitiesCacheKey(instance, type, sort, nsfwFilter, software, page), CACHE_TTL_MS),
        'communities',
    )
}

// ---- reactive query controllers ----

/**
 * Lit reactive controller subscribing to the module QueryClient.
 * Rebuilds the observer whenever the factory's queryKey changes.
 */
export class QueryController<TFnData, TData = TFnData, TError = Error> implements ReactiveController {
    protected observer: QueryObserver<TFnData, TError, TData, TData, QueryKey> | null = null
    private result: QueryObserverResult<TData, TError> | null = null
    private lastKey = ''

    constructor(
        private readonly host: ReactiveControllerHost,
        private readonly factory: () => QueryObserverOptions<TFnData, TError, TData, TData, QueryKey>,
    ) {
        host.addController(this)
    }

    protected makeObserver(
        opts: QueryObserverOptions<TFnData, TError, TData, TData, QueryKey>,
    ): QueryObserver<TFnData, TError, TData, TData, QueryKey> {
        return new QueryObserver<TFnData, TError, TData, TData, QueryKey>(queryClient, opts)
    }

    hostConnected(): void {
        this.sync()
    }

    hostUpdate(): void {
        this.sync()
    }

    hostDisconnected(): void {
        this.observer?.destroy()
        this.observer = null
    }

    private sync(): void {
        const opts = this.factory()
        const key = JSON.stringify(opts.queryKey)
        if (this.observer) {
            if (key !== this.lastKey) {
                this.observer.setOptions(opts)
                this.lastKey = key
            }
            return
        }
        this.lastKey = key
        const observer = this.makeObserver(opts)
        this.observer = observer
        observer.subscribe((result) => {
            this.result = result
            this.host.requestUpdate()
        })
        this.result = observer.getCurrentResult()
    }

    get value(): QueryObserverResult<TData, TError> {
        if (!this.result) this.sync()
        return this.result as QueryObserverResult<TData, TError>
    }

    refetch(): void {
        void this.observer?.refetch()
    }
}

export class InfiniteQueryController<TFnData, TError = Error> extends QueryController<
    TFnData,
    InfiniteData<TFnData, number>,
    TError
> {
    constructor(
        host: ReactiveControllerHost,
        factory: () => InfiniteQueryObserverOptions<TFnData, TError, InfiniteData<TFnData, number>, QueryKey, number>,
    ) {
        super(host, factory as () => QueryObserverOptions<TFnData, TError, InfiniteData<TFnData, number>, InfiniteData<TFnData, number>, QueryKey>)
    }

    protected override makeObserver(
        opts: QueryObserverOptions<TFnData, TError, InfiniteData<TFnData, number>, InfiniteData<TFnData, number>, QueryKey>,
    ): QueryObserver<TFnData, TError, InfiniteData<TFnData, number>, InfiniteData<TFnData, number>, QueryKey> {
        return new InfiniteQueryObserver<TFnData, TError, InfiniteData<TFnData, number>, QueryKey, number>(
            queryClient,
            opts as InfiniteQueryObserverOptions<TFnData, TError, InfiniteData<TFnData, number>, QueryKey, number>,
        )
    }

    fetchNextPage(): void {
        const observer = this.observer as InfiniteQueryObserver<
            TFnData,
            TError,
            InfiniteData<TFnData, number>,
            QueryKey,
            number
        > | null
        void observer?.fetchNextPage()
    }

    get hasNextPage(): boolean {
        const result = this.value as unknown as InfiniteQueryObserverResult<InfiniteData<TFnData, number>, TError>
        return !!result.hasNextPage
    }

    get isFetchingNextPage(): boolean {
        const result = this.value as unknown as InfiniteQueryObserverResult<InfiniteData<TFnData, number>, TError>
        return !!result.isFetchingNextPage
    }
}
