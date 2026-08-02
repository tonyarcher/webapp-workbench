import 'fake-indexeddb/auto'
import {loadSettings, saveSettings} from '../src/db/settings'
import {
    clearCommunitiesCache,
    clearPostsCache,
    getCommunitiesCache,
    getPostsCache,
    putCommunitiesCache,
    putPostsCache,
} from '../src/db/posts-cache'
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
    // ---- settings ----

    const defaults = await loadSettings()
    assert(defaults.instance === 'lemmy.ml', 'defaults applied on first load')

    await saveSettings({instance: 'test.instance'})
    const merged = await loadSettings()
    assert(merged.instance === 'test.instance', 'instance saved')
    assert(merged.postSort === 'Hot', 'unset fields keep defaults')

    await saveSettings({postSort: 'TopAll'})
    const again = await loadSettings()
    assert(again.instance === 'test.instance' && again.postSort === 'TopAll', 'patches accumulate')

    // concurrent saves must not drop each other's patch
    await Promise.all([
        saveSettings({feedType: 'Local'}),
        saveSettings({nsfwFilter: 'Exclude'}),
    ])
    const concurrent = await loadSettings()
    assert(
        concurrent.feedType === 'Local' && concurrent.nsfwFilter === 'Exclude',
        'concurrent saves both persist',
    )

    // ---- posts cache ----

    await putPostsCache('posts:test.instance:All:Hot:1', [post])
    const cached = await getPostsCache('posts:test.instance:All:Hot:1', 60_000)
    assert(cached?.length === 1 && cached[0].id === 1, 'posts cache roundtrip')

    const expired = await getPostsCache('posts:test.instance:All:Hot:1', 0)
    assert(expired === null, 'posts cache respects ttl')

    await putPostsCache('posts:test.instance:All:Hot:1', [post])
    await clearPostsCache()
    assert(await getPostsCache('posts:test.instance:All:Hot:1', 60_000) === null, 'posts cache clears')

    // ---- communities cache ----

    await putCommunitiesCache('communities:test.instance:Hot:1', [community])
    const cachedCommunities = await getCommunitiesCache('communities:test.instance:Hot:1', 60_000)
    assert(cachedCommunities?.length === 1 && cachedCommunities[0].name === 'main', 'communities cache roundtrip')

    assert(await getCommunitiesCache('communities:test.instance:Hot:1', 0) === null, 'communities cache respects ttl')

    await clearCommunitiesCache()
    assert(await getCommunitiesCache('communities:test.instance:Hot:1', 60_000) === null, 'communities cache clears')

    console.log('db-smoke.ts: all assertions passed')
})().catch((e) => {
    console.error(e)
    throw e
})
