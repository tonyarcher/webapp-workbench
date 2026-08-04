import 'fake-indexeddb/auto'
import {queryClient} from '../src/query'
import {
    authKey,
    authQuery,
    authSessionsKey,
    authSessionsQuery,
    communitiesKey,
    communityKey,
    communityPostsKey,
    hydrateCommunities,
    hydratePosts,
    popularServersKey,
    popularServersQuery,
    postsKey,
    serversKey,
    serversQuery,
} from '../src/query'
import {login as commitLogin, logout as commitLogout} from '../src/mutations'
import type {StoredAuthSession} from '../src/db/auth'
import {putAuth, deleteAuth} from '../src/db/auth'
import {getRegistryCache, putRegistryCache} from '../src/db/registry'
import {deleteServer, putServer} from '../src/db/servers'
import {clearPostsCache, putPostsCache} from '../src/db/posts-cache'
import {clearCommunitiesCache, putCommunitiesCache} from '../src/db/posts-cache'
import type {LemmyCommunity, LemmyPost} from '../src/types'

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`)
}

const post: LemmyPost = {
    id: 1,
    name: 'p',
    url: null,
    body: null,
    thumbnailUrl: null,
    nsfw: false,
    pinnedLocal: false,
    pinnedCommunity: false,
    published: '2026-01-01T00:00:00Z',
    communityId: 1,
    communityName: 'main',
    communityActorId: 'https://lemmy.ml/c/main',
    communityTitle: 'Main',
    communityIcon: null,
    creatorActorId: 'https://lemmy.ml/u/bob',
    creatorName: 'bob',
    creatorDisplayName: null,
    creatorAvatar: null,
    score: 1,
    upvotes: 1,
    downvotes: 0,
    comments: 0,
    myVote: null,
    postUrl: 'https://lemmy.ml/post/1',
    postType: null,
    imageUrls: [],
    videoUrl: null,
    linkUrl: null,
}

const community: LemmyCommunity = {
    id: 1,
    name: 'main',
    title: 'Main',
    actorId: 'https://lemmy.ml/c/main',
    local: true,
    icon: null,
    banner: null,
    description: null,
    published: '2026-01-01T00:00:00Z',
    subscribers: 10,
    posts: 5,
    comments: 2,
    subscribed: false,
    blocked: false,
}

void (async () => {
    // ---- query keys include the provider software and the auth session ----

    const pKey = postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'piefed', '')
    assert(pKey.includes('piefed') && !pKey.includes('lemmy'), 'postsKey carries software')
    assert(
        postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', '') !== pKey,
        'postsKey differs per software',
    )
    assert(
        postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', 'jwt1') !==
            postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', ''),
        'postsKey differs per auth session',
    )
    assert(
        postsKey('lemmy.ml', 'Subscribed', 'Hot', 'Include', 'lemmy', 'jwt1').includes('Subscribed'),
        'postsKey carries the Subscribed listing',
    )
    assert(communityKey('lemmy.ml', 7, 'piefed').includes('piefed'), 'communityKey carries software')
    assert(communityPostsKey('lemmy.ml', 7, 'Hot', 'Include', 'piefed', '').includes('piefed'), 'communityPostsKey carries software')
    assert(communitiesKey('lemmy.ml', 'All', 'Hot', '', 'Include', 'piefed', '').includes('piefed'), 'communitiesKey carries software')

    // ---- cold-start hydration seeds the query cache from idb ----

    await putPostsCache('posts:lemmy.ml:All:Hot:Include:piefed::1', [post])
    await hydratePosts('lemmy.ml', 'All', 'Hot', 'Include', 'piefed', '')
    const seeded = queryClient.getQueryData(postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'piefed', ''))
    assert(
        !!seeded &&
            (seeded as {pages: {posts: LemmyPost[]}[]}).pages[0].posts[0].id === 1,
        'hydratePosts seeds query data from the idb cache',
    )
    await clearPostsCache()

    await putCommunitiesCache('communities:lemmy.ml:All:Hot:Include:piefed::1', [community])
    await hydrateCommunities('lemmy.ml', 'All', 'Hot', '', 'Include', 'piefed', '')
    const seededCommunities = queryClient.getQueryData(communitiesKey('lemmy.ml', 'All', 'Hot', '', 'Include', 'piefed', ''))
    assert(
        !!seededCommunities &&
            (seededCommunities as {pages: {communities: LemmyCommunity[]}[]}).pages[0].communities[0].name === 'main',
        'hydrateCommunities seeds query data from the idb cache',
    )
    await clearCommunitiesCache()

    // software-scoped keys do not collide in the cache
    await putPostsCache('posts:lemmy.ml:All:Hot:Include:lemmy::1', [{...post, id: 99}])
    await hydratePosts('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', '')
    const lemmySeeded = queryClient.getQueryData(postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', '')) as {
        pages: {posts: LemmyPost[]}[]
    }
    assert(lemmySeeded.pages[0].posts[0].id === 99, 'software-scoped caches stay separate')

    // auth-scoped hydration stays separate
    await putPostsCache('posts:lemmy.ml:All:Hot:Include:lemmy:jwt1:1', [{...post, id: 7}])
    await hydratePosts('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', 'jwt1')
    const authSeeded = queryClient.getQueryData(postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy', 'jwt1')) as {
        pages: {posts: LemmyPost[]}[]
    }
    assert(authSeeded.pages[0].posts[0].id === 7, 'auth-scoped caches stay separate')
    await clearPostsCache()

    // ---- auth query resolves the persisted session ----

    await putAuth('lemmy.ml', {jwt: 'jwtA', username: 'bob'})
    const authResult = await queryClient.fetchQuery(authQuery('lemmy.ml'))
    assert(authResult?.jwt === 'jwtA' && authResult.username === 'bob', 'authQuery resolves the session')
    assert(authKey('lemmy.ml').includes('lemmy.ml'), 'authKey scopes per instance')
    const otherResult = await queryClient.fetchQuery(authQuery('other.instance'))
    assert(otherResult === null, 'authQuery is null for a different instance')
    await deleteAuth('lemmy.ml')
    queryClient.removeQueries({queryKey: authKey('lemmy.ml')})
    const afterLogout = await queryClient.fetchQuery(authQuery('lemmy.ml'))
    assert(afterLogout === null, 'authQuery reflects logout')

    // ---- auth sessions query lists every saved login ----

    await putAuth('lemmy.ml', {jwt: 'j', username: 'bob'})
    await putAuth('piefed.social', {jwt: 'p', username: 'alice'})
    const sessions = await queryClient.fetchQuery(authSessionsQuery())
    assert(sessions.length === 2, 'authSessions lists all sessions')
    assert(
        sessions.some((s) => s.host === 'lemmy.ml' && s.username === 'bob') &&
            sessions.some((s) => s.host === 'piefed.social' && s.username === 'alice'),
        'authSessions maps host to username',
    )
    assert(authSessionsKey[0] === 'authSessions', 'authSessionsKey shape')

    // login/logout patch the indicator synchronously so the switcher dots stay truthful
    commitLogin('lemmy.ml', {jwt: 'j2', username: 'bob'})
    let dots = queryClient.getQueryData<StoredAuthSession[]>(authSessionsKey) ?? []
    assert(
        dots.filter((s) => s.host === 'lemmy.ml').length === 1 && dots.find((s) => s.host === 'lemmy.ml')?.jwt === 'j2',
        'login patches the session indicator in place',
    )
    await commitLogout('lemmy.ml')
    dots = queryClient.getQueryData<StoredAuthSession[]>(authSessionsKey) ?? []
    assert(
        !dots.some((s) => s.host === 'lemmy.ml') && dots.some((s) => s.host === 'piefed.social'),
        'logout drops the host from the session indicator',
    )
    await deleteAuth('lemmy.ml')
    await deleteAuth('piefed.social')

    // ---- servers query orders by most-recently-used ----

    await putServer({host: 'a.example', name: 'A', software: 'lemmy', addedAt: 1, lastUsedAt: 1})
    await putServer({host: 'b.example', name: 'B', software: 'piefed', addedAt: 2, lastUsedAt: 2})
    const servers = await queryClient.fetchQuery(serversQuery())
    assert(servers.length === 2 && servers[0].host === 'b.example', 'serversQuery orders by last used')
    assert(serversKey[0] === 'servers', 'serversKey shape')
    await deleteServer('a.example')
    await deleteServer('b.example')

    // ---- popular servers query reads the cached registry without network ----

    await putRegistryCache([{host: 'c.example', name: 'C', nsfw: true}])
    const popular = await queryClient.fetchQuery(popularServersQuery())
    assert(popular[0].host === 'c.example', 'registry cache ranks before bundled')
    assert(
        popular.some((s) => s.host === 'piefed.social') && popular.some((s) => s.host === 'c.example'),
        'popular merges bundled and registry',
    )
    assert(popularServersKey[0] === 'popularServers', 'popularServersKey shape')
    await getRegistryCache(0)

    console.log('query-smoke.ts: all assertions passed')
})().catch((e) => {
    console.error(e)
    throw e
})
