import 'fake-indexeddb/auto'
import {queryClient} from '../src/query'
import {
    communitiesKey,
    communityKey,
    communityPostsKey,
    hydrateCommunities,
    hydratePosts,
    postsKey,
} from '../src/query'
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
    // ---- query keys include the provider software ----

    const pKey = postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'piefed')
    assert(pKey.includes('piefed') && !pKey.includes('lemmy'), 'postsKey carries software')
    assert(
        postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy') !== pKey,
        'postsKey differs per software',
    )
    assert(communityKey('lemmy.ml', 7, 'piefed').includes('piefed'), 'communityKey carries software')
    assert(communityPostsKey('lemmy.ml', 7, 'Hot', 'Include', 'piefed').includes('piefed'), 'communityPostsKey carries software')
    assert(communitiesKey('lemmy.ml', 'All', 'Hot', '', 'Include', 'piefed').includes('piefed'), 'communitiesKey carries software')

    // ---- cold-start hydration seeds the query cache from idb ----

    await putPostsCache('posts:lemmy.ml:All:Hot:Include:piefed:1', [post])
    await hydratePosts('lemmy.ml', 'All', 'Hot', 'Include', 'piefed')
    const seeded = queryClient.getQueryData(postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'piefed'))
    assert(
        !!seeded &&
            (seeded as {pages: {posts: LemmyPost[]}[]}).pages[0].posts[0].id === 1,
        'hydratePosts seeds query data from the idb cache',
    )
    await clearPostsCache()

    await putCommunitiesCache('communities:lemmy.ml:All:Hot:Include:piefed:1', [community])
    await hydrateCommunities('lemmy.ml', 'All', 'Hot', '', 'Include', 'piefed')
    const seededCommunities = queryClient.getQueryData(communitiesKey('lemmy.ml', 'All', 'Hot', '', 'Include', 'piefed'))
    assert(
        !!seededCommunities &&
            (seededCommunities as {pages: {communities: LemmyCommunity[]}[]}).pages[0].communities[0].name === 'main',
        'hydrateCommunities seeds query data from the idb cache',
    )
    await clearCommunitiesCache()

    // software-scoped keys do not collide in the cache
    await putPostsCache('posts:lemmy.ml:All:Hot:Include:lemmy:1', [{...post, id: 99}])
    await hydratePosts('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy')
    const lemmySeeded = queryClient.getQueryData(postsKey('lemmy.ml', 'All', 'Hot', 'Include', 'lemmy')) as {
        pages: {posts: LemmyPost[]}[]
    }
    assert(lemmySeeded.pages[0].posts[0].id === 99, 'software-scoped caches stay separate')

    console.log('query-smoke.ts: all assertions passed')
})().catch((e) => {
    console.error(e)
    throw e
})
