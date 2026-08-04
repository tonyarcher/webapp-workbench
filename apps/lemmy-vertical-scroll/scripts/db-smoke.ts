import 'fake-indexeddb/auto'
import {openDB} from 'idb'
import {getAuth, putAuth, deleteAuth} from '../src/db/auth'
import {getRegistryCache, putRegistryCache} from '../src/db/registry'
import {getDB} from '../src/db/schema'
import {deleteServer, getServer, listServers, putServer} from '../src/db/servers'
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
    // ---- v1 → v2 migration: simulate an existing v1 database with data ----

    const v1 = await openDB('lemmy-vertical-scroll', 1, {
        upgrade(db) {
            db.createObjectStore('settings', {keyPath: 'key'})
            db.createObjectStore('postsCache', {keyPath: 'key'})
            db.createObjectStore('communitiesCache', {keyPath: 'key'})
        },
    })
    await v1.put('settings', {key: 'settings', value: {instance: 'migrated.instance'}})
    v1.close()

    // the first v3 open must run the upgrade without losing v1 data
    const migrated = await loadSettings()
    assert(migrated.instance === 'migrated.instance', 'v1 settings survive the v3 migration')
    const db = await getDB()
    assert(db.objectStoreNames.contains('auth'), 'v3 schema adds the auth store')
    assert(db.objectStoreNames.contains('servers'), 'v3 schema adds the servers store')
    assert(db.objectStoreNames.contains('registry'), 'v3 schema adds the registry store')

    // ---- settings ----

    const defaults = await loadSettings()
    assert(defaults.instance === 'migrated.instance', 'migrated settings load')
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

    // ---- auth ----

    assert(await getAuth('test.instance') === null, 'auth starts empty')
    await putAuth('test.instance', {jwt: 'jwtA', username: 'bob'})
    const session = await getAuth('test.instance')
    assert(session?.jwt === 'jwtA' && session.username === 'bob', 'auth roundtrip')
    await putAuth('test.instance', {jwt: 'jwtB', username: 'bob'})
    assert((await getAuth('test.instance'))?.jwt === 'jwtB', 'auth overwrites per instance')
    await deleteAuth('test.instance')
    assert(await getAuth('test.instance') === null, 'auth deletes')
    await putAuth('other.instance', {jwt: 'jwtC', username: 'alice'})
    assert((await getAuth('other.instance'))?.username === 'alice', 'auth is per instance')
    await deleteAuth('other.instance')

    // ---- servers ----

    assert((await listServers()).length === 0, 'servers start empty')
    await putServer({host: 'lemmy.world', name: 'Lemmy.World', software: 'lemmy', addedAt: 1, lastUsedAt: 2})
    await putServer({host: 'piefed.social', name: 'PieFed', software: 'piefed', addedAt: 3, lastUsedAt: 4})
    assert((await listServers()).length === 2, 'servers list all')
    assert((await getServer('lemmy.world'))?.name === 'Lemmy.World', 'servers get by host')
    await putServer({host: 'lemmy.world', name: 'Lemmy.World', software: 'lemmy', addedAt: 1, lastUsedAt: 9})
    assert((await getServer('lemmy.world'))?.lastUsedAt === 9, 'servers upsert overwrites')
    await deleteServer('lemmy.world')
    assert(await getServer('lemmy.world') === undefined, 'servers delete')
    await deleteServer('piefed.social')

    // ---- registry cache ----

    assert(await getRegistryCache(60_000) === null, 'registry cache starts empty')
    await putRegistryCache([{host: 'a.example', name: 'A', nsfw: false}])
    const registryCached = await getRegistryCache(60_000)
    assert(registryCached?.length === 1 && registryCached[0].host === 'a.example', 'registry cache roundtrip')
    assert(await getRegistryCache(0) === null, 'registry cache respects ttl')

    console.log('db-smoke.ts: all assertions passed')
})().catch((e) => {
    console.error(e)
    throw e
})
