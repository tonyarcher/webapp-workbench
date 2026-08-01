import {saveSettings} from './db/settings'
import {clearCommunitiesCache, clearPostsCache} from './db/posts-cache'
import {queryClient, settingsKey} from './query'
import type {CommunitySort, FeedType, NsfwFilter, PostSort, Settings, ViewMode} from './types'

function patchSettings(patch: Partial<Settings>): void {
    void saveSettings(patch)
    queryClient.setQueryData<Settings>(settingsKey, (old) => (old ? {...old, ...patch} : undefined))
}

/** Drops every query scoped to the old instance and wipes the idb post/community caches. */
export function setInstance(instance: string): void {
    patchSettings({instance})
    queryClient.removeQueries({predicate: (query) => query.queryKey[0] !== 'settings'})
    void clearPostsCache()
    void clearCommunitiesCache()
}

export function setFeedType(feedType: FeedType): void {
    patchSettings({feedType})
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
