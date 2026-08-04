import {deleteAuth, putAuth} from './db/auth'
import type {StoredAuthSession} from './db/auth'
import {deleteServer, getServer, listServers, putServer} from './db/servers'
import {loadSettings, saveSettings} from './db/settings'
import {clearCommunitiesCache, clearPostsCache} from './db/posts-cache'
import {authKey, authSessionsKey, queryClient, serversKey, settingsKey} from './query'
import {DEFAULT_SETTINGS} from './types'
import type {AuthSession, CommunitySort, FeedType, NsfwFilter, PostFeedType, PostSort, ServerRecord, Settings, Software, ViewMode} from './types'

function patchSettings(patch: Partial<Settings>): void {
    void saveSettings(patch).catch((error) => console.error('saveSettings failed', error))
    queryClient.setQueryData<Settings>(settingsKey, (old) => (old ? {...old, ...patch} : undefined))
}

/** Drops every non-settings, non-auth query and wipes the idb post/community caches. */
export function setInstance(instance: string): void {
    patchSettings({instance})
    queryClient.removeQueries({
        predicate: (query) =>
            query.queryKey[0] !== 'settings' &&
            query.queryKey[0] !== 'auth' &&
            query.queryKey[0] !== 'authSessions',
    })
    void clearPostsCache().catch(() => {})
    void clearCommunitiesCache().catch(() => {})
}

/** Drops feed queries and caches (auth sessions for other instances are kept). */
function dropFeedState(): void {
    queryClient.removeQueries({
        predicate: (query) =>
            query.queryKey[0] !== 'settings' &&
            query.queryKey[0] !== 'auth' &&
            query.queryKey[0] !== 'authSessions',
    })
    void clearPostsCache().catch(() => {})
    void clearCommunitiesCache().catch(() => {})
}

/** Keeps the switcher's login dots truthful without waiting for the async idb write. */
function patchAuthSessions(host: string, session: AuthSession | null): void {
    queryClient.setQueryData<StoredAuthSession[]>(authSessionsKey, (old) => {
        const list = old ? old.filter((entry) => entry.host !== host) : []
        return session ? [...list, {host, jwt: session.jwt, username: session.username}] : list
    })
}

/** Persists a login session and drops every cached/queried feed so it refetches under the account. */
export function login(instance: string, session: AuthSession): void {
    void putAuth(instance, session).catch((error) => console.error('putAuth failed', error))
    queryClient.setQueryData<AuthSession | null>(authKey(instance), session)
    patchAuthSessions(instance, session)
    dropFeedState()
}

/** Removes the session; resets logged-in-only feed types back to All. */
export async function logout(instance: string): Promise<void> {
    void deleteAuth(instance).catch((error) => console.error('deleteAuth failed', error))
    queryClient.setQueryData<AuthSession | null>(authKey(instance), null)
    patchAuthSessions(instance, null)
    dropFeedState()
    // read from idb so the reset survives a missing/evicted settings query
    try {
        const stored = await loadSettings()
        const patch: Partial<Settings> = {}
        if (stored.feedType !== 'All' && stored.feedType !== 'Local') patch.feedType = 'All'
        if (stored.communityType !== 'All' && stored.communityType !== 'Local') patch.communityType = 'All'
        if (Object.keys(patch).length) patchSettings(patch)
    } catch (error) {
        console.error('logout settings reset failed', error)
    }
}

export function setFeedType(feedType: PostFeedType): void {
    patchSettings({feedType})
}

export function setCommunityType(communityType: FeedType): void {
    patchSettings({communityType})
}

export function setPostSort(postSort: PostSort): void {
    patchSettings({postSort})
}

export function setCommunitySort(communitySort: CommunitySort): void {
    patchSettings({communitySort})
}

export function setNsfwFilter(nsfwFilter: NsfwFilter): void {
    patchSettings({nsfwFilter})
}

export function setViewMode(viewMode: ViewMode): void {
    patchSettings({viewMode})
}

export async function clearCaches(): Promise<void> {
    await clearPostsCache()
    await clearCommunitiesCache()
    queryClient.removeQueries({predicate: (query) => query.queryKey[0] !== 'settings'})
}

// ---- servers ----

/**
 * Upserts a server the user connected to (keeps the original addedAt, bumps
 * lastUsedAt) and refreshes the servers query. The app auto-remembers every
 * validated server so the switcher reflects "servers I've used".
 */
export async function rememberServer(host: string, name: string, software: Software): Promise<void> {
    const now = Date.now()
    const existing = await getServer(host).catch(() => undefined)
    const record: ServerRecord = {
        host,
        name,
        software,
        addedAt: existing?.addedAt ?? now,
        lastUsedAt: now,
    }
    await putServer(record)
    queryClient.setQueryData<ServerRecord[]>(serversKey, (old) => {
        const list = old ? old.filter((server) => server.host !== host) : []
        return [...list, record].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    })
}

/** Switches to a known server: bumps its last-used time and activates it. */
export function activateServer(server: ServerRecord): void {
    void rememberServer(server.host, server.name, server.software).catch((error) =>
        console.error('rememberServer failed', error),
    )
    setInstance(server.host)
}

/** Removes a server and its saved login; switches the app away if it was active. */
export async function removeServer(host: string): Promise<void> {
    await deleteServer(host)
    await deleteAuth(host)
    queryClient.removeQueries({
        predicate: (query) =>
            (query.queryKey[0] === 'site' || query.queryKey[0] === 'auth') && query.queryKey[1] === host,
    })
    queryClient.setQueryData<ServerRecord[]>(serversKey, (old) =>
        old ? old.filter((server) => server.host !== host) : old,
    )
    patchAuthSessions(host, null)
    // read from idb so the active-server check survives a missing/evicted settings query
    const settings = queryClient.getQueryData<Settings>(settingsKey) ?? (await loadSettings().catch(() => null))
    if (settings?.instance !== host) return
    const remaining = await listServers()
    if (remaining.length) {
        const next = remaining.reduce((a, b) => (b.lastUsedAt > a.lastUsedAt ? b : a))
        activateServer(next)
    } else {
        setInstance(DEFAULT_SETTINGS.instance)
    }
}
