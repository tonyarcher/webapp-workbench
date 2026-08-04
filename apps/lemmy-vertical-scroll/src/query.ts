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
} from './types'
import {
    getCommunitiesCache,
    getPostsCache,
    putCommunitiesCache,
    putPostsCache,
} from './db/posts-cache'
import {getAuth, listAuthSessions} from './db/auth'
import type {StoredAuthSession} from './db/auth'
import {getRegistryCache, putRegistryCache} from './db/registry'
import {listServers} from './db/servers'
import {loadSettings} from './db/settings'
import {fetchRegistryPopular, mergePopular, POPULAR_SERVERS, REGISTRY_TTL_MS} from './services/registry'
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
export const authKey = (instance: string): QueryKey => ['auth', instance]
export const serversKey = ['servers'] as const
export const authSessionsKey = ['authSessions'] as const
export const popularServersKey = ['popularServers'] as const
export const postsKey = (
    instance: string,
    feedType: PostFeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): QueryKey => ['posts', instance, feedType, sort, nsfwFilter, software, auth]
export const communitiesKey = (
    instance: string,
    type: FeedType,
    sort: CommunitySort,
    search: string,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): QueryKey => ['communities', instance, type, sort, search, nsfwFilter, software, auth]
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
    auth: string,
): QueryKey => ['communityPosts', instance, communityId, sort, nsfwFilter, software, auth]

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
    return `posts:${instance}:${feedType}:${sort}:${nsfwFilter}:${software}:${auth}:${page}`
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
    return `communities:${instance}:${type}:${sort}:${nsfwFilter}:${software}:${auth}:${page}`
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
    return `communityPosts:${instance}:${communityId}:${sort}:${nsfwFilter}:${software}:${auth}:${page}`
}

// ---- query options ----

export function settingsQuery(): QueryObserverOptions<Settings> {
    return {queryKey: settingsKey, queryFn: () => loadSettings(), staleTime: Infinity}
}

export function siteQuery(instance: string): QueryObserverOptions<SiteResult> {
    return {queryKey: siteKey(instance), queryFn: () => fetchSite(instance), staleTime: 5 * 60_000}
}

/** Per-instance login session; null when anonymous. Sessions never expire in cache. */
export function authQuery(instance: string): QueryObserverOptions<AuthSession | null> {
    return {queryKey: authKey(instance), queryFn: () => getAuth(instance), staleTime: Infinity}
}

/** Every saved login session, keyed by host — used to mark which servers have accounts. */
export function authSessionsQuery(): QueryObserverOptions<StoredAuthSession[]> {
    return {queryKey: authSessionsKey, queryFn: () => listAuthSessions(), staleTime: Infinity}
}

/** Servers the user has connected to, most-recently-used first. */
export function serversQuery(): QueryObserverOptions<ServerRecord[]> {
    return {
        queryKey: serversKey,
        queryFn: async () => {
            const servers = await listServers()
            return [...servers].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        },
        staleTime: Infinity,
    }
}

/** Popular servers = live lemmy registry (24h cached) merged over the bundled list. */
export function popularServersQuery(): QueryObserverOptions<PopularServer[]> {
    return {
        queryKey: popularServersKey,
        queryFn: async () => {
            const cached = await getRegistryCache(REGISTRY_TTL_MS)
            if (cached) return mergePopular(POPULAR_SERVERS, cached)
            const registry = await fetchRegistryPopular()
            if (registry.length) void putRegistryCache(registry).catch(() => {})
            return mergePopular(POPULAR_SERVERS, registry)
        },
        staleTime: REGISTRY_TTL_MS,
    }
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
    feedType: PostFeedType,
    sort: PostSort,
    software: Software,
    nsfwFilter: NsfwFilter,
    auth: string,
): InfinitePostsOptions {
    return {
        queryKey: postsKey(instance, feedType, sort, nsfwFilter, software, auth),
        initialPageParam: 1,
        queryFn: async ({pageParam}) => {
            const page =
                software === 'piefed'
                    ? await fetchPiefedPosts({instance, feedType, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter, auth})
                    : await fetchPosts({instance, feedType, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter, auth})
            void putPostsCache(postsCacheKey(instance, feedType, sort, nsfwFilter, software, auth, pageParam), page.posts).catch(() => {})
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
    auth: string,
): InfinitePostsOptions {
    return {
        queryKey: communityPostsKey(instance, communityId, sort, nsfwFilter, software, auth),
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
                      })
            void putPostsCache(communityPostsCacheKey(instance, communityId, sort, nsfwFilter, software, auth, pageParam), page.posts).catch(() => {})
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
    auth: string,
): InfiniteCommunitiesOptions {
    return {
        queryKey: communitiesKey(instance, type, sort, search, nsfwFilter, software, auth),
        initialPageParam: 1,
        queryFn: async ({pageParam}) => {
            if (software === 'piefed') {
                if (search) {
                    // PieFed community search is one-shot (no reliable pagination)
                    const communities =
                        pageParam === 1
                            ? await fetchPiefedCommunitySearch(instance, search, PAGE_SIZE, fetch, nsfwFilter, type, auth)
                            : []
                    return {communities, page: pageParam}
                }
                const page = await fetchPiefedCommunities({instance, type, sort, page: pageParam, limit: PAGE_SIZE, nsfwFilter, auth})
                void putCommunitiesCache(communitiesCacheKey(instance, type, sort, nsfwFilter, software, auth, pageParam), page.communities).catch(() => {})
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
                auth,
            })
            if (!search) {
                void putCommunitiesCache(communitiesCacheKey(instance, type, sort, nsfwFilter, software, auth, pageParam), page.communities).catch(() => {})
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
    feedType: PostFeedType,
    sort: PostSort,
    nsfwFilter: NsfwFilter,
    software: Software,
    auth: string,
): Promise<void> {
    return hydratePages(
        postsKey(instance, feedType, sort, nsfwFilter, software, auth),
        (page) => getPostsCache(postsCacheKey(instance, feedType, sort, nsfwFilter, software, auth, page), CACHE_TTL_MS),
        'posts',
    )
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
            getPostsCache(communityPostsCacheKey(instance, communityId, sort, nsfwFilter, software, auth, page), CACHE_TTL_MS),
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
    auth: string,
): Promise<void> {
    if (search) return Promise.resolve()
    return hydratePages(
        communitiesKey(instance, type, sort, '', nsfwFilter, software, auth),
        (page) => getCommunitiesCache(communitiesCacheKey(instance, type, sort, nsfwFilter, software, auth, page), CACHE_TTL_MS),
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
